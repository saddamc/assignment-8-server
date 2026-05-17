import { prisma } from '../../shared/prisma';
import ApiError from '../../errors/ApiError';
import httpStatus from 'http-status';
import { ProductApprovalStatus, ProductStatus } from '@prisma/client';
import { IOptions, paginationHelper } from '../../helper/paginationHelper';

// ── Admin: list pending/all with pagination & filters ─────────────────────────
const getPendingProducts = async (options: IOptions, filters: { status?: string } = {}) => {
    const { skip, page, limit } = paginationHelper.calculatePagination(options);
    const where: any = {};
    if (filters.status) where.status = filters.status as ProductApprovalStatus;
    else where.status = 'PENDING';

    const [data, total] = await prisma.$transaction([
        prisma.productApproval.findMany({
            where,
            include: {
                product: {
                    include: {
                        category:    { select: { id: true, name: true } },
                        brand:       { select: { id: true, name: true } },
                        seller: {
                            select: {
                                id: true, name: true, email: true,
                                storeName: true, profilePhoto: true,
                                isApproved: true, autoApproveProducts: true, trustScore: true
                            }
                        },
                        variants:    { select: { id: true, size: true, color: true, stock: true, price: true } },
                        approvalHistory: { orderBy: { createdAt: 'desc' }, take: 5 }
                    }
                }
            },
            orderBy: { submittedAt: 'asc' },
            skip,
            take: limit,
        }),
        prisma.productApproval.count({ where })
    ]);

    return { meta: { page, limit, total }, data };
};

// ── Admin: approve or reject ───────────────────────────────────────────────────
const reviewProduct = async (
    adminEmail: string,
    productId: string,
    payload: { status: 'APPROVED' | 'REJECTED'; reviewNote?: string }
) => {
    // Verify product exists and is in a reviewable state
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
    if (product.isDeleted) throw new ApiError(httpStatus.GONE, 'Product has been deleted');

    // Check existing approval record — allow missing record (product may pre-date approval system)
    const existing = await prisma.productApproval.findUnique({ where: { productId } });
    if (existing && existing.status !== 'PENDING' && product.status !== 'DISABLED' && product.status !== 'REJECTED') {
        throw new ApiError(httpStatus.BAD_REQUEST, `Product is already ${existing.status.toLowerCase()}`);
    }

    const productStatus: ProductStatus = payload.status === 'APPROVED' ? 'PUBLISHED' : 'REJECTED';

    return prisma.$transaction(async (tnx) => {
        // Upsert the approval record (handles missing rows gracefully)
        const updated = await tnx.productApproval.upsert({
            where: { productId },
            create: {
                productId,
                status:     payload.status,
                reviewedBy: adminEmail,
                reviewNote: payload.reviewNote || null,
                reviewedAt: new Date(),
                submittedAt: new Date(),
            },
            update: {
                status:     payload.status,
                reviewedBy: adminEmail,
                reviewNote: payload.reviewNote || null,
                reviewedAt: new Date(),
            }
        });

        // Sync Product.status and isPublished
        await tnx.product.update({
            where: { id: productId },
            data: {
                status:      productStatus,
                isPublished: payload.status === 'APPROVED',
            }
        });

        // Record in approval history (audit trail)
        await tnx.productApprovalHistory.create({
            data: {
                productId,
                status:     payload.status,
                reviewedBy: adminEmail,
                reviewNote: payload.reviewNote || null,
            }
        });

        return updated;
    });
};

// ── Admin: disable a published product (policy violation) ─────────────────────
const disableProduct = async (adminEmail: string, productId: string, reason?: string) => {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
    if (product.status === 'DISABLED') throw new ApiError(httpStatus.BAD_REQUEST, 'Product is already disabled');

    return prisma.$transaction(async (tnx) => {
        await tnx.product.update({
            where: { id: productId },
            data: { status: 'DISABLED', isPublished: false }
        });

        // Upsert the approval record to reflect disabled state
        await tnx.productApproval.upsert({
            where: { productId },
            create: { productId, status: 'REJECTED', reviewedBy: adminEmail, reviewNote: reason || 'Disabled by admin', reviewedAt: new Date() },
            update: { reviewedBy: adminEmail, reviewNote: reason || 'Disabled by admin', reviewedAt: new Date() }
        });

        // Audit history
        await tnx.productApprovalHistory.create({
            data: {
                productId,
                status:     'REJECTED',
                reviewedBy: adminEmail,
                reviewNote: reason ? `[DISABLED] ${reason}` : '[DISABLED] Policy violation',
            }
        });
    });
};

// ── Seller: submit DRAFT or REJECTED product for review ───────────────────────
const submitForReview = async (sellerEmail: string, productId: string) => {
    const product = await prisma.product.findFirst({ where: { id: productId, sellerEmail } });
    if (!product) throw new ApiError(httpStatus.NOT_FOUND, 'Product not found or not yours');

    const seller = await prisma.seller.findUnique({ where: { email: sellerEmail } });
    if (!seller) throw new ApiError(httpStatus.NOT_FOUND, 'Seller not found');

    if (product.status === 'PUBLISHED') {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Product is already published');
    }
    if (product.status === 'DISABLED') {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Disabled products cannot be resubmitted. Contact support.');
    }
    if (product.status === 'PENDING') {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Product is already under review');
    }

    const shouldAutoApprove = seller.isApproved && seller.autoApproveProducts;

    return prisma.$transaction(async (tnx) => {
        await tnx.product.update({
            where: { id: productId },
            data: {
                status: shouldAutoApprove ? ProductStatus.PUBLISHED : ProductStatus.PENDING,
                isPublished: shouldAutoApprove,
            }
        });

        const approval = await tnx.productApproval.upsert({
            where:  { productId },
            create: shouldAutoApprove
                ? {
                    productId,
                    status: 'APPROVED',
                    reviewedBy: 'system:auto-approve',
                    reviewNote: 'Auto-approved: trusted seller',
                    reviewedAt: new Date(),
                    submittedAt: new Date(),
                }
                : { productId, status: 'PENDING', submittedAt: new Date() },
            update: shouldAutoApprove
                ? {
                    status: 'APPROVED',
                    reviewedBy: 'system:auto-approve',
                    reviewNote: 'Auto-approved: trusted seller',
                    reviewedAt: new Date(),
                    submittedAt: new Date(),
                }
                : { status: 'PENDING', reviewedBy: null, reviewNote: null, reviewedAt: null, submittedAt: new Date() }
        });

        if (shouldAutoApprove) {
            await tnx.productApprovalHistory.create({
                data: {
                    productId,
                    status: 'APPROVED',
                    reviewedBy: 'system:auto-approve',
                    reviewNote: 'Auto-approved: trusted seller',
                }
            });
        }

        return approval;
    });
};

// ── Admin: update trusted seller settings ─────────────────────────────────────
const updateTrustSettings = async (
    adminEmail: string,
    sellerEmail: string,
    payload: { autoApproveProducts?: boolean; trustScore?: number }
) => {
    const seller = await prisma.seller.findUnique({ where: { email: sellerEmail } });
    if (!seller) throw new ApiError(httpStatus.NOT_FOUND, 'Seller not found');

    return prisma.seller.update({
        where: { email: sellerEmail },
        data: {
            autoApproveProducts: payload.autoApproveProducts ?? seller.autoApproveProducts,
            trustScore:          payload.trustScore          ?? seller.trustScore,
        },
        select: { id: true, name: true, email: true, autoApproveProducts: true, trustScore: true, isApproved: true }
    });
};

export const ProductApprovalService = {
    getPendingProducts,
    reviewProduct,
    disableProduct,
    submitForReview,
    updateTrustSettings,
};
