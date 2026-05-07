import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { AnalyticsService } from "./analytics.service";

const getDashboardStats = catchAsync(async (req: Request, res: Response) => {
    const result = await AnalyticsService.getDashboardStats();
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Admin stats fetched", data: result });
});

const getSellerStats = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const result = await AnalyticsService.getSellerStats(user.email);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Seller stats fetched", data: result });
});

export const AnalyticsController = { getDashboardStats, getSellerStats };
