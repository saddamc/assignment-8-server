import { Request, Response } from 'express';
import catchAsync from '../../shared/catchAsync';
import sendResponse from '../../shared/sendResponse';
import httpStatus from 'http-status';
import { ProductApprovalService } from './productApproval.service';
import { IJWTPayload } from '../../types/common';
import pick from '../../helper/pick';

const getPendingProducts = catchAsync(async (req: Request, res: Response) => {
    const options = pick(req.query, ['page', 'limit']);
    const filters = pick(req.query, ['status']);
    const result = await ProductApprovalService.getPendingProducts(options, filters);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Products fetched', meta: result.meta, data: result.data });
});

const reviewProduct = catchAsync(async (req: Request, res: Response) => {
    const result = await ProductApprovalService.reviewProduct(
        (req.user as IJWTPayload).email,
        req.params.productId as string,
        req.body
    );
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Product reviewed', data: result });
});

const disableProduct = catchAsync(async (req: Request, res: Response) => {
    const result = await ProductApprovalService.disableProduct(
        (req.user as IJWTPayload).email,
        req.params.productId as string,
        req.body.reason
    );
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Product disabled', data: result });
});

const submitForReview = catchAsync(async (req: Request, res: Response) => {
    const result = await ProductApprovalService.submitForReview(
        (req.user as IJWTPayload).email,
        req.params.productId as string
    );
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Submitted for review', data: result });
});

const updateTrustSettings = catchAsync(async (req: Request, res: Response) => {
    const result = await ProductApprovalService.updateTrustSettings(
        (req.user as IJWTPayload).email,
        req.params.sellerEmail as string,
        req.body
    );
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Trust settings updated', data: result });
});

export const ProductApprovalController = {
    getPendingProducts,
    reviewProduct,
    disableProduct,
    submitForReview,
    updateTrustSettings,
};


