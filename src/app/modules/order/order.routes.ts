import express from 'express';
import { OrderController } from './order.controller';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import validateRequest from '../../middlewares/validateRequest';
import { OrderValidation } from './order.validation';

const router = express.Router();

// Customer creates order from cart
router.post(
    '/',
    auth(UserRole.CUSTOMER),
    validateRequest(OrderValidation.createOrderValidationSchema),
    OrderController.createOrder
);

// Customer gets their own orders
router.get(
    '/my-orders',
    auth(UserRole.CUSTOMER),
    OrderController.getMyOrders
);

// Admin gets all orders
router.get(
    '/',
    auth(UserRole.ADMIN),
    OrderController.getAllOrders
);

// Customer or Admin gets order by id
router.get(
    '/:id',
    auth(UserRole.CUSTOMER, UserRole.ADMIN),
    OrderController.getOrderById
);

// Admin updates order status
router.patch(
    '/:id/status',
    auth(UserRole.ADMIN, UserRole.SELLER),
    validateRequest(OrderValidation.updateOrderStatusValidationSchema),
    OrderController.updateOrderStatus
);

export const orderRoutes = router;
