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

// Get payment details for an order
router.get(
    '/:orderId',
    auth(UserRole.CUSTOMER, UserRole.ADMIN),
    PaymentController.getPaymentsByOrder
);

export const paymentRoutes = router;
