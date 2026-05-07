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

// Get payment details for an order
router.get(
    '/:orderId',
    auth(UserRole.CUSTOMER, UserRole.ADMIN),
    PaymentController.getPaymentsByOrder
);

export const paymentRoutes = router;
