import express from 'express';
import { userRoutes } from '../modules/user/user.routes';
import { authRoutes } from '../modules/auth/auth.routes';
import { productRoutes } from '../modules/product/product.routes';
import { cartRoutes } from '../modules/cart/cart.routes';
import { orderRoutes } from '../modules/order/order.routes';
import { paymentRoutes } from '../modules/payment/payment.routes';
import { wishlistRoutes } from '../modules/wishlist/wishlist.routes';
import { analyticsRoutes } from '../modules/analytics/analytics.routes';


const router = express.Router();

const moduleRoutes = [
    {
        path: '/user',
        route: userRoutes
    },
    {
        path: '/auth',
        route: authRoutes
    },
    {
        path: '/products',
        route: productRoutes
    },
    {
        path: '/cart',
        route: cartRoutes
    },
    {
        path: '/orders',
        route: orderRoutes
    },
    {
        path: '/payments',
        route: paymentRoutes
    },
    {
        path: '/wishlist',
        route: wishlistRoutes
    },
    {
        path: '/analytics',
        route: analyticsRoutes
    },
];

moduleRoutes.forEach(route => router.use(route.path, route.route))

export default router;
