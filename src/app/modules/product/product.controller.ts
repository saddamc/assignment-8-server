import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import { ProductService } from "./product.service";
import sendResponse from "../../shared/sendResponse";
import pick from "../../helper/pick";
import { brandFilterableFields, categoryFilterableFields, productFilterableFields, sellerProductFilterableFields } from "./product.constant";
import httpStatus from "http-status";
import { getParamAsString } from "../../helper/getParam";

// ===================== CATEGORY =====================

const createCategory = catchAsync(async (req: Request, res: Response) => {
    const result = await ProductService.createCategory(req.body);
    sendResponse(res, { statusCode: 201, success: true, message: "Category created successfully!", data: result });
});

const getCategoryTree = catchAsync(async (_req: Request, res: Response) => {
    const result = await ProductService.getCategoryTree();
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Category tree retrieved!", data: result });
});

const getSubcategories = catchAsync(async (req: Request, res: Response) => {
    const parentId = getParamAsString(req.params.parentId, "parentId");
    const result = await ProductService.getSubcategories(parentId);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Subcategories retrieved!", data: result });
});

const getAllCategories = catchAsync(async (req: Request, res: Response) => {
    const filters = pick(req.query, categoryFilterableFields);
    const options = pick(req.query, ["page", "limit", "sortBy", "sortOrder"]);
    const result = await ProductService.getAllCategories(filters, options);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Categories retrieved successfully!", meta: result.meta, data: result.data });
});

const getCategoryById = catchAsync(async (req: Request, res: Response) => {
    const id = getParamAsString(req.params.id, "id");
    const result = await ProductService.getCategoryById(id);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Category retrieved successfully!", data: result });
});

const updateCategory = catchAsync(async (req: Request, res: Response) => {
    const id = getParamAsString(req.params.id, "id");
    const result = await ProductService.updateCategory(id, req.body);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Category updated successfully!", data: result });
});

const deleteCategory = catchAsync(async (req: Request, res: Response) => {
    const id = getParamAsString(req.params.id, "id");
    const result = await ProductService.deleteCategory(id);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Category deleted successfully!", data: result });
});

// ===================== BRAND =====================

const createBrand = catchAsync(async (req: Request, res: Response) => {
    const result = await ProductService.createBrand(req.body);
    sendResponse(res, { statusCode: 201, success: true, message: "Brand created successfully!", data: result });
});

const getAllBrands = catchAsync(async (req: Request, res: Response) => {
    const filters = pick(req.query, brandFilterableFields);
    const options = pick(req.query, ["page", "limit", "sortBy", "sortOrder"]);
    const result = await ProductService.getAllBrands(filters, options);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Brands retrieved successfully!", meta: result.meta, data: result.data });
});

const getBrandById = catchAsync(async (req: Request, res: Response) => {
    const id = getParamAsString(req.params.id, "id");
    const result = await ProductService.getBrandById(id);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Brand retrieved successfully!", data: result });
});

const updateBrand = catchAsync(async (req: Request, res: Response) => {
    const id = getParamAsString(req.params.id, "id");
    const result = await ProductService.updateBrand(id, req.body);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Brand updated successfully!", data: result });
});

const deleteBrand = catchAsync(async (req: Request, res: Response) => {
    const id = getParamAsString(req.params.id, "id");
    const result = await ProductService.deleteBrand(id);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Brand deleted successfully!", data: result });
});

// ===================== PRODUCT =====================

const createProduct = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const result = await ProductService.createProduct(user, req);

    sendResponse(res, {
        statusCode: 201,
        success: true,
        message: "Product created successfully!",
        data: result
    });
});

const getAllProducts = catchAsync(async (req: Request, res: Response) => {
    const filters = pick(req.query, productFilterableFields);
    const options = pick(req.query, ["page", "limit", "sortBy", "sortOrder"]);

    const result = await ProductService.getAllProducts(filters, options);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Products retrieved successfully!",
        meta: result.meta,
        data: result.data
    });
});

const getSellerProducts = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const filters = pick(req.query, sellerProductFilterableFields);
    const options = pick(req.query, ["page", "limit", "sortBy", "sortOrder"]);
    const result = await ProductService.getSellerProducts(user.email, filters, options);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Seller products retrieved!", meta: result.meta, data: result.data });
});

const getProductById = catchAsync(async (req: Request, res: Response) => {
    const id = getParamAsString(req.params.id, "id");
    const result = await ProductService.getProductById(id);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Product retrieved successfully!",
        data: result
    });
});

const updateProduct = catchAsync(async (req: Request, res: Response) => {
    const id = getParamAsString(req.params.id, "id");
    const user = req.user!;
    const result = await ProductService.updateProduct(id, user, req);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Product updated successfully!",
        data: result
    });
});

const deleteProduct = catchAsync(async (req: Request, res: Response) => {
    const id = getParamAsString(req.params.id, "id");
    const user = req.user!;
    const result = await ProductService.deleteProduct(id, user);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Product deleted successfully!",
        data: result
    });
});

// ===================== VARIANTS =====================

const createVariant = catchAsync(async (req: Request, res: Response) => {
    const productId = getParamAsString(req.params.id, "id");
    const user = req.user!;
    const result = await ProductService.createVariant(productId, user, req.body);
    sendResponse(res, { statusCode: 201, success: true, message: "Variant created!", data: result });
});

const updateVariant = catchAsync(async (req: Request, res: Response) => {
    const productId = getParamAsString(req.params.id, "id");
    const variantId = getParamAsString(req.params.variantId, "variantId");
    const user = req.user!;
    const result = await ProductService.updateVariant(variantId, productId, user, req.body);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Variant updated!", data: result });
});

const deleteVariant = catchAsync(async (req: Request, res: Response) => {
    const productId = getParamAsString(req.params.id, "id");
    const variantId = getParamAsString(req.params.variantId, "variantId");
    const user = req.user!;
    const result = await ProductService.deleteVariant(variantId, productId, user);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Variant deleted!", data: result });
});

// ===================== REVIEW =====================

const createReview = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const result = await ProductService.createReview(user, req.body);

    sendResponse(res, {
        statusCode: 201,
        success: true,
        message: "Review created successfully!",
        data: result
    });
});

const getProductReviews = catchAsync(async (req: Request, res: Response) => {
    const productId = getParamAsString(req.params.productId, "productId");
    const result = await ProductService.getProductReviews(productId);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Reviews retrieved successfully!",
        data: result
    });
});

export const ProductController = {
    // Category
    createCategory,
    getAllCategories,
    getCategoryById,
    updateCategory,
    deleteCategory,
    getCategoryTree,
    getSubcategories,
    // Brand
    createBrand,
    getAllBrands,
    getBrandById,
    updateBrand,
    deleteBrand,
    // Product
    createProduct,
    getAllProducts,
    getSellerProducts,
    getProductById,
    updateProduct,
    deleteProduct,
    // Variants
    createVariant,
    updateVariant,
    deleteVariant,
    // Review
    createReview,
    getProductReviews
}
