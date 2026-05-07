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

// Protected routes
router.post(
    "/change-password",
    auth(UserRole.ADMIN, UserRole.CUSTOMER, UserRole.SELLER),
    validateRequest(AuthValidation.changePasswordValidationSchema),
    AuthController.changePassword
);

router.get(
    "/me",
    AuthController.getMe
);

export const authRoutes = router;
