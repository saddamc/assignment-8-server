import express from 'express';
import { PaymentController } from './payment.controller';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';

const router = express.Router();

// Create Stripe Checkout Session (redirects to Stripe-hosted checkout page)
router.post(
    '/create-checkout-session',
    auth(UserRole.CUSTOMER),
    PaymentController.createCheckoutSession
);

// Verify Stripe checkout session (called from success page)
router.post(
    '/verify-session/:sessionId',
    PaymentController.verifyStripeSession
);

// Get all payments (Admin only)
router.get(
    '/',
    auth(UserRole.ADMIN),
    PaymentController.getAllPayments
);

// Get payment details for an order
router.get(
    '/:orderId',
    auth(UserRole.CUSTOMER, UserRole.ADMIN),
    PaymentController.getPaymentsByOrder
);

// Verify bKash/Nagad checkout simulation (called from checkout page)
router.post(
    '/bkash-verify',
    auth(UserRole.CUSTOMER),
    PaymentController.verifyBkashSimulation
);

export const paymentRoutes = router;
