import { Request, Response } from 'express';
import catchAsync from '../../shared/catchAsync';
import sendResponse from '../../shared/sendResponse';
import httpStatus from 'http-status';
import { PayoutService } from './payout.service';
import { IJWTPayload } from '../../types/common';
import pick from '../../helper/pick';

const getBalance = catchAsync(async (req: Request, res: Response) => {
    const result = await PayoutService.getBalance(req.user as IJWTPayload);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Balance fetched', data: result });
});

const requestWithdrawal = catchAsync(async (req: Request, res: Response) => {
    const result = await PayoutService.requestWithdrawal(req.user as IJWTPayload, req.body);
    sendResponse(res, { statusCode: httpStatus.CREATED, success: true, message: 'Withdrawal requested', data: result });
});

const getWithdrawals = catchAsync(async (req: Request, res: Response) => {
    const options = pick(req.query, ['page', 'limit']);
    const result = await PayoutService.getWithdrawals(req.user as IJWTPayload, options);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Withdrawals fetched', data: result });
});

const getAllWithdrawals = catchAsync(async (req: Request, res: Response) => {
    const options = pick(req.query, ['page', 'limit']);
    const filters = pick(req.query, ['status']);
    const result = await PayoutService.getAllWithdrawals(options, filters);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'All withdrawals fetched', data: result });
});

const processWithdrawal = catchAsync(async (req: Request, res: Response) => {
    const result = await PayoutService.processWithdrawal(req.params.id, req.body);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Withdrawal processed', data: result });
});

export const PayoutController = { getBalance, requestWithdrawal, getWithdrawals, getAllWithdrawals, processWithdrawal };



