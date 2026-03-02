import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { auth } from "../auth.js";
import { z } from "zod";

const router = Router();

const updateProfileSchema = z.object({
    name: z.string().min(2).optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    phone: z.string().optional(),
});

router.get("/profile", async (req, res) => {
    const session = await auth.api.getSession({ headers: req.headers as HeadersInit });
    if (!session) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            address: true,
            city: true,
            phone: true,
            role: true,
        },
    });

    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
});

router.patch("/profile", async (req, res) => {
    const session = await auth.api.getSession({ headers: req.headers as HeadersInit });
    if (!session) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const data = updateProfileSchema.parse(req.body);

        const user = await prisma.user.update({
            where: { id: session.user.id },
            data,
        });

        res.json(user);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.issues });
        }
        console.error("Failed to update profile:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
