import express from 'express';
import { ReviewController } from './review.controller';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import validateRequest from '../../middlewares/validateRequest';
import { ReviewValidation } from './review.validation';

const router = express.Router();

router.get('/my-reviews', auth(UserRole.CUSTOMER), ReviewController.getMyReviews);
router.get('/product/:productId', ReviewController.getProductReviews);
router.post('/product/:productId', auth(UserRole.CUSTOMER), validateRequest(ReviewValidation.createReviewSchema), ReviewController.createReview);
router.patch('/:id', auth(UserRole.CUSTOMER), validateRequest(ReviewValidation.updateReviewSchema), ReviewController.updateReview);
router.delete('/:id', auth(UserRole.CUSTOMER), ReviewController.deleteReview);

// Seller review routes
router.get('/seller/:sellerEmail', ReviewController.getSellerReviews);
router.post('/seller/order/:orderId', auth(UserRole.CUSTOMER), validateRequest(ReviewValidation.createSellerReviewSchema), ReviewController.createSellerReview);
router.get('/my-seller-reviews', auth(UserRole.CUSTOMER), ReviewController.getMySellerReviews);

export const reviewRoutes = router;
