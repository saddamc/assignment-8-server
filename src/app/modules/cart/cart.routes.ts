import express from 'express';
import { CartController } from './cart.controller';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import validateRequest from '../../middlewares/validateRequest';
import { CartValidation } from './cart.validation';

const router = express.Router();

router.get(
    '/',
    auth(UserRole.CUSTOMER),
    CartController.getMyCart
);

router.post(
    '/add',
    auth(UserRole.CUSTOMER),
    validateRequest(CartValidation.addToCartValidationSchema),
    CartController.addToCart
);

router.patch(
    '/:cartItemId',
    auth(UserRole.CUSTOMER),
    validateRequest(CartValidation.updateCartItemValidationSchema),
    CartController.updateCartItem
);

router.delete(
    '/:cartItemId',
    auth(UserRole.CUSTOMER),
    CartController.removeFromCart
);

router.delete(
    '/',
    auth(UserRole.CUSTOMER),
    CartController.clearCart
);

export const cartRoutes = router;
