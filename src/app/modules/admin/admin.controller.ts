import { Request, Response } from 'express';
import catchAsync from '../../shared/catchAsync';
import sendResponse from '../../shared/sendResponse';
import httpStatus from 'http-status';
import { AdminService } from './admin.service';
import { IJWTPayload } from '../../types/common';
import pick from '../../helper/pick';

// Users
const getAllUsers = catchAsync(async (req: Request, res: Response) => {
    const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const filters = pick(req.query, ['role', 'status', 'search']);
    const result = await AdminService.getAllUsers(options, filters);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Users fetched', meta: result.meta, data: result.data });
});

const getUserById = catchAsync(async (req: Request, res: Response) => {
    const result = await AdminService.getUserById(req.params.id);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'User fetched', data: result });
});

const blockUser = catchAsync(async (req: Request, res: Response) => {
    const result = await AdminService.blockUser(req.params.id);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'User blocked', data: result });
});

const unblockUser = catchAsync(async (req: Request, res: Response) => {
    const result = await AdminService.unblockUser(req.params.id);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'User unblocked', data: result });
});

// Sellers
const getAllSellers = catchAsync(async (req: Request, res: Response) => {
    const options = pick(req.query, ['page', 'limit']);
    const filters = pick(req.query, ['isApproved']);
    const result = await AdminService.getAllSellers(options, filters);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Sellers fetched', meta: result.meta, data: result.data });
});

const getSellerById = catchAsync(async (req: Request, res: Response) => {
    const result = await AdminService.getSellerById(req.params.id);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Seller fetched', data: result });
});

const approveSeller = catchAsync(async (req: Request, res: Response) => {
    const result = await AdminService.approveSeller((req.user as IJWTPayload).email, req.params.id);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Seller approved', data: result });
});

const rejectSeller = catchAsync(async (req: Request, res: Response) => {
    const result = await AdminService.rejectSeller((req.user as IJWTPayload).email, req.params.id, req.body.reason);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Seller rejected', data: result });
});

const updateCommission = catchAsync(async (req: Request, res: Response) => {
    const result = await AdminService.updateCommission(req.params.id, req.body.commissionRate);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Commission updated', data: result });
});

// Disputes
const getAllDisputes = catchAsync(async (req: Request, res: Response) => {
    const options = pick(req.query, ['page', 'limit']);
    const filters = pick(req.query, ['status']);
    const result = await AdminService.getAllDisputes(options, filters);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Disputes fetched', meta: result.meta, data: result.data });
});

const getDisputeById = catchAsync(async (req: Request, res: Response) => {
    const result = await AdminService.getDisputeById(req.params.id);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Dispute fetched', data: result });
});

const resolveDispute = catchAsync(async (req: Request, res: Response) => {
    const result = await AdminService.resolveDispute((req.user as IJWTPayload).email, req.params.id, req.body);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Dispute resolved', data: result });
});

const createDispute = catchAsync(async (req: Request, res: Response) => {
    const result = await AdminService.createDispute(req.user as IJWTPayload, req.params.orderId, req.body);
    sendResponse(res, { statusCode: httpStatus.CREATED, success: true, message: 'Dispute created', data: result });
});

// Fraud flags
const getFraudFlags = catchAsync(async (req: Request, res: Response) => {
    const options = pick(req.query, ['page', 'limit']);
    const result = await AdminService.getFraudFlags(options);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Fraud flags fetched', meta: result.meta, data: result.data });
});

const resolveFraudFlag = catchAsync(async (req: Request, res: Response) => {
    const result = await AdminService.resolveFraudFlag(req.params.id, (req.user as IJWTPayload).email, req.body.notes);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Flag resolved', data: result });
});

// Logs
const getActivityLogs = catchAsync(async (req: Request, res: Response) => {
    const options = pick(req.query, ['page', 'limit']);
    const result = await AdminService.getActivityLogs(options, req.query.adminEmail as string | undefined);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Logs fetched', meta: result.meta, data: result.data });
});

// Finance
const getRevenueOverview = catchAsync(async (req: Request, res: Response) => {
    const period = (req.query.period as 'day' | 'week' | 'month') ?? 'month';
    const result = await AdminService.getRevenueOverview(period);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Revenue overview fetched', data: result });
});

export const AdminController = {
    getAllUsers, getUserById, blockUser, unblockUser,
    getAllSellers, getSellerById, approveSeller, rejectSeller, updateCommission,
    getAllDisputes, getDisputeById, resolveDispute, createDispute,
    getFraudFlags, resolveFraudFlag,
    getActivityLogs, getRevenueOverview
};



