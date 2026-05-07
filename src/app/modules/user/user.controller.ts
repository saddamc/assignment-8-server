import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import { UserService } from "./user.service";
import sendResponse from "../../shared/sendResponse";
import pick from "../../helper/pick";
import { userFilterableFields } from "./user.constant";
import httpStatus from "http-status";
import { getParamAsString } from "../../helper/getParam";

const createCustomer = catchAsync(async (req: Request, res: Response) => {
    const result = await UserService.createCustomer(req);

    sendResponse(res, {
        statusCode: 201,
        success: true,
        message: "Customer created successfully!",
        data: result
    })
})

const createSeller = catchAsync(async (req: Request, res: Response) => {

    const result = await UserService.createSeller(req);
    sendResponse(res, {
        statusCode: 201,
        success: true,
        message: "Seller created successfully!",
        data: result
    })
});

const createAdmin = catchAsync(async (req: Request, res: Response) => {

    const result = await UserService.createAdmin(req);
    sendResponse(res, {
        statusCode: 201,
        success: true,
        message: "Admin created successfully!",
        data: result
    })
});

const getAllFromDB = catchAsync(async (req: Request, res: Response) => {
    const filters = pick(req.query, userFilterableFields)
    const options = pick(req.query, ["page", "limit", "sortBy", "sortOrder"])

    const result = await UserService.getAllFromDB(filters, options);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Users retrieved successfully!",
        meta: result.meta,
        data: result.data
    })
})

const getMyProfile = catchAsync(async (req: Request, res: Response) => {

    const user = req.user!;

    const result = await UserService.getMyProfile(user);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "My profile data fetched!",
        data: result
    })
});

const changeProfileStatus = catchAsync(async (req: Request, res: Response) => {

    const id = getParamAsString(req.params.id, "id");
    const result = await UserService.changeProfileStatus(id, req.body)

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "User profile status changed!",
        data: result
    })
});

const updateMyProfile = catchAsync(async (req: Request, res: Response) => {

    const user = req.user!;

    const result = await UserService.updateMyProfile(user, req);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "My profile updated!",
        data: result
    })
});

export const UserController = {
    createCustomer,
    createSeller,
    createAdmin,
    getAllFromDB,
    getMyProfile,
    changeProfileStatus,
    updateMyProfile
}
