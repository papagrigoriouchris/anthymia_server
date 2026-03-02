import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import productRoutes from "./routes/products.js";
import orderRoutes from "./routes/orders.js";
import adminRoutes from "./routes/admin.js";
import userRoutes from "./routes/user.js";
import contactRoutes from "./routes/contact.js";
import paymentRoutes from "./routes/payment.js";
import postRoutes from "./routes/posts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const port = process.env.PORT || 3001;

// CORS configuration
app.use(
    cors({
        origin: "http://localhost:5173",
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        credentials: true,
    })
);

// Better Auth handler - MUST be before express.json()
// For Express 5, use *splat instead of just *
app.all("/api/auth/*splat", toNodeHandler(auth));

// Serve uploaded images
app.use("/api/uploads", express.static(path.join(__dirname, "../../uploads")));

// JSON parsing for other routes
app.use(express.json());

// API Routes
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/user", userRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/posts", postRoutes);

// Health check
app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(port, () => {
    console.log(`🍯 Anthymia server running on http://localhost:${port}`);
});
