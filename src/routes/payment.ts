import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import vivaService from "../lib/vivaService.js";

const router = Router();

// ── GET /api/payment/webhook/viva ─────────────────────────────────────────────
// Viva sends a GET with ?Key= to verify the webhook endpoint on registration
router.get("/webhook/viva", (req: Request, res: Response) => {
    res.json({ Key: req.query.Key });
});

// ── POST /api/payment/iris/create ─────────────────────────────────────────────
// Called by the frontend after the order is created, to initialise Viva IRIS QR
router.post("/iris/create", requireAuth, async (req: Request, res: Response) => {
    try {
        const { orderId } = req.body as { orderId: string };
        if (!orderId) {
            res.status(400).json({ error: "orderId required" });
            return;
        }

        // Verify the order belongs to the logged-in user
        const userId = (req as any).user.id;
        const order = await prisma.order.findFirst({
            where: { id: orderId, userId },
            include: { user: true },
        });

        if (!order) {
            res.status(404).json({ error: "Order not found" });
            return;
        }

        if (!vivaService.isConfigured()) {
            // Viva not yet configured — return a flag so the frontend shows
            // the manual EPC/IBAN fallback
            res.json({ fallback: true });
            return;
        }

        // Create Viva payment order
        const orderCode = await vivaService.createPaymentOrder({
            orderId:       order.id,
            amount:        order.total,
            customerEmail: order.user.email,
            customerName:  order.name,
            customerPhone: order.phone,
            description:   `Anthymia παραγγελία #${order.id.slice(-8).toUpperCase()}`,
        });

        // Get IRIS QR data
        const irisData = await vivaService.createIrisQR(orderCode);

        // Persist the Viva order code
        await prisma.order.update({
            where: { id: order.id },
            data:  { vivaOrderCode: orderCode, paymentStatus: "pending" },
        });

        res.json({
            success:      true,
            orderCode,
            qrCodeUrl:    irisData.qrCodeUrl,
            qrCodeString: irisData.qrCodeString,
            irisId:       irisData.irisId,
            expiresAt:    irisData.expiresAt,
        });
    } catch (err: any) {
        console.error("IRIS create error:", err?.response?.data || err.message);
        res.status(500).json({ error: err.message || "IRIS payment init failed" });
    }
});

// ── GET /api/payment/iris/status/:orderId ─────────────────────────────────────
// Polled by the frontend every 3 s to check if payment was confirmed
router.get("/iris/status/:orderId", requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const order = await prisma.order.findFirst({
            where: { id: String(req.params.orderId), userId: String(userId) },
            select: { paymentStatus: true, transactionId: true },
        });

        if (!order) {
            res.status(404).json({ error: "Order not found" });
            return;
        }

        res.json({ paymentStatus: order.paymentStatus, transactionId: order.transactionId });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/payment/webhook/viva ────────────────────────────────────────────
// Viva calls this after a payment is completed
// Note: placed AFTER the GET so Express routes correctly
router.post("/webhook/viva", async (req: Request, res: Response) => {
    try {
        const event = req.body as {
            EventTypeId:    number;
            MerchantTrns:   string; // our orderId
            TransactionId:  string;
            Amount:         number;
        };

        // Verify signature if secret is configured
        const signature = req.headers["x-signature"] as string | undefined;
        if (signature && !vivaService.verifyWebhookSignature(JSON.stringify(event), signature)) {
            res.status(401).json({ error: "Invalid signature" });
            return;
        }

        console.log("Viva webhook event:", event.EventTypeId, event.MerchantTrns);

        // EventTypeId 1796 = Transaction Payment Created (successful payment)
        if (event.EventTypeId === 1796) {
            const orderId       = event.MerchantTrns;
            const transactionId = event.TransactionId;

            // Mark order as paid
            await prisma.order.update({
                where: { id: orderId },
                data: {
                    paymentStatus: "paid",
                    transactionId,
                    status:        "PROCESSING",
                },
            });

        }
        // myAADE invoice is issued manually from the admin dashboard

        res.status(200).json({ received: true });
    } catch (err: any) {
        console.error("Viva webhook error:", err.message);
        res.status(400).json({ error: err.message });
    }
});

export default router;
