import { prisma } from '../../shared/prisma';
import ApiError from '../../errors/ApiError';
import httpStatus from 'http-status';
import { IJWTPayload } from '../../types/common';
import { IOptions, paginationHelper } from '../../helper/paginationHelper';
import { WithdrawalStatus } from '@prisma/client';

const getBalance = async (user: IJWTPayload) => {
    const seller = await prisma.seller.findUnique({ where: { email: user.email } });
    if (!seller) throw new ApiError(httpStatus.NOT_FOUND, 'Seller not found');

    const paid = await prisma.orderItem.aggregate({
        where: { product: { sellerEmail: user.email }, order: { paymentStatus: 'PAID' } },
        _sum: { price: true }
    });
    const grossEarnings = (paid._sum.price ?? 0);
    const commissionDeducted = grossEarnings * (seller.commissionRate / 100);
    const totalEarnings = grossEarnings - commissionDeducted;

    const withdrawn = await prisma.withdrawalRequest.aggregate({
        where: { sellerEmail: user.email, status: { in: ['APPROVED', 'PROCESSED'] } },
        _sum: { amount: true }
    });
    const withdrawnAmount = withdrawn._sum.amount ?? 0;

    return { grossEarnings, commission: commissionDeducted, totalEarnings, withdrawnAmount, availableBalance: totalEarnings - withdrawnAmount };
};

const requestWithdrawal = async (user: IJWTPayload, payload: { amount: number; bankDetails: object }) => {
    const balance = await getBalance(user);
    if (payload.amount > balance.availableBalance) {
        throw new ApiError(httpStatus.BAD_REQUEST, `Insufficient balance. Available: $${balance.availableBalance.toFixed(2)}`);
    }
    if (payload.amount < 10) throw new ApiError(httpStatus.BAD_REQUEST, 'Minimum withdrawal is $10');

    return prisma.withdrawalRequest.create({
        data: { sellerEmail: user.email, amount: payload.amount, bankDetails: payload.bankDetails as any }
    });
};

const getWithdrawals = async (user: IJWTPayload, options: IOptions) => {
    const { skip, take, page, limit } = paginationHelper.calculatePagination(options);
    const [data, total] = await prisma.$transaction([
        prisma.withdrawalRequest.findMany({ where: { sellerEmail: user.email }, orderBy: { createdAt: 'desc' }, skip, take }),
        prisma.withdrawalRequest.count({ where: { sellerEmail: user.email } })
    ]);
    return { meta: { page, limit, total }, data };
};

const getAllWithdrawals = async (options: IOptions, filters?: { status?: string }) => {
    const { skip, take, page, limit } = paginationHelper.calculatePagination(options);
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    const [data, total] = await prisma.$transaction([
        prisma.withdrawalRequest.findMany({ where, include: { seller: { select: { name: true, storeName: true } } }, orderBy: { createdAt: 'desc' }, skip, take }),
        prisma.withdrawalRequest.count({ where })
    ]);
    return { meta: { page, limit, total }, data };
};

const processWithdrawal = async (id: string, payload: { status: WithdrawalStatus; adminNote?: string }) => {
    const request = await prisma.withdrawalRequest.findUnique({ where: { id } });
    if (!request) throw new ApiError(httpStatus.NOT_FOUND, 'Withdrawal request not found');

    return prisma.withdrawalRequest.update({
        where: { id },
        data: { ...payload, processedAt: payload.status !== 'PENDING' ? new Date() : null }
    });
};

export const PayoutService = { getBalance, requestWithdrawal, getWithdrawals, getAllWithdrawals, processWithdrawal };


