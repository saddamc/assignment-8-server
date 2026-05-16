import z from "zod";

const addToCartValidationSchema = z.object({
    body: z.object({
        productId: z.string({
            error: "Product ID is required"
        }),
        variantId: z.string().optional(),
        size: z.string().optional(),
        quantity: z.number().int().min(1, "Quantity must be at least 1").max(5, "You can only add up to 5 of this item").optional()
    })
});

const updateCartItemValidationSchema = z.object({
    body: z.object({
        quantity: z.number().int().min(1, "Quantity must be at least 1").max(5, "You can only have up to 5 of this item")
    })
});

export const CartValidation = {
    addToCartValidationSchema,
    updateCartItemValidationSchema
}
