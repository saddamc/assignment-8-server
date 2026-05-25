import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import { PaymentService } from "./payment.service";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { stripe } from "../../helper/stripe";
import config from "../../../config";
import { getParamAsString } from "../../helper/getParam";
import pick from "../../helper/pick";

const handleStripeWebhookEvent = catchAsync(async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = config.stripe.webhook_secret as string;

    let event;
    if (webhookSecret) {
        try {
            event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        } catch (err: any) {
            console.error("⚠️ Webhook signature verification failed:", err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }
    } else {
        // Development mode: parse raw body manually
        try {
            const rawBody = typeof req.body === 'string' ? req.body : req.body.toString();
            event = JSON.parse(rawBody);
        } catch (err: any) {
            console.error("⚠️ Failed to parse webhook body:", err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }
    }

    await PaymentService.handleStripeWebhookEvent(event);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Webhook processed successfully!",
        data: null,
    });
});

const createCheckoutSession = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const result = await PaymentService.createCheckoutSession(user, req.body);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Checkout session created successfully!",
        data: result
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

const verifyStripeSession = catchAsync(async (req: Request, res: Response) => {
    const user = req.user;
    const sessionId = getParamAsString(req.params.sessionId, "sessionId");
    const result = await PaymentService.verifyStripeSession(sessionId, user);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Session verified!",
        data: result
    });
});

const getAllPayments = catchAsync(async (req: Request, res: Response) => {
    const options = pick(req.query, ["page", "limit", "sortBy", "sortOrder"]);
    const result = await PaymentService.getAllPayments(options);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Payments retrieved successfully!",
        meta: result.meta,
        data: result.data
    });
});

const verifyBkashSimulation = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const result = await PaymentService.verifyBkashSimulation(user, req.body);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "bKash/Nagad payment simulation succeeded and verified!",
        data: result
    });
});

export const PaymentController = {
    createCheckoutSession,
    handleStripeWebhookEvent,
    getPaymentsByOrder,
    verifyStripeSession,
    getAllPayments,
    verifyBkashSimulation,
};
