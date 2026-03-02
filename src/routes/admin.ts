import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import aadeService from "../lib/aadeService.js";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const storage = multer.diskStorage({
    destination: path.join(__dirname, "../../../uploads"),
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
        cb(null, `${unique}${path.extname(file.originalname)}`);
    },
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith("image/")) cb(null, true);
        else cb(new Error("Only image files are allowed"));
    },
});

const router = Router();

// Middleware to check for admin role
const requireAdmin = async (req: any, res: any, next: any) => {
    if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({ error: "Access denied: Admins only" });
    }
    next();
};

// POST upload product image
router.post("/upload", requireAuth, requireAdmin, upload.single("image"), (req: any, res: any) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const url = `/api/uploads/${req.file.filename}`;
    res.json({ url });
});

// GET admin dashboard stats
router.get("/stats", requireAuth, requireAdmin, async (req, res) => {
    try {
        const totalOrders = await prisma.order.count();
        const pendingOrders = await prisma.order.count({
            where: { status: "PENDING" },
        });

        const revenueResult = await prisma.order.aggregate({
            _sum: {
                total: true,
            },
        });
        const totalRevenue = revenueResult._sum.total || 0;

        // Recent orders
        const recentOrders = await prisma.order.findMany({
            take: 5,
            orderBy: { createdAt: "desc" },
            include: { user: true },
        });

        res.json({
            totalOrders,
            pendingOrders,
            totalRevenue,
            recentOrders,
        });
    } catch (error) {
        console.error("Stats error:", error);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

// GET all orders
router.get("/orders", requireAuth, requireAdmin, async (req, res) => {
    try {
        const orders = await prisma.order.findMany({
            include: {
                user: true,
                items: {
                    include: { product: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });
        res.json(orders);
    } catch (error) {
        console.error("Fetch orders error:", error);
        res.status(500).json({ error: "Failed to fetch orders" });
    }
});

// PATCH update order status
router.patch("/orders/:id/status", requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // status should be PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED

        if (!status) {
            return res.status(400).json({ error: "Status is required" });
        }

        const order = await prisma.order.update({
            where: { id: String(id) },
            data: { status },
            include: { user: true }
        });

        // Send notification email to customer
        try {
            const { sendOrderStatusUpdate } = await import("../lib/email.js");
            await sendOrderStatusUpdate(order.user.email, order.id, status);
        } catch (mailError) {
            console.error("Failed to send status update email:", mailError);
        }

        res.json(order);
    } catch (error) {
        console.error("Update order status error:", error);
        res.status(500).json({ error: "Failed to update order status" });
    }
});

// POST issue myAADE invoice manually for an order
router.post("/orders/:id/issue-invoice", requireAuth, requireAdmin, async (req: any, res: any) => {
    try {
        const { id } = req.params;

        const order = await prisma.order.findUnique({
            where: { id: String(id) },
            include: {
                items: { include: { product: true } },
                user:  true,
            },
        });

        if (!order) return res.status(404).json({ error: "Order not found" });
        if (order.aadeMark) return res.status(400).json({ error: "Invoice already issued", mark: order.aadeMark });

        const result = await aadeService.issueInvoice({
            id:            order.id,
            total:         order.total,
            transactionId: order.transactionId,
            paymentMethod: order.paymentMethod,
            items:         order.items,
            user:          order.user,
        });

        // Respond immediately; generate PDF + send emails in background
        res.json({ success: true, mark: result.mark, uid: result.uid });

        setImmediate(async () => {
            try {
                const { generateInvoicePDF } = await import("../lib/pdfService.js");
                const { sendInvoiceEmail }    = await import("../lib/email.js");

                const pdf = await generateInvoicePDF({
                    orderId:         order.id,
                    orderDate:       order.createdAt,
                    invoiceNumber:   result.invoiceNumber,
                    mark:            result.mark,
                    uid:             result.uid,
                    customerName:    order.name || order.user.name,
                    customerEmail:   order.user.email,
                    customerAddress: order.address,
                    customerCity:    order.city,
                    customerPhone:   order.phone || "",
                    paymentMethod:   order.paymentMethod,
                    items:           order.items.map((i) => ({
                        name:      i.product.name,
                        quantity:  i.quantity,
                        unitPrice: i.price,
                    })),
                    total:       order.total,
                    companyName: process.env.COMPANY_NAME || "Anthymia Μελισσοκομία",
                    companyVat:  process.env.COMPANY_VAT  || "",
                    qrUrl:       result.qrUrl,
                });

                await sendInvoiceEmail({
                    customerEmail:  order.user.email,
                    customerName:   order.name || order.user.name,
                    orderId:        order.id,
                    mark:           result.mark,
                    invoiceNumber:  result.invoiceNumber,
                    pdfBuffer:      pdf,
                    qrUrl:          result.qrUrl,
                });
            } catch (mailErr) {
                console.error("Invoice PDF/email error for order", order.id, mailErr);
            }
        });
    } catch (err: any) {
        console.error("Issue invoice error:", err);
        res.status(500).json({ error: err.message || "Failed to issue invoice" });
    }
});

// POST send test email
router.post("/test-email", requireAuth, requireAdmin, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }

        const { sendContactMessage } = await import("../lib/email.js");

        await sendContactMessage("Test", email, "This is a test email from Anthymia admin panel.");

        res.json({ success: true, message: `Test email sent to ${email}` });
    } catch (error) {
        console.error("Test email error:", error);
        res.status(500).json({ error: "Failed to send test email" });
    }
});

// CATEGORIES CRUD
router.get("/categories", requireAuth, requireAdmin, async (_req, res) => {
    try {
        const categories = await prisma.category.findMany({
            orderBy: { name: "asc" },
        });
        res.json(categories);
    } catch (error) {
        console.error("Fetch categories error:", error);
        res.status(500).json({ error: "Failed to fetch categories" });
    }
});

router.post("/categories", requireAuth, requireAdmin, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: "Name is required" });
        const category = await prisma.category.create({ data: { name } });
        res.status(201).json(category);
    } catch (error) {
        console.error("Create category error:", error);
        res.status(500).json({ error: "Failed to create category" });
    }
});

router.patch("/categories/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
        const { name } = req.body;
        const category = await prisma.category.update({
            where: { id: String(req.params.id) },
            data: { name },
        });
        res.json(category);
    } catch (error) {
        console.error("Update category error:", error);
        res.status(500).json({ error: "Failed to update category" });
    }
});

router.delete("/categories/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
        await prisma.category.delete({ where: { id: String(req.params.id) } });
        res.json({ success: true });
    } catch (error) {
        console.error("Delete category error:", error);
        res.status(500).json({ error: "Failed to delete category" });
    }
});

// PRODUCTS CRUD
router.get("/products", requireAuth, requireAdmin, async (_req, res) => {
    try {
        const products = await prisma.product.findMany({
            include: { category: true },
            orderBy: { createdAt: "desc" },
        });
        res.json(products);
    } catch (error) {
        console.error("Fetch products error:", error);
        res.status(500).json({ error: "Failed to fetch products" });
    }
});

router.post("/products", requireAuth, requireAdmin, async (req, res) => {
    try {
        const { name, description, price, image, categoryId, weight, inStock, featured } = req.body;
        const product = await prisma.product.create({
            data: {
                name,
                description,
                price: parseFloat(price),
                image,
                categoryId,
                weight,
                inStock: inStock ?? true,
                featured: featured ?? false,
            },
            include: { category: true }
        });
        res.status(201).json(product);
    } catch (error) {
        console.error("Create product error:", error);
        res.status(500).json({ error: "Failed to create product" });
    }
});

router.patch("/products/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            description,
            price,
            image,
            categoryId,
            weight,
            inStock,
            featured
        } = req.body;

        const data: any = {};
        if (name !== undefined) data.name = name;
        if (description !== undefined) data.description = description;
        if (price !== undefined) data.price = parseFloat(price);
        if (image !== undefined) data.image = image;
        if (categoryId !== undefined) data.categoryId = categoryId;
        if (weight !== undefined) data.weight = weight;
        if (inStock !== undefined) data.inStock = inStock;
        if (featured !== undefined) data.featured = featured;

        const product = await prisma.product.update({
            where: { id: String(id) },
            data,
            include: { category: true }
        });
        res.json(product);
    } catch (error) {
        console.error("Update product error:", error);
        res.status(500).json({ error: "Failed to update product" });
    }
});

router.delete("/products/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
        await prisma.product.delete({ where: { id: String(req.params.id) } });
        res.json({ success: true });
    } catch (error) {
        console.error("Delete product error:", error);
        res.status(500).json({ error: "Failed to delete product" });
    }
});

// ─── NEWSLETTER SUBSCRIBERS CRUD ────────────────────────────────────────────

// GET all subscribers
router.get("/newsletter", requireAuth, requireAdmin, async (_req, res) => {
    try {
        const subscribers = await prisma.newsletterSubscriber.findMany({
            orderBy: { createdAt: "desc" },
        });
        res.json(subscribers);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch subscribers" });
    }
});

// POST create subscriber
router.post("/newsletter", requireAuth, requireAdmin, async (req, res) => {
    const { email, name } = req.body;
    if (!email) {
        res.status(400).json({ error: "Email is required" });
        return;
    }
    try {
        const subscriber = await prisma.newsletterSubscriber.create({
            data: { email: email.toLowerCase().trim(), name: name || null },
        });
        res.status(201).json(subscriber);
    } catch {
        res.status(400).json({ error: "Email already exists" });
    }
});

// PATCH update subscriber
router.patch("/newsletter/:id", requireAuth, requireAdmin, async (req, res) => {
    const { email, name } = req.body;
    try {
        const subscriber = await prisma.newsletterSubscriber.update({
            where: { id: String(req.params.id) },
            data: {
                ...(email && { email: email.toLowerCase().trim() }),
                ...(name !== undefined && { name: name || null }),
            },
        });
        res.json(subscriber);
    } catch {
        res.status(400).json({ error: "Failed to update subscriber" });
    }
});

// DELETE subscriber
router.delete("/newsletter/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
        await prisma.newsletterSubscriber.delete({ where: { id: String(req.params.id) } });
        res.json({ ok: true });
    } catch {
        res.status(404).json({ error: "Subscriber not found" });
    }
});

export default router;
