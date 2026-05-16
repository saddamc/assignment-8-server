import { prisma } from '../../shared/prisma';
import ApiError from '../../errors/ApiError';
import httpStatus from 'http-status';
import { IJWTPayload } from '../../types/common';
import { IOptions, paginationHelper } from '../../helper/paginationHelper';
import { DisputeStatus } from '@prisma/client';

// ─── USER MANAGEMENT ──────────────────────────────────────────────────────────

const getAllUsers = async (options: IOptions, filters: any) => {
    const { skip, page, limit } = paginationHelper.calculatePagination(options);
    const where: any = { isDeleted: false };
    if (filters.role) where.role = filters.role;
    if (filters.status) where.status = filters.status;
    if (filters.search) where.OR = [{ name: { contains: filters.search, mode: 'insensitive' } }, { email: { contains: filters.search, mode: 'insensitive' } }];

    const [data, total] = await prisma.$transaction([
        prisma.user.findMany({ where, select: { id: true, name: true, email: true, role: true, status: true, createdAt: true }, skip, take: limit, orderBy: { createdAt: 'desc' } }),
        prisma.user.count({ where })
    ]);
    return { meta: { page, limit, total }, data };
};

const getUserById = async (id: string) => {
    const user = await prisma.user.findUnique({
        where: { id },
        include: { customer: true, seller: true, admin: true }
    });
    if (!user) throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    return user;
};

const blockUser = async (id: string) => {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    return prisma.user.update({ where: { id }, data: { status: 'BLOCKED' } });
};

const unblockUser = async (id: string) => {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    return prisma.user.update({ where: { id }, data: { status: 'ACTIVE' } });
};

// ─── SELLER MANAGEMENT ────────────────────────────────────────────────────────

const getAllSellers = async (options: IOptions, filters: any) => {
    const { skip, page, limit } = paginationHelper.calculatePagination(options);
    const where: any = { role: 'SELLER', isDeleted: false };
    if (filters.isApproved !== undefined) where.isApproved = filters.isApproved;

    const [data, total] = await prisma.$transaction([
        prisma.user.findMany({
            where,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                status: true,
                createdAt: true,
            },
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.user.count({ where }),
    ]);

    return { meta: { page, limit, total }, data };
};

const getSellerById = async (id: string) => {
    const seller = await prisma.seller.findUnique({
        where: { id },
        include: {
            products: { where: { isDeleted: false }, take: 10 },
            _count: { select: { products: true } }
        }
    });
    if (!seller) throw new ApiError(httpStatus.NOT_FOUND, 'Seller not found');
    return seller;
};

const approveSeller = async (adminEmail: string, id: string) => {
    const seller = await prisma.seller.findUnique({ where: { id } });
    if (!seller) throw new ApiError(httpStatus.NOT_FOUND, 'Seller not found');
    await prisma.adminActivityLog.create({
        data: { adminEmail, action: 'APPROVED_SELLER', targetType: 'Seller', targetId: id }
    });
    return prisma.seller.update({ where: { id }, data: { isApproved: true } });
};

const rejectSeller = async (adminEmail: string, id: string, reason?: string) => {
    const seller = await prisma.seller.findUnique({ where: { id } });
    if (!seller) throw new ApiError(httpStatus.NOT_FOUND, 'Seller not found');
    await prisma.adminActivityLog.create({
        data: { adminEmail, action: 'REJECTED_SELLER', targetType: 'Seller', targetId: id, metadata: { reason } }
    });
    return prisma.seller.update({ where: { id }, data: { isApproved: false } });
};

const updateCommission = async (id: string, commissionRate: number) => {
    if (commissionRate < 0 || commissionRate > 50) throw new ApiError(httpStatus.BAD_REQUEST, 'Commission rate must be between 0 and 50');
    return prisma.seller.update({ where: { id }, data: { commissionRate } });
};

// ─── DISPUTES ─────────────────────────────────────────────────────────────────

const getAllDisputes = async (options: IOptions, filters: any) => {
    const { skip, page, limit } = paginationHelper.calculatePagination(options);
    const where: any = {};
    if (filters.status) where.status = filters.status;

    const [data, total] = await prisma.$transaction([
        prisma.dispute.findMany({ where, include: { order: { include: { customer: { select: { name: true } } } } }, skip, take: limit, orderBy: { createdAt: 'desc' } }),
        prisma.dispute.count({ where })
    ]);
    return { meta: { page, limit, total }, data };
};

const getDisputeById = async (id: string) => {
    const dispute = await prisma.dispute.findUnique({
        where: { id },
        include: { order: { include: { items: { include: { product: { select: { name: true, images: true } } } } } } }
    });
    if (!dispute) throw new ApiError(httpStatus.NOT_FOUND, 'Dispute not found');
    return dispute;
};

const resolveDispute = async (adminEmail: string, id: string, payload: { status: DisputeStatus; resolution: string }) => {
    const dispute = await prisma.dispute.findUnique({ where: { id } });
    if (!dispute) throw new ApiError(httpStatus.NOT_FOUND, 'Dispute not found');
    return prisma.dispute.update({
        where: { id },
        data: { ...payload, resolvedBy: adminEmail, resolvedAt: new Date() }
    });
};

const createDispute = async (user: IJWTPayload, orderId: string, payload: { reason: string; description: string; sellerEmail: string }) => {
    const order = await prisma.order.findFirst({ where: { id: orderId, customerEmail: user.email } });
    if (!order) throw new ApiError(httpStatus.NOT_FOUND, 'Order not found');
    return prisma.dispute.create({ data: { orderId, raisedBy: user.email, ...payload } });
};

// ─── FRAUD FLAGS ──────────────────────────────────────────────────────────────

const getFraudFlags = async (options: IOptions) => {
    const { skip, page, limit } = paginationHelper.calculatePagination(options);
    const [data, total] = await prisma.$transaction([
        prisma.fraudFlag.findMany({ where: { isResolved: false }, skip, take: limit, orderBy: { createdAt: 'desc' } }),
        prisma.fraudFlag.count({ where: { isResolved: false } })
    ]);
    return { meta: { page, limit, total }, data };
};

const resolveFraudFlag = async (id: string, adminEmail: string, notes?: string) => {
    return prisma.fraudFlag.update({ where: { id }, data: { isResolved: true, resolvedBy: adminEmail, resolvedAt: new Date(), notes } });
};

// ─── ACTIVITY LOGS ────────────────────────────────────────────────────────────

const getActivityLogs = async (options: IOptions, adminEmail?: string) => {
    const { skip, page, limit } = paginationHelper.calculatePagination(options);
    const where = adminEmail ? { adminEmail } : {};
    const [data, total] = await prisma.$transaction([
        prisma.adminActivityLog.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
        prisma.adminActivityLog.count({ where })
    ]);
    return { meta: { page, limit, total }, data };
};

// ─── FINANCE ──────────────────────────────────────────────────────────────────

const getRevenueOverview = async (period: 'day' | 'week' | 'month' = 'month') => {
    const now = new Date();
    const startDates = {
        day: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        week: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        month: new Date(now.getFullYear(), now.getMonth(), 1)
    };

    const [revenue, orders, commissions] = await prisma.$transaction([
        prisma.order.aggregate({
            where: { paymentStatus: 'PAID', createdAt: { gte: startDates[period] } },
            _sum: { totalAmount: true }
        }),
        prisma.order.count({ where: { paymentStatus: 'PAID', createdAt: { gte: startDates[period] } } }),
        prisma.seller.aggregate({ _avg: { commissionRate: true } })
    ]);

    const grossRevenue = revenue._sum.totalAmount ?? 0;
    const avgCommission = commissions._avg.commissionRate ?? 10;
    const platformEarnings = grossRevenue * (avgCommission / 100);

    return { period, grossRevenue, platformEarnings, orderCount: orders, startDate: startDates[period] };
};

export const AdminService = {
    getAllUsers, getUserById, blockUser, unblockUser,
    getAllSellers, getSellerById, approveSeller, rejectSeller, updateCommission,
    getAllDisputes, getDisputeById, resolveDispute, createDispute,
    getFraudFlags, resolveFraudFlag,
    getActivityLogs, getRevenueOverview
};


