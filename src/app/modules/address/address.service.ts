import { prisma } from '../../shared/prisma';
import ApiError from '../../errors/ApiError';
import httpStatus from 'http-status';
import { IJWTPayload } from '../../types/common';

const getMyAddresses = async (user: IJWTPayload) => {
    return prisma.address.findMany({
        where: { customerEmail: user.email },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }]
    });
};

const createAddress = async (user: IJWTPayload, payload: {
    label?: string; fullName: string; phone: string;
    line1: string; line2?: string; city: string;
    state: string; postalCode: string; country?: string; isDefault?: boolean;
}) => {
    // If setting as default, unset all others first
    if (payload.isDefault) {
        await prisma.address.updateMany({
            where: { customerEmail: user.email },
            data: { isDefault: false }
        });
    }

    // If first address, auto-set as default
    const count = await prisma.address.count({ where: { customerEmail: user.email } });
    if (count === 0) payload.isDefault = true;

    return prisma.address.create({
        data: { ...payload, customerEmail: user.email }
    });
};

const updateAddress = async (user: IJWTPayload, id: string, payload: Partial<{
    label: string; fullName: string; phone: string; line1: string;
    line2: string; city: string; state: string; postalCode: string;
    country: string; isDefault: boolean;
}>) => {
    const address = await prisma.address.findFirst({ where: { id, customerEmail: user.email } });
    if (!address) throw new ApiError(httpStatus.NOT_FOUND, 'Address not found');

    if (payload.isDefault) {
        await prisma.address.updateMany({
            where: { customerEmail: user.email },
            data: { isDefault: false }
        });
    }

    return prisma.address.update({ where: { id }, data: payload });
};

const deleteAddress = async (user: IJWTPayload, id: string) => {
    const address = await prisma.address.findFirst({ where: { id, customerEmail: user.email } });
    if (!address) throw new ApiError(httpStatus.NOT_FOUND, 'Address not found');

    await prisma.address.delete({ where: { id } });

    // If deleted address was default, set next one as default
    if (address.isDefault) {
        const next = await prisma.address.findFirst({ where: { customerEmail: user.email } });
        if (next) await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
};

const setDefaultAddress = async (user: IJWTPayload, id: string) => {
    const address = await prisma.address.findFirst({ where: { id, customerEmail: user.email } });
    if (!address) throw new ApiError(httpStatus.NOT_FOUND, 'Address not found');

    await prisma.address.updateMany({ where: { customerEmail: user.email }, data: { isDefault: false } });
    return prisma.address.update({ where: { id }, data: { isDefault: true } });
};

export const AddressService = { getMyAddresses, createAddress, updateAddress, deleteAddress, setDefaultAddress };


