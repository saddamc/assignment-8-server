import express from 'express';
import { CouponController } from './coupon.controller';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';

const router = express.Router();

router.post('/validate', CouponController.validateCoupon);
router.get('/my-coupons', auth(UserRole.SELLER, UserRole.ADMIN), CouponController.getMyCoupons);
router.post('/', auth(UserRole.SELLER, UserRole.ADMIN), CouponController.createCoupon);
router.patch('/:id', auth(UserRole.SELLER, UserRole.ADMIN), CouponController.updateCoupon);
router.delete('/:id', auth(UserRole.SELLER, UserRole.ADMIN), CouponController.deleteCoupon);

export const couponRoutes = router;
