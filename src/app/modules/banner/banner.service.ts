import { prisma } from '../../shared/prisma';
import ApiError from '../../errors/ApiError';
import httpStatus from 'http-status';
import { IJWTPayload } from '../../types/common';
import { BannerPosition } from '@prisma/client';

const createBanner = async (user: IJWTPayload, payload: {
    title: string; subtitle?: string; imageUrl: string; linkUrl?: string;
    position: BannerPosition; sortOrder?: number; startDate?: string; endDate?: string;
}) => {
    return prisma.banner.create({
        data: {
            ...payload,
            createdBy: user.email,
            startDate: payload.startDate ? new Date(payload.startDate) : null,
            endDate: payload.endDate ? new Date(payload.endDate) : null,
        }
    });
};

const getAllBanners = async () => {
    return prisma.banner.findMany({ orderBy: [{ position: 'asc' }, { sortOrder: 'asc' }] });
};

const getActiveBanners = async (position?: BannerPosition) => {
    const now = new Date();
    return prisma.banner.findMany({
        where: {
            isActive: true,
            ...(position && { position }),
            OR: [{ startDate: null }, { startDate: { lte: now } }],
            AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }]
        },
        orderBy: { sortOrder: 'asc' }
    });
};

const updateBanner = async (id: string, payload: Partial<{
    title: string; subtitle: string; imageUrl: string; linkUrl: string;
    position: BannerPosition; isActive: boolean; sortOrder: number;
    startDate: string; endDate: string;
}>) => {
    const banner = await prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new ApiError(httpStatus.NOT_FOUND, 'Banner not found');
    return prisma.banner.update({
        where: { id },
        data: {
            ...payload,
            startDate: payload.startDate ? new Date(payload.startDate) : undefined,
            endDate: payload.endDate ? new Date(payload.endDate) : undefined,
        }
    });
};

const deleteBanner = async (id: string) => {
    const banner = await prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new ApiError(httpStatus.NOT_FOUND, 'Banner not found');
    await prisma.banner.delete({ where: { id } });
};

export const BannerService = { createBanner, getAllBanners, getActiveBanners, updateBanner, deleteBanner };


