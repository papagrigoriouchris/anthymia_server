import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Local middleware for admin
const requireAdmin = async (req: any, res: any, next: any) => {
    if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({ error: "Access denied: Admins only" });
    }
    next();
};

// GET all posts (with pagination, filtering)
router.get("/", async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const { category, tag, search } = req.query;

        const where: any = {
            isPublished: true,
        };

        if (category) {
            where.category = String(category);
        }

        if (tag) {
            where.tags = {
                has: String(tag),
            };
        }

        if (search) {
            where.AND = [
                {
                    OR: [
                        { title: { contains: String(search), mode: 'insensitive' } },
                        { content: { contains: String(search), mode: 'insensitive' } }
                    ]
                }
            ];
        }

        const [posts, total] = await Promise.all([
            prisma.post.findMany({
                where,
                skip,
                take: limit,
                orderBy: { publishedAt: "desc" },
            }),
            prisma.post.count({ where }),
        ]);

        res.json({
            posts,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Fetch posts error:", error);
        res.status(500).json({ error: "Failed to fetch posts" });
    }
});

// GET all categories and tags (for sidebar / filtering)
router.get("/meta", async (_req, res) => {
    try {
        // Group by category to get unique categories
        const categoriesResult = await prisma.post.groupBy({
            by: ['category'],
            where: { isPublished: true },
            _count: { category: true }
        });

        const categories = categoriesResult.map(c => ({
            name: c.category,
            count: c._count.category
        }));

        // For tags we just fetch all tags and unique them, or count them.
        const posts = await prisma.post.findMany({
            where: { isPublished: true },
            select: { tags: true }
        });

        const tagCounts: Record<string, number> = {};
        posts.forEach(post => {
            post.tags.forEach(tag => {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
        });

        const tags = Object.keys(tagCounts).map(tag => ({
            name: tag,
            count: tagCounts[tag]
        })).sort((a, b) => b.count - a.count);

        res.json({ categories, tags });
    } catch (error) {
        console.error("Fetch meta error:", error);
        res.status(500).json({ error: "Failed to fetch categories/tags meta" });
    }
});

// GET single post by slug
router.get("/:slug", async (req, res) => {
    try {
        const post = await prisma.post.findUnique({
            where: { slug: req.params.slug },
        });

        if (!post) {
            res.status(404).json({ error: "Post not found" });
            return;
        }

        res.json(post);
    } catch (error) {
        console.error("Fetch single post error:", error);
        res.status(500).json({ error: "Failed to fetch post" });
    }
});

// ─── ADMIN ROUTES ──────────────────────────────────────────────

// GET all posts for admin (including drafts)
router.get("/admin/all", requireAuth, requireAdmin, async (_req, res) => {
    try {
        const posts = await prisma.post.findMany({
            orderBy: { createdAt: "desc" },
        });
        res.json(posts);
    } catch (error) {
        console.error("Fetch admin posts error:", error);
        res.status(500).json({ error: "Failed to fetch all posts" });
    }
});

// POST new post (Admin)
router.post("/", requireAuth, requireAdmin, async (req: any, res: any) => {
    try {
        const data = req.body;

        // Simple slug generation if not provided
        let slug = data.slug;
        if (!slug && data.title) {
            slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        }

        const post = await prisma.post.create({
            data: {
                title: data.title,
                slug: slug,
                content: data.content,
                excerpt: data.excerpt,
                author: data.author || req.user?.name || "Admin",
                featuredImage: data.featuredImage,
                category: data.category,
                blogCategoryId: data.blogCategoryId,
                tags: data.tags || [],
                isPublished: data.isPublished || false,
                publishedAt: data.isPublished ? new Date() : null,
                seoTitle: data.seoTitle,
                seoDescription: data.seoDescription,
            },
        });
        res.status(201).json(post);
    } catch (error) {
        console.error("Create post error:", error);
        res.status(500).json({ error: "Failed to create post" });
    }
});

// PUT update post (Admin)
router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body;

        // Manage publish date
        const existingPost = await prisma.post.findUnique({ where: { id: String(id) } });
        if (!existingPost) {
            res.status(404).json({ error: "Post not found" });
            return;
        }

        let publishedAt = existingPost.publishedAt;
        if (data.isPublished && !existingPost.isPublished) {
            publishedAt = new Date();
        } else if (data.isPublished === false) {
            publishedAt = null;
        }

        const post = await prisma.post.update({
            where: { id: String(id) },
            data: {
                title: data.title,
                slug: data.slug,
                content: data.content,
                excerpt: data.excerpt,
                author: data.author,
                featuredImage: data.featuredImage,
                category: data.category,
                blogCategoryId: data.blogCategoryId,
                tags: data.tags,
                isPublished: data.isPublished,
                publishedAt: publishedAt,
                seoTitle: data.seoTitle,
                seoDescription: data.seoDescription,
            },
        });

        res.json(post);
    } catch (error) {
        console.error("Update post error:", error);
        res.status(500).json({ error: "Failed to update post" });
    }
});

// DELETE post (Admin)
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
        await prisma.post.delete({
            where: { id: String(req.params.id) },
        });
        res.json({ success: true });
    } catch (error) {
        console.error("Delete post error:", error);
        res.status(500).json({ error: "Failed to delete post" });
    }
});

// ─── ADMIN BLOG CATEGORIES ROUTES ──────────────────────────────

// GET all blog categories
router.get("/admin/categories", requireAuth, requireAdmin, async (_req, res) => {
    try {
        const categories = await prisma.blogCategory.findMany({
            orderBy: { name: "asc" },
        });
        res.json(categories);
    } catch (error) {
        console.error("Fetch blog categories error:", error);
        res.status(500).json({ error: "Failed to fetch blog categories" });
    }
});

// POST create blog category
router.post("/admin/categories", requireAuth, requireAdmin, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: "Name is required" });
        const category = await prisma.blogCategory.create({ data: { name } });
        res.status(201).json(category);
    } catch (error) {
        console.error("Create blog category error:", error);
        res.status(500).json({ error: "Failed to create blog category" });
    }
});

// PATCH update blog category
router.patch("/admin/categories/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
        const { name } = req.body;
        const category = await prisma.blogCategory.update({
            where: { id: String(req.params.id) },
            data: { name },
        });
        res.json(category);
    } catch (error) {
        console.error("Update blog category error:", error);
        res.status(500).json({ error: "Failed to update blog category" });
    }
});

// DELETE blog category
router.delete("/admin/categories/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
        await prisma.blogCategory.delete({ where: { id: String(req.params.id) } });
        res.json({ success: true });
    } catch (error) {
        console.error("Delete blog category error:", error);
        res.status(500).json({ error: "Failed to delete blog category" });
    }
});

export default router;
