import express from 'express';
import { PaymentController } from './payment.controller';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';

const router = express.Router();

// Create payment intent for an order
router.post(
    '/create-payment-intent',
    auth(UserRole.CUSTOMER),
    PaymentController.createPaymentIntent
);

// Create Stripe Checkout Session (redirects to Stripe-hosted checkout page)
router.post(
    '/create-checkout-session',
    auth(UserRole.CUSTOMER),
    PaymentController.createCheckoutSession
);

// Manually complete payment for development/testing
router.post(
    '/complete-payment/:orderId',
    auth(UserRole.ADMIN), // Only admin can manually complete payments
    PaymentController.completePaymentManually
);

// Get payment details for an order
// Verify Stripe checkout session and mark order as paid (called from success page)
router.post(
    '/verify-session/:sessionId',
    auth(UserRole.CUSTOMER, UserRole.ADMIN),
    PaymentController.verifyStripeSession
);

router.get(
    '/:orderId',
    auth(UserRole.CUSTOMER, UserRole.ADMIN),
    PaymentController.getPaymentsByOrder
);

export const paymentRoutes = router;
