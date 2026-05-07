import { prisma } from '../../shared/prisma';
import ApiError from '../../errors/ApiError';
import httpStatus from 'http-status';
import { IJWTPayload } from '../../types/common';
import { DiscountType } from '@prisma/client';

const createCoupon = async (user: IJWTPayload, payload: {
    code: string; discountType: DiscountType; discountValue: number;
    minOrderAmount?: number; maxUses?: number; expiresAt?: string;
}) => {
    const existing = await prisma.coupon.findUnique({ where: { code: payload.code } });
    if (existing) throw new ApiError(httpStatus.CONFLICT, 'Coupon code already exists');

    return prisma.coupon.create({
        data: {
            ...payload,
            sellerEmail: user.role === 'SELLER' ? user.email : null,
            expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
        }
    });
};

const getMyCoupons = async (user: IJWTPayload) => {
    return prisma.coupon.findMany({
        where: { sellerEmail: user.role === 'SELLER' ? user.email : null },
        orderBy: { createdAt: 'desc' }
    });
};

const updateCoupon = async (user: IJWTPayload, id: string, payload: Partial<{
    discountValue: number; minOrderAmount: number; maxUses: number; isActive: boolean; expiresAt: string;
}>) => {
    const coupon = await prisma.coupon.findFirst({
        where: { id, sellerEmail: user.role === 'SELLER' ? user.email : undefined }
    });
    if (!coupon) throw new ApiError(httpStatus.NOT_FOUND, 'Coupon not found');
    return prisma.coupon.update({ where: { id }, data: { ...payload, expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : undefined } });
};

const deleteCoupon = async (user: IJWTPayload, id: string) => {
    const coupon = await prisma.coupon.findFirst({
        where: { id, sellerEmail: user.role === 'SELLER' ? user.email : undefined }
    });
    if (!coupon) throw new ApiError(httpStatus.NOT_FOUND, 'Coupon not found');
    await prisma.coupon.delete({ where: { id } });
};

const validateCoupon = async (code: string, orderAmount: number) => {
    const coupon = await prisma.coupon.findUnique({ where: { code } });
    if (!coupon) throw new ApiError(httpStatus.NOT_FOUND, 'Invalid coupon code');
    if (!coupon.isActive) throw new ApiError(httpStatus.BAD_REQUEST, 'Coupon is no longer active');
    if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new ApiError(httpStatus.BAD_REQUEST, 'Coupon has expired');
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) throw new ApiError(httpStatus.BAD_REQUEST, 'Coupon usage limit reached');
    if (orderAmount < coupon.minOrderAmount) throw new ApiError(httpStatus.BAD_REQUEST, `Minimum order amount is $${coupon.minOrderAmount}`);

    const discount = coupon.discountType === 'PERCENTAGE'
        ? (orderAmount * coupon.discountValue / 100)
        : coupon.discountValue;

    return { coupon, discount: Math.min(discount, orderAmount) };
};

export const CouponService = { createCoupon, getMyCoupons, updateCoupon, deleteCoupon, validateCoupon };


