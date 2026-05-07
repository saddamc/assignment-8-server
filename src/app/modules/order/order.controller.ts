import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import { OrderService } from "./order.service";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import pick from "../../helper/pick";
import { getParamAsString } from "../../helper/getParam";

const createOrder = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const result = await OrderService.createOrder(user, req.body);

    sendResponse(res, {
        statusCode: 201,
        success: true,
        message: "Order created successfully!",
        data: result
    });
});

const getMyOrders = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const options = pick(req.query, ["page", "limit", "sortBy", "sortOrder"]);

    const result = await OrderService.getMyOrders(user, options);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Orders retrieved successfully!",
        meta: result.meta,
        data: result.data
    });
});

const getOrderById = catchAsync(async (req: Request, res: Response) => {
    const id = getParamAsString(req.params.id, "id");
    const user = req.user!;
    const result = await OrderService.getOrderById(id, user);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Order retrieved successfully!",
        data: result
    });
});

const getAllOrders = catchAsync(async (req: Request, res: Response) => {
    const options = pick(req.query, ["page", "limit", "sortBy", "sortOrder"]);
    const filters = pick(req.query, ["status", "paymentStatus"]);

    const result = await OrderService.getAllOrders(options, filters);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "All orders retrieved successfully!",
        meta: result.meta,
        data: result.data
    });
});

const updateOrderStatus = catchAsync(async (req: Request, res: Response) => {
    const id = getParamAsString(req.params.id, "id");
    const result = await OrderService.updateOrderStatus(id, req.body);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Order status updated successfully!",
        data: result
    });
});

export const OrderController = {
    createOrder,
    getMyOrders,
    getOrderById,
    getAllOrders,
    updateOrderStatus
}
