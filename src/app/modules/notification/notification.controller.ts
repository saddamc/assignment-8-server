import { Request, Response } from 'express';
import catchAsync from '../../shared/catchAsync';
import sendResponse from '../../shared/sendResponse';
import httpStatus from 'http-status';
import { NotificationService } from './notification.service';
import { IJWTPayload } from '../../types/common';
import pick from '../../helper/pick';

const getMyNotifications = catchAsync(async (req: Request, res: Response) => {
    const options = pick(req.query, ['page', 'limit']);
    const result = await NotificationService.getMyNotifications(req.user as IJWTPayload, options);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Notifications fetched', data: result });
});

const markAsRead = catchAsync(async (req: Request, res: Response) => {
    await NotificationService.markAsRead(req.user as IJWTPayload, req.params.id);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Marked as read', data: null });
});

const markAllAsRead = catchAsync(async (req: Request, res: Response) => {
    await NotificationService.markAllAsRead(req.user as IJWTPayload);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'All marked as read', data: null });
});

const deleteNotification = catchAsync(async (req: Request, res: Response) => {
    await NotificationService.deleteNotification(req.user as IJWTPayload, req.params.id);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Notification deleted', data: null });
});

export const NotificationController = { getMyNotifications, markAsRead, markAllAsRead, deleteNotification };



