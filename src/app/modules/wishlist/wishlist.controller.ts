import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { WishlistService } from "./wishlist.service";
import { getParamAsString } from "../../helper/getParam";

const toggleWishlist = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const productId = getParamAsString(req.params.productId, "productId");
    const result = await WishlistService.toggleWishlist(user, productId);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: result.message, data: result });
});

const getMyWishlist = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const result = await WishlistService.getMyWishlist(user);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Wishlist fetched successfully", data: result });
});

const isInWishlist = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const productId = getParamAsString(req.params.productId, "productId");
    const result = await WishlistService.isInWishlist(user, productId);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Wishlist status fetched", data: result });
});

export const WishlistController = { toggleWishlist, getMyWishlist, isInWishlist };
