import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import { PaymentService } from "./payment.service";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { stripe } from "../../helper/stripe";
import config from "../../../config";
import { getParamAsString } from "../../helper/getParam";

const createPaymentIntent = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const result = await PaymentService.createPaymentIntent(user, req.body);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Payment intent created successfully!",
        data: result
    });
});

const handleStripeWebhookEvent = catchAsync(async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = config.stripe.webhook_secret as string;

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
        console.error("⚠️ Webhook signature verification failed:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const result = await PaymentService.handleStripeWebhookEvent(event);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Webhook processed successfully!",
        data: result,
    });
});

const getPaymentsByOrder = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const orderId = getParamAsString(req.params.orderId, "orderId");
    const result = await PaymentService.getPaymentsByOrder(orderId, user);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Payment details retrieved successfully!",
        data: result
    });
});

export const PaymentController = {
    createPaymentIntent,
    handleStripeWebhookEvent,
    getPaymentsByOrder
}
