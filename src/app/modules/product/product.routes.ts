import express from 'express';
import { ProductController } from './product.controller';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import validateRequest from '../../middlewares/validateRequest';
import { ProductValidation } from './product.validation';
import { fileUploader } from '../../helper/fileUploader';

const router = express.Router();

// ===================== CATEGORY ROUTES =====================

router.post(
    '/categories',
    auth(UserRole.ADMIN),
    validateRequest(ProductValidation.createCategoryValidationSchema),
    ProductController.createCategory
);

router.get('/categories', ProductController.getAllCategories);
router.get('/categories/:id', ProductController.getCategoryById);

router.patch(
    '/categories/:id',
    auth(UserRole.ADMIN),
    validateRequest(ProductValidation.updateCategoryValidationSchema),
    ProductController.updateCategory
);

router.delete('/categories/:id', auth(UserRole.ADMIN), ProductController.deleteCategory);

// ===================== BRAND ROUTES =====================

router.post(
    '/brands',
    auth(UserRole.ADMIN),
    validateRequest(ProductValidation.createBrandValidationSchema),
    ProductController.createBrand
);

router.get('/brands', ProductController.getAllBrands);
router.get('/brands/:id', ProductController.getBrandById);

router.patch(
    '/brands/:id',
    auth(UserRole.ADMIN),
    validateRequest(ProductValidation.updateBrandValidationSchema),
    ProductController.updateBrand
);

router.delete('/brands/:id', auth(UserRole.ADMIN), ProductController.deleteBrand);

// ===================== PRODUCT ROUTES =====================

router.post(
    '/',
    auth(UserRole.SELLER, UserRole.ADMIN),
    fileUploader.upload.array('images', 5),
    ProductController.createProduct
);

router.get(
    '/',
    ProductController.getAllProducts
);

router.get(
    '/:id',
    ProductController.getProductById
);

router.patch(
    '/:id',
    auth(UserRole.SELLER, UserRole.ADMIN),
    fileUploader.upload.array('images', 5),
    ProductController.updateProduct
);

router.delete(
    '/:id',
    auth(UserRole.SELLER, UserRole.ADMIN),
    ProductController.deleteProduct
);

// ===================== REVIEW ROUTES =====================

router.post(
    '/reviews',
    auth(UserRole.CUSTOMER),
    validateRequest(ProductValidation.createReviewValidationSchema),
    ProductController.createReview
);

router.get(
    '/:productId/reviews',
    ProductController.getProductReviews
);

export const productRoutes = router;
