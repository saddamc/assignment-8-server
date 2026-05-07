import { Request, Response } from 'express';
import catchAsync from '../../shared/catchAsync';
import sendResponse from '../../shared/sendResponse';
import httpStatus from 'http-status';
import { ProductApprovalService } from './productApproval.service';
import { IJWTPayload } from '../../types/common';

const getPendingProducts = catchAsync(async (req: Request, res: Response) => {
    const result = await ProductApprovalService.getPendingProducts();
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Pending products fetched', data: result });
});

const reviewProduct = catchAsync(async (req: Request, res: Response) => {
    const result = await ProductApprovalService.reviewProduct((req.user as IJWTPayload).email, req.params.productId, req.body);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Product reviewed', data: result });
});

const submitForReview = catchAsync(async (req: Request, res: Response) => {
    const result = await ProductApprovalService.submitForReview((req.user as IJWTPayload).email, req.params.productId);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Submitted for review', data: result });
});

export const ProductApprovalController = { getPendingProducts, reviewProduct, submitForReview };



