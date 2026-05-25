import { UserRole, UserStatus } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import bcrypt from "bcryptjs";
import { Secret } from "jsonwebtoken";
import { jwtHelper } from "../../helper/jwtHelper";
import ApiError from "../../errors/ApiError";
import httpStatus from "http-status";
import config from "../../../config";
import emailSender from "./emailSender";
import crypto from "crypto";
import { smsSender } from "../../helper/smsSender";

// ─── Register ────────────────────────────────────────────────────────────────

const register = async (payload: {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
    contactNumber?: string;
}) => {
    const normalizedEmail = payload.email.trim().toLowerCase();
    const normalizedPhone = payload.contactNumber?.replace(/\D/g, "");

    const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail }
    });

    if (existingUser) {
        throw new ApiError(httpStatus.CONFLICT, "Email is already registered!");
    }

    const verifiedEmail = await prisma.emailVerification.findUnique({
        where: { email: normalizedEmail }
    });

    if (!verifiedEmail?.verifiedAt) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Please verify your email before registration.");
    }

    const hashedPassword = await bcrypt.hash(payload.password, Number(config.salt_round));
    const role = payload.role || UserRole.CUSTOMER;

    const user = await prisma.$transaction(async (tnx) => {
        const createdUser = await tnx.user.create({
            data: {
                name: payload.name,
                email: normalizedEmail,
                password: hashedPassword,
                role,
                needPasswordChange: false
            }
        });

        // Auto-create Customer profile for CUSTOMER role
        if (role === UserRole.CUSTOMER) {
            await tnx.customer.create({
                data: {
                    name: payload.name,
                    email: normalizedEmail,
                    contactNumber: normalizedPhone || null,
                    isPhoneVerified: false
                }
            });
        }

        await tnx.emailVerification.delete({ where: { email: normalizedEmail } }).catch(() => {});
        return createdUser;
    });

    const accessToken = jwtHelper.generateToken(
        { email: user.email, role: user.role },
        config.jwt.jwt_secret as Secret,
        config.jwt.expires_in as string || "1h"
    );

    const refreshToken = jwtHelper.generateToken(
        { email: user.email, role: user.role },
        config.jwt.refresh_token_secret as Secret,
        config.jwt.refresh_token_expires_in as string || "90d"
    );

    return {
        accessToken,
        refreshToken,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        }
    };
};

// ─── Login ────────────────────────────────────────────────────────────────────

const login = async (payload: { email: string; password: string }) => {
    let searchEmail = payload.email;

    // Check if the input is a phone number (digits only or starts with +)
    const cleanPhone = payload.email.replace(/\D/g, "");
    if (cleanPhone.length >= 10 && !payload.email.includes("@")) {
        // Query customer by contact number
        const customer = await prisma.customer.findFirst({
            where: { contactNumber: { contains: cleanPhone } }
        });
        if (customer) {
            searchEmail = customer.email;
        } else {
            // Check seller
            const seller = await prisma.seller.findFirst({
                where: { contactNumber: { contains: cleanPhone } }
            });
            if (seller) {
                searchEmail = seller.email;
            }
        }
    }

    const user = await prisma.user.findFirst({
        where: {
            email: searchEmail,
            status: UserStatus.ACTIVE
        }
    });

    if (!user) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid email, phone number or password!");
    }

    const isCorrectPassword = await bcrypt.compare(payload.password, user.password);
    if (!isCorrectPassword) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid email or password!");
    }

    const accessToken = jwtHelper.generateToken(
        { email: user.email, role: user.role },
        config.jwt.jwt_secret as Secret,
        config.jwt.expires_in as string || "1h"
    );

    const refreshToken = jwtHelper.generateToken(
        { email: user.email, role: user.role },
        config.jwt.refresh_token_secret as Secret,
        config.jwt.refresh_token_expires_in as string || "90d"
    );

    return {
        accessToken,
        refreshToken,
        needPasswordChange: user.needPasswordChange
    };
};

// ─── Logout ───────────────────────────────────────────────────────────────────

const logout = async () => {
    return { message: "Logged out successfully!" };
};

// ─── Refresh Token ────────────────────────────────────────────────────────────

const refreshToken = async (token: string) => {
    let decodedData;
    try {
        decodedData = jwtHelper.verifyToken(token, config.jwt.refresh_token_secret as Secret);
    } catch {
        throw new ApiError(httpStatus.UNAUTHORIZED, "You are not authorized!");
    }

    const userData = await prisma.user.findFirstOrThrow({
        where: {
            email: decodedData.email,
            status: UserStatus.ACTIVE
        }
    });

    const accessToken = jwtHelper.generateToken(
        { email: userData.email, role: userData.role },
        config.jwt.jwt_secret as Secret,
        config.jwt.expires_in as string || "1h"
    );

    return { accessToken };
};

// ─── Change Password ──────────────────────────────────────────────────────────

const changePassword = async (user: { email: string }, payload: {
    oldPassword: string;
    newPassword: string;
}) => {
    const userData = await prisma.user.findFirstOrThrow({
        where: {
            email: user.email,
            status: UserStatus.ACTIVE
        }
    });

    const isCorrectPassword = await bcrypt.compare(payload.oldPassword, userData.password);
    if (!isCorrectPassword) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Old password is incorrect!");
    }

    const hashedPassword = await bcrypt.hash(payload.newPassword, Number(config.salt_round));

    await prisma.user.update({
        where: { email: userData.email },
        data: {
            password: hashedPassword,
            needPasswordChange: false
        }
    });

    return { message: "Password changed successfully!" };
};

// ─── Forgot Password ──────────────────────────────────────────────────────────

const forgotPassword = async (payload: { email: string }) => {
    const userData = await prisma.user.findFirst({
        where: {
            email: payload.email,
            status: UserStatus.ACTIVE
        }
    });

    // Always return success to prevent email enumeration attacks
    if (!userData) {
        return;
    }

    // Invalidate any existing unused tokens for this user
    await prisma.passwordResetToken.updateMany({
        where: { userId: userData.id, used: false },
        data: { used: true }
    });

    // Generate a signed JWT reset token
    const resetPassToken = jwtHelper.generateToken(
        { email: userData.email, role: userData.role },
        config.jwt.reset_pass_secret as Secret,
        config.jwt.reset_pass_token_expires_in as string || "15m"
    );

    // Store a hashed copy for extra validation
    const rawToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.passwordResetToken.create({
        data: {
            userId: userData.id,
            token: rawToken,
            expiresAt
        }
    });

    const resetPassLink = `${config.reset_pass_link}?userId=${userData.id}&token=${resetPassToken}`;

    try {
        await emailSender(
            userData.email,
            `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #333;">Reset Your Password</h2>
                <p>Hi ${userData.name || "there"},</p>
                <p>We received a request to reset your password. Click the button below to create a new password.</p>
                <p>This link expires in <strong>15 minutes</strong>.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetPassLink}"
                       style="background-color: #0070f3; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
                        Reset Password
                    </a>
                </div>
                <p style="color: #999; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
            </div>
            `,
            "Reset Your Password - E-Commerce"
        );
    } catch (err) {
        console.error("SMTP error sending forgot password email:", err);
        console.log("\n--- [PASSWORD RESET LINK FALLBACK] ---");
        console.log(`To: ${userData.email}`);
        console.log(`Link: ${resetPassLink}`);
        console.log("--------------------------------------\n");
    }
};

// ─── Reset Password ───────────────────────────────────────────────────────────

const resetPassword = async (token: string, payload: { id: string; password: string }) => {
    const userData = await prisma.user.findFirst({
        where: {
            id: payload.id,
            status: UserStatus.ACTIVE
        }
    });

    if (!userData) {
        throw new ApiError(httpStatus.NOT_FOUND, "User not found!");
    }

    // Verify the JWT reset token
    try {
        jwtHelper.verifyToken(token, config.jwt.reset_pass_secret as Secret);
    } catch {
        throw new ApiError(httpStatus.FORBIDDEN, "Reset token is invalid or expired!");
    }

    const hashedPassword = await bcrypt.hash(payload.password, Number(config.salt_round));

    await prisma.$transaction(async (tnx) => {
        await tnx.user.update({
            where: { id: payload.id },
            data: { password: hashedPassword, needPasswordChange: false }
        });

        await tnx.passwordResetToken.updateMany({
            where: { userId: payload.id, used: false },
            data: { used: true }
        });
    });
};

// ─── Get Me ───────────────────────────────────────────────────────────────────

const getMe = async (session: { accessToken?: string }) => {
    const accessToken = session.accessToken;

    if (!accessToken) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "You are not logged in!");
    }

    const decodedData = jwtHelper.verifyToken(accessToken, config.jwt.jwt_secret as Secret);

    const userData = await prisma.user.findFirstOrThrow({
        where: {
            email: decodedData.email,
            status: UserStatus.ACTIVE
        }
    });

    return {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        profileImage: userData.profileImage,
        needPasswordChange: userData.needPasswordChange,
        status: userData.status
    };
};

const sendSmsOtp = async (payload: { email?: string; phone: string }) => {
    const phone = payload.phone.replace(/\D/g, "");

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await prisma.phoneVerification.upsert({
        where: { phone },
        update: { otp, expiresAt, verifiedAt: null },
        create: { phone, otp, expiresAt }
    });

    const isSent = await smsSender(phone, otp);
    if (!isSent) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Failed to send SMS OTP. Please try again.");
    }

    return { message: "OTP sent successfully!" };
};

const verifySmsOtp = async (payload: { email?: string; phone: string; otp: string }) => {
    const { email, otp } = payload;
    const phone = payload.phone.replace(/\D/g, "");

    const verificationRecord = await prisma.phoneVerification.findUnique({
        where: { phone }
    });

    if (!verificationRecord) {
        throw new ApiError(httpStatus.BAD_REQUEST, "No active verification code found for this phone number!");
    }

    if (verificationRecord.otp !== otp) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Incorrect verification code entered!");
    }

    if (new Date() > verificationRecord.expiresAt) {
        throw new ApiError(httpStatus.BAD_REQUEST, "The verification code has expired!");
    }

    await prisma.$transaction(async (tnx) => {
        if (email) {
            const customer = await tnx.customer.findUnique({ where: { email } });
            if (customer) {
                await tnx.customer.update({
                    where: { email },
                    data: {
                        contactNumber: phone,
                        isPhoneVerified: true
                    }
                });
            }

            const seller = await tnx.seller.findUnique({ where: { email } });
            if (seller) {
                await tnx.seller.update({
                    where: { email },
                    data: {
                        contactNumber: phone,
                        isPhoneVerified: true
                    }
                });
            }
        }

        await tnx.phoneVerification.update({
            where: { phone },
            data: { verifiedAt: new Date() }
        });
    });

    return { message: "Phone number verified successfully!" };
};

const sendEmailOtp = async (payload: { email: string }) => {
    const email = payload.email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        throw new ApiError(httpStatus.CONFLICT, "Email is already registered!");
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.emailVerification.upsert({
        where: { email },
        update: { otp, expiresAt, verifiedAt: null },
        create: { email, otp, expiresAt }
    });

    const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #111827;">
            <h2 style="margin: 0 0 12px;">Verify your Cabro email</h2>
            <p style="line-height: 1.6;">Use this 6-digit code to finish creating your account.</p>
            <div style="font-size: 32px; letter-spacing: 8px; font-weight: 800; margin: 24px 0; padding: 18px; text-align: center; background: #f3f4f6; border-radius: 12px;">${otp}</div>
            <p style="color: #6b7280; font-size: 13px;">This code expires in 5 minutes. If you did not request it, you can ignore this email.</p>
        </div>
        `;

    if (!config.emailSender.email || !config.emailSender.app_pass) {
        console.log("\n--- [EMAIL OTP DEV MODE] ---");
        console.log(`To: ${email}`);
        console.log(`OTP: ${otp}`);
        console.log("----------------------------\n");
    } else {
        try {
            await emailSender(email, emailHtml, "Verify your Cabro email");
        } catch (err) {
            console.error("SMTP error sending verification email:", err);
            console.log("\n--- [EMAIL OTP FALLBACK DEV MODE] ---");
            console.log(`To: ${email}`);
            console.log(`OTP: ${otp}`);
            console.log("-------------------------------------\n");
        }
    }

    return { message: "Email verification code sent successfully!" };
};

const sendLoginEmailOtp = async (payload: { email: string }) => {
    const email = payload.email.trim().toLowerCase();

    const user = await prisma.user.findFirst({
        where: { email, status: UserStatus.ACTIVE }
    });

    if (!user) {
        throw new ApiError(httpStatus.NOT_FOUND, "No active account found with this email.");
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.emailVerification.upsert({
        where: { email },
        update: { otp, expiresAt, verifiedAt: null },
        create: { email, otp, expiresAt }
    });

    try {
        await emailSender(
            email,
            `
            <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #111827;">
                <h2 style="margin: 0 0 12px;">Your Cabro sign-in code</h2>
                <p style="line-height: 1.6;">Use this 6-digit code to sign in to your account.</p>
                <div style="font-size: 32px; letter-spacing: 8px; font-weight: 800; margin: 24px 0; padding: 18px; text-align: center; background: #f3f4f6; border-radius: 12px;">${otp}</div>
                <p style="color: #6b7280; font-size: 13px;">This code expires in 5 minutes. If you did not request it, you can ignore this email.</p>
            </div>
            `,
            "Your Cabro sign-in code"
        );
    } catch (err) {
        console.error("SMTP error sending login email OTP:", err);
        console.log("\n--- [LOGIN EMAIL OTP FALLBACK] ---");
        console.log(`To: ${email}`);
        console.log(`OTP: ${otp}`);
        console.log("----------------------------------\n");
    }

    return { message: "Login code sent successfully!" };
};

const verifyEmailOtp = async (payload: { email: string; otp: string }) => {
    const email = payload.email.trim().toLowerCase();

    const verificationRecord = await prisma.emailVerification.findUnique({
        where: { email }
    });

    if (!verificationRecord) {
        throw new ApiError(httpStatus.BAD_REQUEST, "No active verification code found for this email!");
    }

    if (verificationRecord.otp !== payload.otp) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Incorrect email verification code entered!");
    }

    if (new Date() > verificationRecord.expiresAt) {
        throw new ApiError(httpStatus.BAD_REQUEST, "The email verification code has expired!");
    }

    await prisma.emailVerification.update({
        where: { email },
        data: { verifiedAt: new Date() }
    });

    return { message: "Email verified successfully!" };
};

const loginWithOtp = async (payload: { phone: string; otp: string }) => {
    const { phone, otp } = payload;

    const verificationRecord = await prisma.phoneVerification.findUnique({
        where: { phone }
    });

    if (!verificationRecord) {
        throw new ApiError(httpStatus.BAD_REQUEST, "No active verification code found for this phone number!");
    }

    if (verificationRecord.otp !== otp) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Incorrect verification code entered!");
    }

    if (new Date() > verificationRecord.expiresAt) {
        throw new ApiError(httpStatus.BAD_REQUEST, "The verification code has expired!");
    }

    let customer = await prisma.customer.findFirst({
        where: { contactNumber: { contains: phone } }
    });

    let seller = null;
    if (!customer) {
        seller = await prisma.seller.findFirst({
            where: { contactNumber: { contains: phone } }
        });
    }

    let email = customer?.email || seller?.email;

    if (!email) {
        const newEmail = `${phone}@cabro-temp.com`;
        email = newEmail;
        const randomPassword = crypto.randomBytes(16).toString("hex");
        const hashedPassword = await bcrypt.hash(randomPassword, Number(config.salt_round));
        
        await prisma.$transaction(async (tnx) => {
            await tnx.user.create({
                data: {
                    name: `User ${phone}`,
                    email: newEmail,
                    password: hashedPassword,
                    role: UserRole.CUSTOMER,
                    needPasswordChange: false
                }
            });

            await tnx.customer.create({
                data: {
                    name: `User ${phone}`,
                    email: newEmail,
                    contactNumber: phone,
                    isPhoneVerified: true
                }
            });
        });
    }

    const user = await prisma.user.findFirstOrThrow({
        where: { email, status: UserStatus.ACTIVE }
    });

    await prisma.phoneVerification.delete({
        where: { phone }
    }).catch(() => {});

    const accessToken = jwtHelper.generateToken(
        { email: user.email, role: user.role },
        config.jwt.jwt_secret as Secret,
        config.jwt.expires_in as string || "1h"
    );

    const refreshToken = jwtHelper.generateToken(
        { email: user.email, role: user.role },
        config.jwt.refresh_token_secret as Secret,
        config.jwt.refresh_token_expires_in as string || "90d"
    );

    return {
        accessToken,
        refreshToken
    };
};

const loginWithEmailOtp = async (payload: { email: string; otp: string }) => {
    const email = payload.email.trim().toLowerCase();

    const verificationRecord = await prisma.emailVerification.findUnique({
        where: { email }
    });

    if (!verificationRecord) {
        throw new ApiError(httpStatus.BAD_REQUEST, "No active email verification code found!");
    }

    if (verificationRecord.otp !== payload.otp) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Incorrect email verification code entered!");
    }

    if (new Date() > verificationRecord.expiresAt) {
        throw new ApiError(httpStatus.BAD_REQUEST, "The email verification code has expired!");
    }

    const user = await prisma.user.findFirstOrThrow({
        where: { email, status: UserStatus.ACTIVE }
    });

    await prisma.emailVerification.delete({ where: { email } }).catch(() => {});

    const accessToken = jwtHelper.generateToken(
        { email: user.email, role: user.role },
        config.jwt.jwt_secret as Secret,
        config.jwt.expires_in as string || "1h"
    );

    const refreshToken = jwtHelper.generateToken(
        { email: user.email, role: user.role },
        config.jwt.refresh_token_secret as Secret,
        config.jwt.refresh_token_expires_in as string || "90d"
    );

    return {
        accessToken,
        refreshToken
    };
};

const googleLoginOrRegister = async (payload: { email: string; name: string }) => {
    const normalizedEmail = payload.email.trim().toLowerCase();

    let user = await prisma.user.findUnique({
        where: { email: normalizedEmail }
    });

    if (!user) {
        // Create user with a secure random password
        const randomPassword = crypto.randomBytes(16).toString("hex");
        const hashedPassword = await bcrypt.hash(randomPassword, Number(config.salt_round));

        user = await prisma.$transaction(async (tnx) => {
            const createdUser = await tnx.user.create({
                data: {
                    name: payload.name,
                    email: normalizedEmail,
                    password: hashedPassword,
                    role: UserRole.CUSTOMER,
                    needPasswordChange: false
                }
            });

            await tnx.customer.create({
                data: {
                    name: payload.name,
                    email: normalizedEmail,
                    contactNumber: null,
                    isPhoneVerified: false
                }
            });

            return createdUser;
        });
    }

    if (user.status !== UserStatus.ACTIVE) {
        throw new ApiError(httpStatus.FORBIDDEN, "Your account is not active!");
    }

    const accessToken = jwtHelper.generateToken(
        { email: user.email, role: user.role },
        config.jwt.jwt_secret as Secret,
        config.jwt.expires_in as string || "1h"
    );

    const refreshToken = jwtHelper.generateToken(
        { email: user.email, role: user.role },
        config.jwt.refresh_token_secret as Secret,
        config.jwt.refresh_token_expires_in as string || "90d"
    );

    return {
        accessToken,
        refreshToken,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        }
    };
};

export const AuthService = {
    register,
    login,
    logout,
    refreshToken,
    changePassword,
    forgotPassword,
    resetPassword,
    getMe,
    sendSmsOtp,
    verifySmsOtp,
    sendEmailOtp,
    verifyEmailOtp,
    sendLoginEmailOtp,
    loginWithOtp,
    loginWithEmailOtp,
    googleLoginOrRegister
};
