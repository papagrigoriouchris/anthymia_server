import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { createOrderSchema } from "../schemas/index.js";
import { sendOrderConfirmation, sendAdminNewOrderNotification } from "../lib/email.js";

const router = Router();

// POST create order
router.post("/", requireAuth, async (req, res) => {
    try {
        const result = createOrderSchema.safeParse(req.body);
        if (!result.success) {
            res.status(400).json({ error: result.error.flatten() });
            return;
        }

        const { items, name, address, city, phone, paymentMethod } = result.data;
        const userId = (req as any).user.id;

        // Fetch products to calculate total
        const productIds = items.map((item) => item.productId);
        const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
        });

        if (products.length !== productIds.length) {
            res.status(400).json({ error: "One or more products not found" });
            return;
        }

        // Calculate total
        let total = 0;
        const orderItems = items.map((item) => {
            const product = products.find((p) => p.id === item.productId)!;
            total += product.price * item.quantity;
            return {
                productId: item.productId,
                quantity: item.quantity,
                price: product.price,
            };
        });

        const order = await prisma.order.create({
            data: {
                userId,
                total,
                status: "PENDING",
                name,
                address,
                city,
                phone,
                paymentMethod,
                items: {
                    create: orderItems,
                },
            },
            include: {
                items: {
                    include: { product: true },
                },
                user: true,
            },
        });

        // Send emails
        sendOrderConfirmation(order);
        sendAdminNewOrderNotification(order);

        res.status(201).json(order);
    } catch (error) {
        console.error("Order creation error:", error);
        res.status(500).json({ error: "Failed to create order" });
    }
});

// GET user's orders
router.get("/", requireAuth, async (req, res) => {
    try {
        const userId = (req as any).user.id;
        const orders = await prisma.order.findMany({
            where: { userId },
            include: {
                items: {
                    include: { product: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch orders" });
    }
});

export default router;
