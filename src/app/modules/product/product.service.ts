import { Prisma, ProductStatus } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { IOptions, paginationHelper } from "../../helper/paginationHelper";
import { productSearchableFields, sellerProductFilterableFields } from "./product.constant";
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

// Hierarchical tree: top-level categories with nested children/grandchildren
const getCategoryTree = async () => {
    const allCategories = await prisma.category.findMany({
        orderBy: { name: "asc" },
        include: {
            _count: { select: { products: true } }
        }
    });

    type CatNode = typeof allCategories[0] & { children: CatNode[] };
    const map = new Map<string, CatNode>();
    allCategories.forEach(c => map.set(c.id, { ...c, children: [] }));

    const roots: CatNode[] = [];
    map.forEach(c => {
        if (c.parentId) {
            map.get(c.parentId)?.children.push(c);
        } else {
            roots.push(c);
        }
    });
    return roots;
};

const getSubcategories = async (parentId: string) => {
    return prisma.category.findMany({
        where: { parentId },
        orderBy: { name: "asc" },
        include: { _count: { select: { products: true } } }
    });
};

const getAllCategories = async (params: any, options: IOptions) => {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(options);
    const { searchTerm, parentId } = params;

    const where: Prisma.CategoryWhereInput = {
        ...(searchTerm ? { OR: [{ name: { contains: searchTerm, mode: "insensitive" } }, { description: { contains: searchTerm, mode: "insensitive" } }] } : {}),
        ...(parentId !== undefined ? { parentId: parentId === "null" ? null : parentId } : {}),
    };

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
    // Verify seller profile exists in sellers table (not just users table)
    const sellerProfile = await prisma.seller.findUnique({ where: { email: user.email } });
    if (!sellerProfile) {
        throw new ApiError(
            httpStatus.FORBIDDEN,
            'Seller profile not found. Please complete your seller registration before adding products.'
        );
    }

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

    // Verify categories exist only when provided
    if (req.body.categoryId) {
        await prisma.category.findUniqueOrThrow({ where: { id: req.body.categoryId } });
    }
    if (req.body.subCategoryId) {
        await prisma.category.findUniqueOrThrow({ where: { id: req.body.subCategoryId } });
    }
    if (req.body.childCategoryId) {
        await prisma.category.findUniqueOrThrow({ where: { id: req.body.childCategoryId } });
    }

    // Auto-generate slug from name
    const baseSlug = generateSlug(req.body.name);
    let slug = baseSlug;
    let slugSuffix = 1;
    while (await prisma.product.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${slugSuffix++}`;
    }

    // Auto-generate SKU if not provided
    const sku = req.body.sku || `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const productData = {
        name: req.body.name,
        slug,
        shortDescription: req.body.shortDescription || undefined,
        description: req.body.description,
        price: Number(req.body.price),
        discountPrice: req.body.discountPrice ? Number(req.body.discountPrice) : undefined,
        discount: Number(req.body.discount) || 0,
        sku,
        stock: Number(req.body.stock) || 0,
        status: (req.body.status as ProductStatus) || ProductStatus.DRAFT,
        categoryId: req.body.categoryId || undefined,
        subCategoryId: req.body.subCategoryId || undefined,
        childCategoryId: req.body.childCategoryId || undefined,
        brandId: req.body.brandId || undefined,
        sellerEmail: user.email,
        seoTitle: req.body.seoTitle || undefined,
        seoDescription: req.body.seoDescription || undefined,
        seoKeywords: req.body.seoKeywords ? JSON.parse(req.body.seoKeywords) : [],
        images
    };

    const result = await prisma.$transaction(async (tnx) => {
        const product = await tnx.product.create({
            data: productData,
            include: {
                category: true,
                subCategory: true,
                childCategory: true,
                brand: true,
                seller: { select: { id: true, name: true, storeName: true, email: true, autoApproveProducts: true, trustScore: true } }
            }
        });

        // If submitted as PENDING, create an approval record
        if (productData.status === ProductStatus.PENDING) {
            // Trusted seller: auto-approve immediately
            if (sellerProfile.autoApproveProducts && sellerProfile.isApproved) {
                await tnx.product.update({
                    where: { id: product.id },
                    data: { status: ProductStatus.PUBLISHED, isPublished: true }
                });
                await tnx.productApproval.create({
                    data: {
                        productId:  product.id,
                        status:     'APPROVED',
                        reviewedBy: 'system:auto-approve',
                        reviewNote: 'Auto-approved: trusted seller',
                        reviewedAt: new Date(),
                        submittedAt: new Date(),
                    }
                });
                await tnx.productApprovalHistory.create({
                    data: {
                        productId:  product.id,
                        status:     'APPROVED',
                        reviewedBy: 'system:auto-approve',
                        reviewNote: 'Auto-approved: trusted seller',
                    }
                });
            } else {
                // Normal seller: queue for manual review
                await tnx.productApproval.create({
                    data: { productId: product.id, status: 'PENDING', submittedAt: new Date() }
                });
            }
        }

        return product;
    });

    return result;
};

const getAllProducts = async (params: any, options: IOptions, adminView = false) => {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(options);
    const { searchTerm, categoryId, categorySlug, brandId, brandSlug, sellerEmail, minPrice, maxPrice, minRating, inStock, ...filterData } = params;

    const andConditions: Prisma.ProductWhereInput[] = [];

    // Always exclude deleted products
    andConditions.push({ isDeleted: false });

    // Public listing: only show published products
    if (!adminView) {
        andConditions.push({ isPublished: true });
    }

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

// ===================== SELLER PRODUCTS =====================

const getSellerProducts = async (sellerEmail: string, params: any, options: IOptions) => {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(options);
    const { searchTerm, status, categoryId, inStock } = params;

    const andConditions: Prisma.ProductWhereInput[] = [
        { sellerEmail },
        { isDeleted: false }
    ];

    if (searchTerm) {
        andConditions.push({
            OR: productSearchableFields.map(field => ({
                [field]: { contains: searchTerm, mode: "insensitive" }
            }))
        });
    }
    if (status) andConditions.push({ status: status as ProductStatus });
    if (categoryId) andConditions.push({ categoryId });
    if (inStock === "true") andConditions.push({ stock: { gt: 0 } });

    const where: Prisma.ProductWhereInput = { AND: andConditions };

    const [data, total] = await Promise.all([
        prisma.product.findMany({
            where,
            skip,
            take: limit,
            orderBy: { [sortBy || "createdAt"]: sortOrder || "desc" },
            include: {
                category: true,
                subCategory: true,
                brand: true,
                variants: true,
                approval: true,
                _count: { select: { reviews: true, orderItems: true } }
            }
        }),
        prisma.product.count({ where })
    ]);

    return { meta: { page, limit, total }, data };
};

// ===================== VARIANTS =====================

const createVariant = async (productId: string, user: IJWTPayload, payload: {
    sku?: string; size?: string; color?: string; stock: number; price?: number;
}) => {
    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    if (user.role !== "ADMIN" && product.sellerEmail !== user.email) {
        throw new ApiError(httpStatus.FORBIDDEN, "You can only add variants to your own products");
    }
    const sku = payload.sku || `VAR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    return prisma.productVariant.create({
        data: { ...payload, sku, productId }
    });
};

const updateVariant = async (variantId: string, productId: string, user: IJWTPayload, payload: {
    sku?: string; size?: string; color?: string; stock?: number; price?: number;
}) => {
    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    if (user.role !== "ADMIN" && product.sellerEmail !== user.email) {
        throw new ApiError(httpStatus.FORBIDDEN, "You can only update variants of your own products");
    }
    return prisma.productVariant.update({ where: { id: variantId }, data: payload });
};

const deleteVariant = async (variantId: string, productId: string, user: IJWTPayload) => {
    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    if (user.role !== "ADMIN" && product.sellerEmail !== user.email) {
        throw new ApiError(httpStatus.FORBIDDEN, "You can only delete variants of your own products");
    }
    return prisma.productVariant.delete({ where: { id: variantId } });
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
