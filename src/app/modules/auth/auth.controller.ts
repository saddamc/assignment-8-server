import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { AuthService } from "./auth.service";
import httpStatus from "http-status";
import config from "../../../config";
import axios from "axios";

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

const sendSmsOtp = catchAsync(async (req: Request, res: Response) => {
    const result = await AuthService.sendSmsOtp(req.body);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "OTP verification code sent successfully!",
        data: result
    });
});

const verifySmsOtp = catchAsync(async (req: Request, res: Response) => {
    const result = await AuthService.verifySmsOtp(req.body);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Mobile number verified successfully!",
        data: result
    });
});

const sendEmailOtp = catchAsync(async (req: Request, res: Response) => {
    const result = await AuthService.sendEmailOtp(req.body);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Email verification code sent successfully!",
        data: result
    });
});

const sendLoginEmailOtp = catchAsync(async (req: Request, res: Response) => {
    const result = await AuthService.sendLoginEmailOtp(req.body);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Login code sent successfully!",
        data: result
    });
});

const verifyEmailOtp = catchAsync(async (req: Request, res: Response) => {
    const result = await AuthService.verifyEmailOtp(req.body);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Email verified successfully!",
        data: result
    });
});

const loginWithEmailOtp = catchAsync(async (req: Request, res: Response) => {
    const result = await AuthService.loginWithEmailOtp(req.body);
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
        message: "Logged in successfully!",
        data: { accessToken, refreshToken }
    });
});

const loginWithOtp = catchAsync(async (req: Request, res: Response) => {
    const result = await AuthService.loginWithOtp(req.body);
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
        message: "Logged in successfully!",
        data: { accessToken, refreshToken }
    });
});

const googleInitiate = catchAsync(async (req: Request, res: Response) => {
    const client_id = config.google.client_id;
    if (!client_id) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: "Google OAuth client_id is not configured in the server .env!"
        });
    }

    const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";
    const options = {
        redirect_uri: "http://localhost:5000/api/v1/auth/google/callback",
        client_id,
        access_type: "offline",
        response_type: "code",
        prompt: "consent",
        scope: [
            "https://www.googleapis.com/auth/userinfo.profile",
            "https://www.googleapis.com/auth/userinfo.email"
        ].join(" ")
    };
    const qs = new URLSearchParams(options);
    res.redirect(`${rootUrl}?${qs.toString()}`);
});

const googleCallback = catchAsync(async (req: Request, res: Response) => {
    const code = req.query.code as string;
    const client_id = config.google.client_id;
    const client_secret = config.google.client_secret;
    const frontend_url = config.frontend_url || config.client_url || "http://localhost:3000";

    if (!code) {
        return res.redirect(`${frontend_url}/login?error=Google OAuth code not received`);
    }

    try {
        // 1. Exchange OAuth code for Google Token
        const tokenUrl = "https://oauth2.googleapis.com/token";
        const tokenValues = {
            code,
            client_id: client_id || "",
            client_secret: client_secret || "",
            redirect_uri: "http://localhost:5000/api/v1/auth/google/callback",
            grant_type: "authorization_code"
        };

        const tokenRes = await axios.post(tokenUrl, new URLSearchParams(tokenValues), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" }
        });

        const { access_token } = tokenRes.data;

        // 2. Fetch User Profile from Google
        const googleUserRes = await axios.get(
            `https://www.googleapis.com/oauth2/v2/userinfo?alt=json&access_token=${access_token}`,
            { headers: { Authorization: `Bearer ${access_token}` } }
        );

        const { email, name } = googleUserRes.data;

        // 3. Authenticate or Register User
        const result = await AuthService.googleLoginOrRegister({ email, name });
        const { accessToken, refreshToken } = result;

        // 4. Set cookies
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

        // 5. Redirect browser back to Frontend callback route
        res.redirect(`${frontend_url}/oauth-callback?accessToken=${accessToken}&refreshToken=${refreshToken}`);
    } catch (error: any) {
        console.error("Google OAuth error:", error);
        res.redirect(`${frontend_url}/login?error=Google authentication failed`);
    }
});

export const AuthController = {
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
    loginWithEmailOtp,
    loginWithOtp,
    googleInitiate,
    googleCallback
};
