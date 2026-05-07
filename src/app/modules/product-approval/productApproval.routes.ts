import express from 'express';
import { ProductApprovalController } from './productApproval.controller';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';

const router = express.Router();

router.get('/pending', auth(UserRole.ADMIN), ProductApprovalController.getPendingProducts);
router.patch('/:productId/review', auth(UserRole.ADMIN), ProductApprovalController.reviewProduct);
router.post('/:productId/submit', auth(UserRole.SELLER), ProductApprovalController.submitForReview);

export const productApprovalRoutes = router;
