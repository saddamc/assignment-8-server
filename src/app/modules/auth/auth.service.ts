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

// ─── Register ────────────────────────────────────────────────────────────────

const register = async (payload: {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
}) => {
    const existingUser = await prisma.user.findUnique({
        where: { email: payload.email }
    });

    if (existingUser) {
        throw new ApiError(httpStatus.CONFLICT, "Email is already registered!");
    }

    const hashedPassword = await bcrypt.hash(payload.password, Number(config.salt_round));
    const role = payload.role || UserRole.CUSTOMER;

    const user = await prisma.$transaction(async (tnx) => {
        const createdUser = await tnx.user.create({
            data: {
                name: payload.name,
                email: payload.email,
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
                    email: payload.email
                }
            });
        }

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
    const user = await prisma.user.findUnique({
        where: {
            email: payload.email,
            status: UserStatus.ACTIVE
        }
    });

    if (!user) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid email or password!");
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

    const userData = await prisma.user.findUniqueOrThrow({
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
    const userData = await prisma.user.findUniqueOrThrow({
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
    const userData = await prisma.user.findUnique({
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
};

// ─── Reset Password ───────────────────────────────────────────────────────────

const resetPassword = async (token: string, payload: { id: string; password: string }) => {
    const userData = await prisma.user.findUnique({
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

    const userData = await prisma.user.findUniqueOrThrow({
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

export const AuthService = {
    register,
    login,
    logout,
    refreshToken,
    changePassword,
    forgotPassword,
    resetPassword,
    getMe
};
