import { Request, Response } from 'express';
import catchAsync from '../../shared/catchAsync';
import sendResponse from '../../shared/sendResponse';
import httpStatus from 'http-status';
import { ReviewService } from './review.service';
import { IJWTPayload } from '../../types/common';

const getProductReviews = catchAsync(async (req: Request, res: Response) => {
    const result = await ReviewService.getProductReviews(req.params.productId as string, req.query as any);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Reviews fetched', data: result });
});

const createReview = catchAsync(async (req: Request, res: Response) => {
    const result = await ReviewService.createReview(req.user as IJWTPayload, req.params.productId as string, req.body);
    sendResponse(res, { statusCode: httpStatus.CREATED, success: true, message: 'Review created', data: result });
});

const updateReview = catchAsync(async (req: Request, res: Response) => {
    const result = await ReviewService.updateReview(req.user as IJWTPayload, req.params.id as string, req.body);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Review updated', data: result });
});

const deleteReview = catchAsync(async (req: Request, res: Response) => {
    await ReviewService.deleteReview(req.user as IJWTPayload, req.params.id as string);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Review deleted', data: null });
});

const getMyReviews = catchAsync(async (req: Request, res: Response) => {
    const result = await ReviewService.getMyReviews(req.user as IJWTPayload, req.query as any);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'My reviews fetched', data: result });
});

export const ReviewController = { getProductReviews, createReview, updateReview, deleteReview, getMyReviews };



