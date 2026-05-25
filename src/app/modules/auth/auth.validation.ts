import z from "zod";

const registerValidationSchema = z.object({
    body: z.object({
        name: z.string({ error: "Name is required" }).min(2, "Name must be at least 2 characters"),
        email: z.string({ error: "Email is required" }).email("Invalid email address"),
        password: z.string({ error: "Password is required" }).min(6, "Password must be at least 6 characters"),
        confirmPassword: z.string({ error: "Confirm password is required" }),
        role: z.enum(["CUSTOMER", "SELLER", "ADMIN"]).optional(),
        contactNumber: z.string().optional()
    }).refine(data => data.password === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"]
      })
});

const loginValidationSchema = z.object({
    body: z.object({
        email: z.string({ error: "Email or Phone is required" }).min(1, "Email or Phone is required"),
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

const sendSmsOtpValidationSchema = z.object({
    body: z.object({
        email: z.string().email("Invalid email address").optional(),
        phone: z.string({ error: "Phone number is required" }).regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format")
    })
});

const verifySmsOtpValidationSchema = z.object({
    body: z.object({
        email: z.string().email("Invalid email address").optional(),
        phone: z.string({ error: "Phone number is required" }).regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format"),
        otp: z.string({ error: "OTP is required" }).length(6, "OTP must be exactly 6 digits")
    })
});

const sendEmailOtpValidationSchema = z.object({
    body: z.object({
        email: z.string({ error: "Email is required" }).email("Invalid email address")
    })
});

const verifyEmailOtpValidationSchema = z.object({
    body: z.object({
        email: z.string({ error: "Email is required" }).email("Invalid email address"),
        otp: z.string({ error: "OTP is required" }).length(6, "OTP must be exactly 6 digits")
    })
});

const loginWithEmailOtpValidationSchema = z.object({
    body: z.object({
        email: z.string({ error: "Email is required" }).email("Invalid email address"),
        otp: z.string({ error: "OTP is required" }).length(6, "OTP must be exactly 6 digits")
    })
});

export const AuthValidation = {
    registerValidationSchema,
    loginValidationSchema,
    changePasswordValidationSchema,
    forgotPasswordValidationSchema,
    resetPasswordValidationSchema,
    sendSmsOtpValidationSchema,
    verifySmsOtpValidationSchema,
    sendEmailOtpValidationSchema,
    verifyEmailOtpValidationSchema,
    loginWithEmailOtpValidationSchema
};

