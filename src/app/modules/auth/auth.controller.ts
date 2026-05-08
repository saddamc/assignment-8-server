import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { AuthService } from "./auth.service";
import httpStatus from "http-status";
import config from "../../../config";

const isProduction = config.node_env === "production";

const parseJwtDuration = (value: string | undefined, fallback = "1h") => {
    const raw = (value || fallback).trim();
    const match = raw.match(/^(\d+)(s|m|h|d|y)?$/i);
    if (!match) {
        return 1000 * 60 * 60;
    }

    const amount = Number(match[1]);
    const unit = match[2]?.toLowerCase() || "s";

    switch (unit) {
        case "s":
            return amount * 1000;
        case "m":
            return amount * 60 * 1000;
        case "h":
            return amount * 60 * 60 * 1000;
        case "d":
            return amount * 24 * 60 * 60 * 1000;
        case "y":
            return amount * 365 * 24 * 60 * 60 * 1000;
        default:
            return amount * 1000;
    }
};

// ─── Register ────────────────────────────────────────────────────────────────

const register = catchAsync(async (req: Request, res: Response) => {
    const result = await AuthService.register(req.body);
    const { accessToken, refreshToken, user } = result;

    res.cookie("accessToken", accessToken, {
        secure: isProduction,
        httpOnly: true,
        sameSite: "none",
        maxAge: parseJwtDuration(config.jwt.expires_in as string, "1h"),
    });
    res.cookie("refreshToken", refreshToken, {
        secure: isProduction,
        httpOnly: true,
        sameSite: "none",
        maxAge: parseJwtDuration(config.jwt.refresh_token_expires_in as string, "90d"),
    });

    sendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: "User registered successfully!",
        data: { user, accessToken, refreshToken }
    });
});

// ─── Login ────────────────────────────────────────────────────────────────────

const login = catchAsync(async (req: Request, res: Response) => {
    const result = await AuthService.login(req.body);
    const { accessToken, refreshToken } = result;

    res.cookie("accessToken", accessToken, {
        secure: isProduction,
        httpOnly: true,
        sameSite: "none",
        maxAge: parseJwtDuration(config.jwt.expires_in as string, "1h"),
    });
    res.cookie("refreshToken", refreshToken, {
        secure: isProduction,
        httpOnly: true,
        sameSite: "none",
        maxAge: parseJwtDuration(config.jwt.refresh_token_expires_in as string, "90d"),
    });

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "User logged in successfully!",
        data: {
            accessToken,
            refreshToken,
            needPasswordChange: result.needPasswordChange
        }
    });
});

// ─── Logout ───────────────────────────────────────────────────────────────────

const logout = catchAsync(async (req: Request, res: Response) => {
    await AuthService.logout();

    res.clearCookie("accessToken", {
        secure: isProduction,
        httpOnly: true,
        sameSite: "none"
    });
    res.clearCookie("refreshToken", {
        secure: isProduction,
        httpOnly: true,
        sameSite: "none"
    });

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Logged out successfully!",
        data: null
    });
});

// ─── Refresh Token ────────────────────────────────────────────────────────────

const refreshToken = catchAsync(async (req: Request, res: Response) => {
    const { refreshToken } = req.cookies;

    const result = await AuthService.refreshToken(refreshToken);

    res.cookie("accessToken", result.accessToken, {
        secure: isProduction,
        httpOnly: true,
        sameSite: "none",
        maxAge: parseJwtDuration(config.jwt.expires_in as string, "1h"),
    });

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Access token generated successfully!",
        data: {
            accessToken: result.accessToken
        }
    });
});

// ─── Change Password ──────────────────────────────────────────────────────────

const changePassword = catchAsync(
    async (req: Request & { user?: any }, res: Response) => {
        const user = req.user;
        const result = await AuthService.changePassword(user, req.body);

        sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: "Password changed successfully",
            data: result
        });
    }
);

// ─── Forgot Password ──────────────────────────────────────────────────────────

const forgotPassword = catchAsync(async (req: Request, res: Response) => {
    await AuthService.forgotPassword(req.body);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "If this email is registered, a reset link has been sent.",
        data: null
    });
});

// ─── Reset Password ───────────────────────────────────────────────────────────

const resetPassword = catchAsync(async (req: Request, res: Response) => {
    const token = req.headers.authorization || "";

    await AuthService.resetPassword(token, req.body);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Password reset successfully!",
        data: null
    });
});

// ─── Get Me ───────────────────────────────────────────────────────────────────

const getMe = catchAsync(async (req: Request, res: Response) => {
    const userSession = req.cookies;
    const result = await AuthService.getMe(userSession);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "User retrieved successfully!",
        data: result
    });
});

export const AuthController = {
    register,
    login,
    logout,
    refreshToken,
    changePassword,
    forgotPassword,
    resetPassword,
    getMe
};
