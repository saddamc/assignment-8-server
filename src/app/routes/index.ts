import express from 'express';
import { userRoutes } from '../modules/user/user.routes';
import { authRoutes } from '../modules/auth/auth.routes';
import { productRoutes } from '../modules/product/product.routes';
import { cartRoutes } from '../modules/cart/cart.routes';
import { orderRoutes } from '../modules/order/order.routes';
import { paymentRoutes } from '../modules/payment/payment.routes';
import { wishlistRoutes } from '../modules/wishlist/wishlist.routes';
import { analyticsRoutes } from '../modules/analytics/analytics.routes';
import { addressRoutes } from '../modules/address/address.routes';
import { reviewRoutes } from '../modules/review/review.routes';
import { notificationRoutes } from '../modules/notification/notification.routes';
import { payoutRoutes } from '../modules/payout/payout.routes';
import { couponRoutes } from '../modules/coupon/coupon.routes';
import { bannerRoutes } from '../modules/banner/banner.routes';
import { siteConfigRoutes } from '../modules/site-config/siteConfig.routes';
import { productApprovalRoutes } from '../modules/product-approval/productApproval.routes';
import { adminRoutes } from '../modules/admin/admin.routes';
import { SellerShippingRoutes } from '../modules/seller-shipping/sellerShipping.routes';


const router = express.Router();

const moduleRoutes = [
    { path: '/user', route: userRoutes },
    { path: '/auth', route: authRoutes },
    { path: '/products', route: productRoutes },
    { path: '/cart', route: cartRoutes },
    { path: '/orders', route: orderRoutes },
    { path: '/payments', route: paymentRoutes },
    { path: '/wishlist', route: wishlistRoutes },
    { path: '/analytics', route: analyticsRoutes },
    { path: '/address', route: addressRoutes },
    { path: '/reviews', route: reviewRoutes },
    { path: '/notifications', route: notificationRoutes },
    { path: '/payout', route: payoutRoutes },
    { path: '/coupon', route: couponRoutes },
    { path: '/banners', route: bannerRoutes },
    { path: '/config', route: siteConfigRoutes },
    { path: '/product-approval', route: productApprovalRoutes },
    { path: '/admin', route: adminRoutes },
    { path: '/seller-shipping', route: SellerShippingRoutes },
];

moduleRoutes.forEach(route => router.use(route.path, route.route))

export default router;

