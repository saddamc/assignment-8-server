import { Request, Response } from 'express';
import catchAsync from '../../shared/catchAsync';
import sendResponse from '../../shared/sendResponse';
import httpStatus from 'http-status';
import { BannerService } from './banner.service';
import { IJWTPayload } from '../../types/common';
import { BannerPosition } from '@prisma/client';

const createBanner = catchAsync(async (req: Request, res: Response) => {
    const result = await BannerService.createBanner(req.user as IJWTPayload, req.body);
    sendResponse(res, { statusCode: httpStatus.CREATED, success: true, message: 'Banner created', data: result });
});

const getAllBanners = catchAsync(async (req: Request, res: Response) => {
    const result = await BannerService.getAllBanners();
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Banners fetched', data: result });
});

const getActiveBanners = catchAsync(async (req: Request, res: Response) => {
    const position = req.query.position as BannerPosition | undefined;
    const result = await BannerService.getActiveBanners(position);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Active banners fetched', data: result });
});

const updateBanner = catchAsync(async (req: Request, res: Response) => {
    const result = await BannerService.updateBanner(req.params.id as string, req.body);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Banner updated', data: result });
});

const deleteBanner = catchAsync(async (req: Request, res: Response) => {
    await BannerService.deleteBanner(req.params.id as string);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Banner deleted', data: null });
});

export const BannerController = { createBanner, getAllBanners, getActiveBanners, updateBanner, deleteBanner };



