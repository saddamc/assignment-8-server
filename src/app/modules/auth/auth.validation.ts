import z from "zod";

const registerValidationSchema = z.object({
    body: z.object({
        name: z.string({ error: "Name is required" }).min(2, "Name must be at least 2 characters"),
        email: z.string({ error: "Email is required" }).email("Invalid email address"),
        password: z.string({ error: "Password is required" }).min(6, "Password must be at least 6 characters"),
        confirmPassword: z.string({ error: "Confirm password is required" }),
        role: z.enum(["CUSTOMER", "SELLER", "ADMIN"]).optional()
    }).refine(data => data.password === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"]
    })
});

const loginValidationSchema = z.object({
    body: z.object({
        email: z.string({ error: "Email is required" }).email("Invalid email address"),
        password: z.string({ error: "Password is required" }).min(1, "Password is required")
    })
});

const changePasswordValidationSchema = z.object({
    body: z.object({
        oldPassword: z.string({ error: "Old password is required" }).min(1, "Old password is required"),
        newPassword: z.string({ error: "New password is required" }).min(6, "Password must be at least 6 characters"),
        confirmNewPassword: z.string({ error: "Confirm new password is required" })
    }).refine(data => data.newPassword === data.confirmNewPassword, {
        message: "New passwords do not match",
        path: ["confirmNewPassword"]
    })
});

const forgotPasswordValidationSchema = z.object({
    body: z.object({
        email: z.string({ error: "Email is required" }).email("Invalid email address")
    })
});

const resetPasswordValidationSchema = z.object({
    body: z.object({
        id: z.string({ error: "User ID is required" }),
        password: z.string({ error: "Password is required" }).min(6, "Password must be at least 6 characters"),
        confirmPassword: z.string({ error: "Confirm password is required" })
    }).refine(data => data.password === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"]
    })
});

export const AuthValidation = {
    registerValidationSchema,
    loginValidationSchema,
    changePasswordValidationSchema,
    forgotPasswordValidationSchema,
    resetPasswordValidationSchema
};
