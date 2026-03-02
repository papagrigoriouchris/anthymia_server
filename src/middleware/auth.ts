import type { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth.js";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    try {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });

        if (!session) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        (req as any).user = session.user;
        (req as any).session = session.session;
        next();
    } catch {
        res.status(401).json({ error: "Unauthorized" });
    }
}
