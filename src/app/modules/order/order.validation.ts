import z from "zod";

const createOrderValidationSchema = z.object({
    body: z.object({
        shippingAddress: z.string().optional(),
        addressId: z.string().optional(),
        couponCode: z.string().optional(),
        paymentMethod: z.enum(["STRIPE", "COD"]).default("STRIPE"),
        notes: z.string().optional()
    })
});

const updateOrderStatusValidationSchema = z.object({
    body: z.object({
        status: z.enum([
            "PENDING",
            "PROCESSING",
            "PACKED",
            "SHIPPED",
            "ON_THE_WAY",
            "DELIVERED",
            "CANCELLED",
            "REFUNDED"
        ])
    })
});

const addShipmentValidationSchema = z.object({
    body: z.object({
        carrier: z.string().optional(),
        trackingNumber: z.string().optional(),
        trackingUrl: z.string().url().optional(),
        estimatedDelivery: z.string().datetime().optional(),
        notes: z.string().optional()
    })
});

export const OrderValidation = {
    createOrderValidationSchema,
    updateOrderStatusValidationSchema,
    addShipmentValidationSchema
}
