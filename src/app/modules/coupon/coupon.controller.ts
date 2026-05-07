import { Request, Response } from 'express';
import catchAsync from '../../shared/catchAsync';
import sendResponse from '../../shared/sendResponse';
import httpStatus from 'http-status';
import { CouponService } from './coupon.service';
import { IJWTPayload } from '../../types/common';

const createCoupon = catchAsync(async (req: Request, res: Response) => {
    const result = await CouponService.createCoupon(req.user as IJWTPayload, req.body);
    sendResponse(res, { statusCode: httpStatus.CREATED, success: true, message: 'Coupon created', data: result });
});

const getMyCoupons = catchAsync(async (req: Request, res: Response) => {
    const result = await CouponService.getMyCoupons(req.user as IJWTPayload);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Coupons fetched', data: result });
});

const updateCoupon = catchAsync(async (req: Request, res: Response) => {
    const result = await CouponService.updateCoupon(req.user as IJWTPayload, req.params.id as string, req.body);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Coupon updated', data: result });
});

const deleteCoupon = catchAsync(async (req: Request, res: Response) => {
    await CouponService.deleteCoupon(req.user as IJWTPayload, req.params.id as string);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Coupon deleted', data: null });
});

const validateCoupon = catchAsync(async (req: Request, res: Response) => {
    const { code, orderAmount } = req.body;
    const result = await CouponService.validateCoupon(code, Number(orderAmount));
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Coupon valid', data: result });
});

export const CouponController = { createCoupon, getMyCoupons, updateCoupon, deleteCoupon, validateCoupon };


