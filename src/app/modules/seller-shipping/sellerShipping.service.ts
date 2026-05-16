import { prisma } from '../../shared/prisma';
import ApiError from '../../errors/ApiError';
import httpStatus from 'http-status';
import { IJWTPayload } from '../../types/common';

// ─── Types ────────────────────────────────────────────────────────────────────

interface IUpsertPayload {
    categoryId?: string | null;
    charge: number;
    label?: string;
}

// ─── Get all rules for the current seller ────────────────────────────────────

const getMyShippingRules = async (user: IJWTPayload) => {
    return prisma.sellerCategoryShipping.findMany({
        where: { sellerEmail: user.email },
        include: { category: { select: { id: true, name: true } } },
        orderBy: [{ categoryId: 'asc' }],
    });
};

// ─── Upsert (create or update) a rule ─────────────────────────────────────────
// categoryId = null → seller-wide default

const upsertRule = async (user: IJWTPayload, payload: IUpsertPayload) => {
    if (!Number.isFinite(payload.charge) || payload.charge < 0) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Charge must be a non-negative number');
    }

    if (payload.categoryId) {
        const cat = await prisma.category.findUnique({ where: { id: payload.categoryId } });
        if (!cat) throw new ApiError(httpStatus.NOT_FOUND, 'Category not found');
    }

    return prisma.sellerCategoryShipping.upsert({
        where: {
            sellerEmail_categoryId: {
                sellerEmail: user.email,
                categoryId: (payload.categoryId ?? null) as any,
            },
        },
        create: {
            sellerEmail: user.email,
            categoryId: (payload.categoryId ?? null) as any,
            charge: payload.charge,
            label: payload.label ?? null,
        },
        update: {
            charge: payload.charge,
            label: payload.label ?? null,
        },
        include: { category: { select: { id: true, name: true } } },
    });
};

// ─── Delete a rule by id (must belong to seller) ──────────────────────────────

const deleteRule = async (user: IJWTPayload, id: string) => {
    const rule = await prisma.sellerCategoryShipping.findUnique({ where: { id } });
    if (!rule) throw new ApiError(httpStatus.NOT_FOUND, 'Shipping rule not found');
    if (rule.sellerEmail !== user.email) throw new ApiError(httpStatus.FORBIDDEN, 'Not your rule');
    await prisma.sellerCategoryShipping.delete({ where: { id } });
    return { deleted: true };
};

// ─── Public: fetch rules for a given seller (used by product page) ────────────

const getPublicRulesForSeller = async (sellerEmail: string) => {
    return prisma.sellerCategoryShipping.findMany({
        where: { sellerEmail },
        include: { category: { select: { id: true, name: true } } },
        orderBy: [{ categoryId: 'asc' }],
    });
};

export const SellerShippingService = {
    getMyShippingRules,
    upsertRule,
    deleteRule,
    getPublicRulesForSeller,
};
