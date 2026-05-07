import express from 'express';
import { ProductApprovalController } from './productApproval.controller';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';

const router = express.Router();

// Admin routes
router.get('/pending',                          auth(UserRole.ADMIN), ProductApprovalController.getPendingProducts);
router.patch('/:productId/review',              auth(UserRole.ADMIN), ProductApprovalController.reviewProduct);
router.patch('/:productId/disable',             auth(UserRole.ADMIN), ProductApprovalController.disableProduct);
router.patch('/trust/:sellerEmail',             auth(UserRole.ADMIN), ProductApprovalController.updateTrustSettings);

// Seller routes
router.post('/:productId/submit',               auth(UserRole.SELLER), ProductApprovalController.submitForReview);

export const productApprovalRoutes = router;
