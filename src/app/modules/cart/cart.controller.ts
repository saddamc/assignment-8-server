import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import { CartService } from "./cart.service";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { getParamAsString } from "../../helper/getParam";

const getMyCart = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const result = await CartService.getMyCart(user);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Cart retrieved successfully!",
        data: result
    });
});

const addToCart = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const result = await CartService.addToCart(user, req.body);

    sendResponse(res, {
        statusCode: 201,
        success: true,
        message: "Item added to cart!",
        data: result
    });
});

const updateCartItem = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const cartItemId = getParamAsString(req.params.cartItemId, "cartItemId");
    const result = await CartService.updateCartItem(user, cartItemId, req.body);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Cart item updated!",
        data: result
    });
});

const removeFromCart = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const cartItemId = getParamAsString(req.params.cartItemId, "cartItemId");
    const result = await CartService.removeFromCart(user, cartItemId);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Item removed from cart!",
        data: result
    });
});

const clearCart = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const result = await CartService.clearCart(user);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Cart cleared!",
        data: result
    });
});

export const CartController = {
    getMyCart,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart
}
