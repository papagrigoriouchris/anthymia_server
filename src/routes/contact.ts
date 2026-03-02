import { Router } from "express";
import { z } from "zod";
import { sendContactMessage, sendNewsletterNotification } from "../lib/email.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

const contactSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    message: z.string().min(10),
});

const newsletterSchema = z.object({
    email: z.string().email(),
    name: z.string().optional(),
});

// POST /api/contact — contact form submission
router.post("/", async (req, res) => {
    const result = contactSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ error: result.error.flatten() });
        return;
    }
    const { name, email, message } = result.data;
    await sendContactMessage(name, email, message);
    res.json({ ok: true });
});

// POST /api/contact/newsletter — newsletter subscription
router.post("/newsletter", async (req, res) => {
    const result = newsletterSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ error: result.error.flatten() });
        return;
    }
    const { email, name } = result.data;

    // Save to DB (upsert — don't fail if already subscribed)
    await prisma.newsletterSubscriber.upsert({
        where: { email: email.toLowerCase() },
        create: { email: email.toLowerCase(), name: name || null },
        update: {},
    });

    await sendNewsletterNotification(email, name);
    res.json({ ok: true });
});

export default router;
