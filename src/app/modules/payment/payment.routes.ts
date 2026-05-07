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

// Get payment details for an order
router.get(
    '/:orderId',
    auth(UserRole.CUSTOMER, UserRole.ADMIN),
    PaymentController.getPaymentsByOrder
);

export const paymentRoutes = router;
