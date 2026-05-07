import z from "zod";

const createOrderValidationSchema = z.object({
    body: z.object({
        shippingAddress: z.string({
            error: "Shipping address is required"
        })
    })
});

const updateOrderStatusValidationSchema = z.object({
    body: z.object({
        status: z.enum(["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"])
    })
});

export const OrderValidation = {
    createOrderValidationSchema,
    updateOrderStatusValidationSchema
}
