import { prisma } from '../../shared/prisma';
import ApiError from '../../errors/ApiError';
import httpStatus from 'http-status';
import { IJWTPayload } from '../../types/common';

const getAllConfig = async () => {
    return prisma.siteConfig.findMany({ orderBy: { key: 'asc' } });
};

const getPublicConfig = async (key: string) => {
    const PRIVATE_KEYS = ['stripe_secret_key', 'cloudinary_secret', 'db_password'];
    if (PRIVATE_KEYS.includes(key)) throw new ApiError(httpStatus.FORBIDDEN, 'Access denied');
    const config = await prisma.siteConfig.findUnique({ where: { key } });
    if (!config) throw new ApiError(httpStatus.NOT_FOUND, 'Config not found');
    return config;
};

const upsertConfig = async (user: IJWTPayload, key: string, value: string, type?: string) => {
    return prisma.siteConfig.upsert({
        where: { key },
        create: { key, value, type: type ?? 'string', updatedBy: user.email },
        update: { value, updatedBy: user.email }
    });
};

const seedDefaults = async (adminEmail: string) => {
    const defaults = [
        { key: 'site_name', value: 'ShopHub', type: 'string' },
        { key: 'default_tax_rate', value: '0', type: 'number' },
        { key: 'default_commission_rate', value: '10', type: 'number' },
        { key: 'maintenance_mode', value: 'false', type: 'boolean' },
        { key: 'free_shipping_threshold', value: '50', type: 'number' },
        { key: 'contact_email', value: 'support@shophub.com', type: 'string' },
    ];
    for (const d of defaults) {
        await prisma.siteConfig.upsert({
            where: { key: d.key },
            create: { ...d, updatedBy: adminEmail },
            update: {}
        });
    }
};

export const SiteConfigService = { getAllConfig, getPublicConfig, upsertConfig, seedDefaults };
