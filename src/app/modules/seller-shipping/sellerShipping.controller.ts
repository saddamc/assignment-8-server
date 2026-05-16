import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../shared/catchAsync';
import sendResponse from '../../shared/sendResponse';
import { SellerShippingService } from './sellerShipping.service';
import { IJWTPayload } from '../../types/common';

const getMyRules = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IJWTPayload;
    const result = await SellerShippingService.getMyShippingRules(user);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Shipping rules retrieved', data: result });
});

const upsertRule = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IJWTPayload;
    const { categoryId, charge, label } = req.body;
    const result = await SellerShippingService.upsertRule(user, {
        categoryId: categoryId ?? null,
        charge: Number(charge),
        label,
    });
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Shipping rule saved', data: result });
});

const deleteRule = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IJWTPayload;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await SellerShippingService.deleteRule(user, String(id));
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Shipping rule deleted', data: result });
});

const getPublicRules = catchAsync(async (req: Request, res: Response) => {
    const sellerEmail = Array.isArray(req.params.sellerEmail) ? req.params.sellerEmail[0] : req.params.sellerEmail;
    const result = await SellerShippingService.getPublicRulesForSeller(String(sellerEmail));
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Shipping rules retrieved', data: result });
});

export const SellerShippingController = { getMyRules, upsertRule, deleteRule, getPublicRules };
