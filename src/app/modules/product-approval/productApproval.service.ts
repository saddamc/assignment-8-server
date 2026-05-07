import { prisma } from '../../shared/prisma';
import ApiError from '../../errors/ApiError';
import httpStatus from 'http-status';
import { ProductApprovalStatus } from '@prisma/client';

const getPendingProducts = async () => {
    return prisma.productApproval.findMany({
        where: { status: 'PENDING' },
        include: {
            product: {
                include: {
                    category: { select: { name: true } },
                    seller: { select: { name: true, storeName: true } }
                }
            }
        },
        orderBy: { createdAt: 'asc' }
    });
};

const reviewProduct = async (adminEmail: string, productId: string, payload: {
    status: ProductApprovalStatus; reviewNote?: string;
}) => {
    const approval = await prisma.productApproval.findUnique({ where: { productId } });
    if (!approval) throw new ApiError(httpStatus.NOT_FOUND, 'Product approval not found');

    const updated = await prisma.$transaction(async (tnx) => {
        const a = await tnx.productApproval.update({
            where: { productId },
            data: { ...payload, reviewedBy: adminEmail, reviewedAt: new Date() }
        });
        if (payload.status === 'APPROVED') {
            await tnx.product.update({ where: { id: productId }, data: { isPublished: true } });
        }
        return a;
    });

    return updated;
};

const submitForReview = async (sellerEmail: string, productId: string) => {
    const product = await prisma.product.findFirst({ where: { id: productId, sellerEmail } });
    if (!product) throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');

    return prisma.productApproval.upsert({
        where: { productId },
        create: { productId, status: 'PENDING' },
        update: { status: 'PENDING', reviewedBy: null, reviewNote: null, reviewedAt: null }
    });
};

export const ProductApprovalService = { getPendingProducts, reviewProduct, submitForReview };
