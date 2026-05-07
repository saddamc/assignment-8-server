import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { IOptions, paginationHelper } from "../../helper/paginationHelper";
import { productSearchableFields } from "./product.constant";
import { fileUploader } from "../../helper/fileUploader";
import { Request } from "express";
import ApiError from "../../errors/ApiError";
import httpStatus from "http-status";
import { IJWTPayload } from "../../types/common";

// ===================== CATEGORY =====================

const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const createCategory = async (payload: { name: string; slug?: string; image?: string; description?: string }) => {
    const slug = payload.slug || generateSlug(payload.name);
    const result = await prisma.category.create({
        data: { ...payload, slug }
    });
    return result;
};

const getAllCategories = async (params: any, options: IOptions) => {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(options);
    const { searchTerm } = params;

    const where: Prisma.CategoryWhereInput = searchTerm
        ? { OR: [{ name: { contains: searchTerm, mode: "insensitive" } }, { description: { contains: searchTerm, mode: "insensitive" } }] }
        : {};

    const [data, total] = await Promise.all([
        prisma.category.findMany({
            where,
            skip,
            take: limit,
            orderBy: { [sortBy || "createdAt"]: sortOrder || "desc" },
            include: { _count: { select: { products: true } } }
        }),
        prisma.category.count({ where })
    ]);

    return { meta: { page, limit, total }, data };
};

const getCategoryById = async (id: string) => {
    return prisma.category.findUniqueOrThrow({
        where: { id },
        include: { _count: { select: { products: true } } }
    });
};

const updateCategory = async (id: string, payload: { name?: string; slug?: string; image?: string; description?: string }) => {
    const data: any = { ...payload };
    if (payload.name && !payload.slug) {
        data.slug = generateSlug(payload.name);
    }
    return prisma.category.update({ where: { id }, data });
};

const deleteCategory = async (id: string) => {
    return prisma.category.delete({ where: { id } });
};

// ===================== BRAND =====================

const createBrand = async (payload: { name: string; slug?: string; logo?: string; description?: string }) => {
    const slug = payload.slug || generateSlug(payload.name);
    return prisma.brand.create({ data: { ...payload, slug } });
};

const getAllBrands = async (params: any, options: IOptions) => {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(options);
    const { searchTerm } = params;

    const where: Prisma.BrandWhereInput = searchTerm
        ? { OR: [{ name: { contains: searchTerm, mode: "insensitive" } }, { description: { contains: searchTerm, mode: "insensitive" } }] }
        : {};

    const [data, total] = await Promise.all([
        prisma.brand.findMany({
            where,
            skip,
            take: limit,
            orderBy: { [sortBy || "name"]: sortOrder || "asc" },
            include: { _count: { select: { products: true } } }
        }),
        prisma.brand.count({ where })
    ]);

    return { meta: { page, limit, total }, data };
};

const getBrandById = async (id: string) => {
    return prisma.brand.findUniqueOrThrow({
        where: { id },
        include: { _count: { select: { products: true } } }
    });
};

const updateBrand = async (id: string, payload: { name?: string; slug?: string; logo?: string; description?: string }) => {
    const data: any = { ...payload };
    if (payload.name && !payload.slug) {
        data.slug = generateSlug(payload.name);
    }
    return prisma.brand.update({ where: { id }, data });
};

const deleteBrand = async (id: string) => {
    return prisma.brand.delete({ where: { id } });
};

// ===================== PRODUCT =====================

const createProduct = async (user: IJWTPayload, req: Request) => {
    const files = req.files as Express.Multer.File[];
    const images: string[] = [];

    if (files && files.length > 0) {
        for (const file of files) {
            const uploadResult = await fileUploader.uploadToCloudinary(file);
            if (uploadResult?.secure_url) {
                images.push(uploadResult.secure_url);
            }
        }
    }

    // Verify category exists
    await prisma.category.findUniqueOrThrow({
        where: { id: req.body.categoryId }
    });

    const productData = {
        name: req.body.name,
        description: req.body.description,
        price: Number(req.body.price),
        discount: Number(req.body.discount) || 0,
        stock: Number(req.body.stock) || 0,
        categoryId: req.body.categoryId,
        brandId: req.body.brandId || undefined,
        sellerEmail: user.email,
        images
    };

    const result = await prisma.product.create({
        data: productData,
        include: {
            category: true,
            brand: true,
            seller: true
        }
    });

    return result;
};

const getAllProducts = async (params: any, options: IOptions) => {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(options);
    const { searchTerm, categoryId, categorySlug, brandId, brandSlug, sellerEmail, minPrice, maxPrice, minRating, inStock, ...filterData } = params;

    const andConditions: Prisma.ProductWhereInput[] = [];

    // Always exclude deleted products
    andConditions.push({ isDeleted: false });

    if (searchTerm) {
        andConditions.push({
            OR: productSearchableFields.map(field => ({
                [field]: { contains: searchTerm, mode: "insensitive" }
            }))
        });
    }

    if (categoryId) andConditions.push({ categoryId });
    if (categorySlug) andConditions.push({ category: { slug: categorySlug } });
    if (brandId) andConditions.push({ brandId });
    if (brandSlug) andConditions.push({ brand: { slug: brandSlug } });
    if (sellerEmail) andConditions.push({ sellerEmail });

    if (minPrice || maxPrice) {
        const priceCondition: any = {};
        if (minPrice) priceCondition.gte = Number(minPrice);
        if (maxPrice) priceCondition.lte = Number(maxPrice);
        andConditions.push({ price: priceCondition });
    }

    if (inStock === "true") andConditions.push({ stock: { gt: 0 } });

    if (minRating) {
        // Filter by average rating: include products whose avg review rating >= minRating
        andConditions.push({
            reviews: {
                some: {
                    rating: { gte: Number(minRating) }
                }
            }
        });
    }

    if (Object.keys(filterData).length > 0) {
        andConditions.push({
            AND: Object.keys(filterData).map(key => ({
                [key]: { equals: (filterData as any)[key] }
            }))
        });
    }

    const whereConditions: Prisma.ProductWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};

    const result = await prisma.product.findMany({
        skip,
        take: limit,
        where: whereConditions,
        orderBy: {
            [sortBy]: sortOrder
        },
        include: {
            category: true,
            brand: true,
            seller: {
                select: {
                    id: true,
                    name: true,
                    storeName: true,
                    email: true,
                    profilePhoto: true
                }
            },
            reviews: {
                select: {
                    rating: true
                }
            }
        }
    });

    const total = await prisma.product.count({
        where: whereConditions
    });

    return {
        meta: {
            page,
            limit,
            total
        },
        data: result
    };
};

const getProductById = async (id: string) => {
    const result = await prisma.product.findUniqueOrThrow({
        where: { id, isDeleted: false },
        include: {
            category: true,
            brand: true,
            seller: {
                select: {
                    id: true,
                    name: true,
                    storeName: true,
                    email: true,
                    profilePhoto: true
                }
            },
            reviews: {
                include: {
                    customer: {
                        select: {
                            name: true,
                            profilePhoto: true
                        }
                    }
                }
            }
        }
    });
    return result;
};

const updateProduct = async (id: string, user: IJWTPayload, req: Request) => {
    const product = await prisma.product.findUniqueOrThrow({
        where: { id, isDeleted: false }
    });

    // Only the seller who owns the product or admin can update
    if (user.role !== "ADMIN" && product.sellerEmail !== user.email) {
        throw new ApiError(httpStatus.FORBIDDEN, "You can only update your own products!");
    }

    const files = req.files as Express.Multer.File[];
    if (files && files.length > 0) {
        const images: string[] = [];
        for (const file of files) {
            const uploadResult = await fileUploader.uploadToCloudinary(file);
            if (uploadResult?.secure_url) {
                images.push(uploadResult.secure_url);
            }
        }
        req.body.images = images;
    }

    if (req.body.price) req.body.price = Number(req.body.price);
    if (req.body.discount) req.body.discount = Number(req.body.discount);
    if (req.body.stock) req.body.stock = Number(req.body.stock);

    const result = await prisma.product.update({
        where: { id },
        data: req.body,
        include: {
            category: true,
            seller: true
        }
    });

    return result;
};

const deleteProduct = async (id: string, user: IJWTPayload) => {
    const product = await prisma.product.findUniqueOrThrow({
        where: { id }
    });

    // Only the seller who owns the product or admin can delete
    if (user.role !== "ADMIN" && product.sellerEmail !== user.email) {
        throw new ApiError(httpStatus.FORBIDDEN, "You can only delete your own products!");
    }

    const result = await prisma.product.update({
        where: { id },
        data: { isDeleted: true }
    });

    return result;
};

// ===================== REVIEW =====================

const createReview = async (user: IJWTPayload, payload: { rating: number; comment?: string; productId: string }) => {
    // Verify product exists
    await prisma.product.findUniqueOrThrow({
        where: { id: payload.productId, isDeleted: false }
    });

    const result = await prisma.review.create({
        data: {
            rating: payload.rating,
            comment: payload.comment,
            productId: payload.productId,
            customerEmail: user.email
        },
        include: {
            customer: {
                select: {
                    name: true,
                    profilePhoto: true
                }
            }
        }
    });

    return result;
};

const getProductReviews = async (productId: string) => {
    const result = await prisma.review.findMany({
        where: { productId },
        include: {
            customer: {
                select: {
                    name: true,
                    profilePhoto: true
                }
            }
        },
        orderBy: { createdAt: "desc" }
    });
    return result;
};

export const ProductService = {
    // Category
    createCategory,
    getAllCategories,
    getCategoryById,
    updateCategory,
    deleteCategory,
    // Brand
    createBrand,
    getAllBrands,
    getBrandById,
    updateBrand,
    deleteBrand,
    // Product
    createProduct,
    getAllProducts,
    getProductById,
    updateProduct,
    deleteProduct,
    // Review
    createReview,
    getProductReviews
}
