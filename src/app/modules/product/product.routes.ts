import express from 'express';
import { ProductController } from './product.controller';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import validateRequest from '../../middlewares/validateRequest';
import { ProductValidation } from './product.validation';
import { fileUploader } from '../../helper/fileUploader';

const router = express.Router();

// ===================== CATEGORY ROUTES =====================

router.get('/categories/tree', ProductController.getCategoryTree);
router.get('/categories/:parentId/subcategories', ProductController.getSubcategories);

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

router.get(
    '/my-products',
    auth(UserRole.SELLER, UserRole.ADMIN),
    ProductController.getSellerProducts
);

router.post(
    '/',
    auth(UserRole.SELLER, UserRole.ADMIN),
    fileUploader.upload.array('images', 10),
    ProductController.createProduct
);

router.get('/', ProductController.getAllProducts);
router.get('/:id', ProductController.getProductById);

router.patch(
    '/:id',
    auth(UserRole.SELLER, UserRole.ADMIN),
    fileUploader.upload.array('images', 10),
    ProductController.updateProduct
);

router.delete('/:id', auth(UserRole.SELLER, UserRole.ADMIN), ProductController.deleteProduct);

// ===================== VARIANT ROUTES =====================

router.post('/:id/variants', auth(UserRole.SELLER, UserRole.ADMIN), ProductController.createVariant);
router.patch('/:id/variants/:variantId', auth(UserRole.SELLER, UserRole.ADMIN), ProductController.updateVariant);
router.delete('/:id/variants/:variantId', auth(UserRole.SELLER, UserRole.ADMIN), ProductController.deleteVariant);

// ===================== REVIEW ROUTES =====================

router.post(
    '/reviews',
    auth(UserRole.CUSTOMER),
    validateRequest(ProductValidation.createReviewValidationSchema),
    ProductController.createReview
);

router.get('/:productId/reviews', ProductController.getProductReviews);

export const productRoutes = router;
