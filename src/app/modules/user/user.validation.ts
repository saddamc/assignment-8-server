import z from "zod";

const createCustomerValidationSchema = z.object({
    password: z.string({
        error: "Password is required"
    }),
    customer: z.object({
        name: z.string({
            error: "Name is required!"
        }),
        email: z.string({
            error: "Email is required!"
        }),
        contactNumber: z.string().optional(),
        address: z.string().optional()
    })
});

const createSellerValidationSchema = z.object({
    password: z.string({
        error: "Password is required"
    }),
    seller: z.object({
        name: z.string({
            error: "Name is required!"
        }),
        email: z.string({
            error: "Email is required!"
        }),
        storeName: z.string({
            error: "Store name is required!"
        }),
        storeDescription: z.string().optional(),
        contactNumber: z.string({
            error: "Contact Number is required!"
        }),
        address: z.string().optional()
    })
});

const createAdminValidationSchema = z.object({
    password: z.string({
        error: "Password is required"
    }),
    admin: z.object({
        name: z.string({
            error: "Name is required!"
        }),
        email: z.string({
            error: "Email is required!"
        }),
        contactNumber: z.string({
            error: "Contact Number is required!"
        })
    })
});

const updateCustomerProfileSchema = z.object({
    name: z.string().min(1, "Name is required").optional(),
    contactNumber: z.string().optional(),
    address: z.string().optional(),
    bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
    profilePhoto: z.string().optional()
});

const updateSellerProfileSchema = z.object({
    name: z.string().min(1, "Name is required").optional(),
    storeName: z.string().optional(),
    storeDescription: z.string().optional(),
    contactNumber: z.string().optional(),
    address: z.string().optional(),
    bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
    profilePhoto: z.string().optional()
});

const updateAdminProfileSchema = z.object({
    name: z.string().min(1, "Name is required").optional(),
    contactNumber: z.string().optional(),
    bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
    profilePhoto: z.string().optional()
});

export const UserValidation = {
    createCustomerValidationSchema,
    createSellerValidationSchema,
    createAdminValidationSchema,
    updateCustomerProfileSchema,
    updateSellerProfileSchema,
    updateAdminProfileSchema
}
