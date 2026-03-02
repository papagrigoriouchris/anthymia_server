import { z } from "zod";

export const createOrderSchema = z.object({
    items: z.array(
        z.object({
            productId: z.string(),
            quantity: z.number().int().positive(),
        })
    ).min(1, "Order must contain at least one item"),
    name: z.string().min(2, "Name is required"),
    address: z.string().min(5, "Address is required"),
    city: z.string().min(2, "City is required"),
    phone: z.string().min(10, "Valid phone number is required"),
    paymentMethod: z.enum(["BANK_TRANSFER", "IRIS"]).default("BANK_TRANSFER"),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
