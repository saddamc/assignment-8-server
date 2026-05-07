import { prisma } from '../../shared/prisma';
import ApiError from '../../errors/ApiError';
import httpStatus from 'http-status';
import { IJWTPayload } from '../../types/common';
import { IOptions, paginationHelper } from '../../helper/paginationHelper';

const getProductReviews = async (productId: string, options: IOptions) => {
    const { skip, take, page, limit } = paginationHelper.calculatePagination(options);
    const [reviews, total] = await prisma.$transaction([
        prisma.review.findMany({
            where: { productId },
            include: { customer: { select: { name: true, profilePhoto: true } } },
            orderBy: { createdAt: 'desc' },
            skip, take
        }),
        prisma.review.count({ where: { productId } })
    ]);

    const avgRating = reviews.length > 0
        ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
        : 0;

    return { meta: { page, limit, total }, data: reviews, avgRating: Math.round(avgRating * 10) / 10 };
};

const createReview = async (user: IJWTPayload, productId: string, payload: {
    rating: number; comment?: string; images?: string[];
}) => {
    const product = await prisma.product.findFirst({ where: { id: productId, isDeleted: false } });
    if (!product) throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');

    // Check for verified purchase
    const purchase = await prisma.orderItem.findFirst({
        where: {
            productId,
            order: { customerEmail: user.email, paymentStatus: 'PAID' }
        }
    });

    const existing = await prisma.review.findUnique({
        where: { productId_customerEmail: { productId, customerEmail: user.email } }
    });
    if (existing) throw new ApiError(httpStatus.CONFLICT, 'You already reviewed this product');

    return prisma.review.create({
        data: {
            ...payload,
            productId,
            customerEmail: user.email,
            isVerifiedPurchase: !!purchase,
        }
    });
};

const updateReview = async (user: IJWTPayload, id: string, payload: {
    rating?: number; comment?: string; images?: string[];
}) => {
    const review = await prisma.review.findFirst({ where: { id, customerEmail: user.email } });
    if (!review) throw new ApiError(httpStatus.NOT_FOUND, 'Review not found');
    return prisma.review.update({ where: { id }, data: payload });
};

const deleteReview = async (user: IJWTPayload, id: string) => {
    const review = await prisma.review.findFirst({ where: { id, customerEmail: user.email } });
    if (!review) throw new ApiError(httpStatus.NOT_FOUND, 'Review not found');
    await prisma.review.delete({ where: { id } });
};

const getMyReviews = async (user: IJWTPayload, options: IOptions) => {
    const { skip, take, page, limit } = paginationHelper.calculatePagination(options);
    const [reviews, total] = await prisma.$transaction([
        prisma.review.findMany({
            where: { customerEmail: user.email },
            include: { product: { select: { id: true, name: true, images: true } } },
            orderBy: { createdAt: 'desc' },
            skip, take
        }),
        prisma.review.count({ where: { customerEmail: user.email } })
    ]);
    return { meta: { page, limit, total }, data: reviews };
};

export const ReviewService = { getProductReviews, createReview, updateReview, deleteReview, getMyReviews };


