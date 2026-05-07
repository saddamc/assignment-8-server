import { prisma } from '../../shared/prisma';
import { IJWTPayload } from '../../types/common';
import { IOptions, paginationHelper } from '../../helper/paginationHelper';
import { NotificationType } from '@prisma/client';

const getMyNotifications = async (user: IJWTPayload, options: IOptions) => {
    const { skip, page, limit } = paginationHelper.calculatePagination(options);
    const [data, total] = await prisma.$transaction([
        prisma.notification.findMany({
            where: { customerEmail: user.email },
            orderBy: { createdAt: 'desc' },
            skip, take: limit
        }),
        prisma.notification.count({ where: { customerEmail: user.email } })
    ]);
    const unreadCount = await prisma.notification.count({ where: { customerEmail: user.email, isRead: false } });
    return { meta: { page, limit, total }, data, unreadCount };
};

const markAsRead = async (user: IJWTPayload, id: string) => {
    return prisma.notification.updateMany({ where: { id, customerEmail: user.email }, data: { isRead: true } });
};

const markAllAsRead = async (user: IJWTPayload) => {
    return prisma.notification.updateMany({ where: { customerEmail: user.email }, data: { isRead: true } });
};

const deleteNotification = async (user: IJWTPayload, id: string) => {
    await prisma.notification.deleteMany({ where: { id, customerEmail: user.email } });
};

const createNotification = async (customerEmail: string, type: NotificationType, title: string, message: string, metadata?: object) => {
    return prisma.notification.create({ data: { customerEmail, type, title, message, metadata: metadata as any } });
};

export const NotificationService = { getMyNotifications, markAsRead, markAllAsRead, deleteNotification, createNotification };


