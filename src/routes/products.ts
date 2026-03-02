import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

// GET all products
router.get("/", async (_req, res) => {
    try {
        const products = await prisma.product.findMany({
            where: { inStock: true },
            include: { category: true },
            orderBy: { createdAt: "desc" },
        });
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch products" });
    }
});

// GET all categories
router.get("/categories", async (_req, res) => {
    try {
        const categories = await prisma.category.findMany({
            orderBy: { name: "asc" },
        });
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch categories" });
    }
});

// GET featured products
router.get("/featured", async (_req, res) => {
    try {
        const products = await prisma.product.findMany({
            where: { featured: true, inStock: true },
            include: { category: true },
            take: 3,
        });
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch featured products" });
    }
});

// GET single product
router.get("/:id", async (req, res) => {
    try {
        const product = await prisma.product.findUnique({
            where: { id: req.params.id },
            include: { category: true },
        });
        if (!product) {
            res.status(404).json({ error: "Product not found" });
            return;
        }
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch product" });
    }
});

export default router;
