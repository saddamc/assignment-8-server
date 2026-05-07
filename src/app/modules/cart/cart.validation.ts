import z from "zod";

const addToCartValidationSchema = z.object({
    body: z.object({
        productId: z.string({
            error: "Product ID is required"
        }),
        quantity: z.number().int().min(1, "Quantity must be at least 1").optional()
    })
});

const updateCartItemValidationSchema = z.object({
    body: z.object({
        quantity: z.number().int().min(1, "Quantity must be at least 1")
    })
});

export const CartValidation = {
    addToCartValidationSchema,
    updateCartItemValidationSchema
}
