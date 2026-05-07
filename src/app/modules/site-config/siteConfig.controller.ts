import { Request, Response } from 'express';
import catchAsync from '../../shared/catchAsync';
import sendResponse from '../../shared/sendResponse';
import httpStatus from 'http-status';
import { SiteConfigService } from './siteConfig.service';
import { IJWTPayload } from '../../types/common';

const getAllConfig = catchAsync(async (req: Request, res: Response) => {
    const result = await SiteConfigService.getAllConfig();
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Config fetched', data: result });
});

const getPublicConfig = catchAsync(async (req: Request, res: Response) => {
    const result = await SiteConfigService.getPublicConfig(req.params.key as string);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Config fetched', data: result });
});

const upsertConfig = catchAsync(async (req: Request, res: Response) => {
    const { value, type } = req.body;
    const result = await SiteConfigService.upsertConfig(req.user as IJWTPayload, req.params.key as string, value, type);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Config updated', data: result });
});

export const SiteConfigController = { getAllConfig, getPublicConfig, upsertConfig };



