import express from 'express';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import { SellerShippingController } from './sellerShipping.controller';

const router = express.Router();

// Public: get rules for a specific seller (used on product pages)
router.get('/public/:sellerEmail', SellerShippingController.getPublicRules);

// Seller-only: manage own rules
router.get('/', auth(UserRole.SELLER), SellerShippingController.getMyRules);
router.post('/', auth(UserRole.SELLER), SellerShippingController.upsertRule);
router.delete('/:id', auth(UserRole.SELLER), SellerShippingController.deleteRule);

export const SellerShippingRoutes = router;
