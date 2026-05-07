import z from "zod";

const createProductValidationSchema = z.object({
    body: z.object({
        name: z.string({
            error: "Product name is required"
        }),
        description: z.string({
            error: "Description is required"
        }),
        price: z.number({
            error: "Price is required"
        }).positive("Price must be positive"),
        discount: z.number().min(0).max(100).optional(),
        stock: z.number().int().min(0).optional(),
        categoryId: z.string().optional(),
        brandId: z.string().optional(),
    })
});

const updateProductValidationSchema = z.object({
    body: z.object({
        name: z.string().optional(),
        description: z.string().optional(),
        price: z.number().positive("Price must be positive").optional(),
        discount: z.number().min(0).max(100).optional(),
        stock: z.number().int().min(0).optional(),
        categoryId: z.string().optional(),
        brandId: z.string().optional(),
    })
});

const createCategoryValidationSchema = z.object({
    body: z.object({
        name: z.string({ error: "Category name is required" }),
        slug: z.string().optional(),
        image: z.string().optional(),
        description: z.string().optional(),
    })
});

const updateCategoryValidationSchema = z.object({
    body: z.object({
        name: z.string().optional(),
        slug: z.string().optional(),
        image: z.string().optional(),
        description: z.string().optional(),
    })
});

const createBrandValidationSchema = z.object({
    body: z.object({
        name: z.string({ error: "Brand name is required" }),
        slug: z.string().optional(),
        logo: z.string().optional(),
        description: z.string().optional(),
    })
});

const updateBrandValidationSchema = z.object({
    body: z.object({
        name: z.string().optional(),
        slug: z.string().optional(),
        logo: z.string().optional(),
        description: z.string().optional(),
    })
});

const createReviewValidationSchema = z.object({
    body: z.object({
        rating: z.number().int().min(1).max(5),
        comment: z.string().optional(),
        productId: z.string({
            error: "Product ID is required"
        })
    })
});

export const ProductValidation = {
    createProductValidationSchema,
    updateProductValidationSchema,
    createCategoryValidationSchema,
    updateCategoryValidationSchema,
    createBrandValidationSchema,
    updateBrandValidationSchema,
    createReviewValidationSchema,
}
