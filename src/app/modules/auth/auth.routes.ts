import express from 'express';
import { AuthController } from './auth.controller';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import validateRequest from '../../middlewares/validateRequest';
import { AuthValidation } from './auth.validation';

const router = express.Router();

// Public routes
router.post(
    "/register",
    validateRequest(AuthValidation.registerValidationSchema),
    AuthController.register
);

router.post(
    "/login",
    validateRequest(AuthValidation.loginValidationSchema),
    AuthController.login
);

router.post(
    "/logout",
    AuthController.logout
);

router.post(
    "/refresh-token",
    AuthController.refreshToken
);

router.post(
    "/forgot-password",
    validateRequest(AuthValidation.forgotPasswordValidationSchema),
    AuthController.forgotPassword
);

router.post(
    "/reset-password",
    validateRequest(AuthValidation.resetPasswordValidationSchema),
    AuthController.resetPassword
);

router.post(
    "/send-sms-otp",
    validateRequest(AuthValidation.sendSmsOtpValidationSchema),
    AuthController.sendSmsOtp
);

router.post(
    "/verify-sms-otp",
    validateRequest(AuthValidation.verifySmsOtpValidationSchema),
    AuthController.verifySmsOtp
);

router.post(
    "/send-email-otp",
    validateRequest(AuthValidation.sendEmailOtpValidationSchema),
    AuthController.sendEmailOtp
);

router.post(
    "/verify-email-otp",
    validateRequest(AuthValidation.verifyEmailOtpValidationSchema),
    AuthController.verifyEmailOtp
);

router.post(
    "/send-login-email-otp",
    validateRequest(AuthValidation.sendEmailOtpValidationSchema),
    AuthController.sendLoginEmailOtp
);

router.post(
    "/login-with-email-otp",
    validateRequest(AuthValidation.loginWithEmailOtpValidationSchema),
    AuthController.loginWithEmailOtp
);

router.post(
    "/login-with-otp",
    AuthController.loginWithOtp
);

// Protected routes
router.post(
    "/change-password",
    auth(UserRole.ADMIN, UserRole.CUSTOMER, UserRole.SELLER),
    validateRequest(AuthValidation.changePasswordValidationSchema),
    AuthController.changePassword
);

router.get(
    "/google",
    AuthController.googleInitiate
);

router.get(
    "/google/callback",
    AuthController.googleCallback
);

router.get(
    "/me",
    AuthController.getMe
);

export const authRoutes = router;
