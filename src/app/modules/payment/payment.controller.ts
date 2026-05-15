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
    console.log("🔄 Webhook received:", req.body?.type, req.body?.data?.object?.id);

    // For development, allow unsigned webhooks if secret is not set
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = config.stripe.webhook_secret as string;

    let event;
    if (webhookSecret) {
        // Production: verify signature
        try {
            event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        } catch (err: any) {
            console.error("⚠️ Webhook signature verification failed:", err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }
    } else {
        // Development: accept webhook without signature verification
        console.log("⚠️ DEVELOPMENT MODE: Accepting webhook without signature verification");
        event = req.body;
    }

    const result = await PaymentService.handleStripeWebhookEvent(event);

    console.log("✅ Webhook processed successfully for event:", event.type);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Webhook processed successfully!",
        data: result,
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

const completePaymentManually = catchAsync(async (req: Request, res: Response) => {
    const orderId = getParamAsString(req.params.orderId, "orderId");
    const result = await PaymentService.completePaymentManually(orderId);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Payment completed manually!",
        data: result
    });
});

const verifyStripeSession = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const sessionId = getParamAsString(req.params.sessionId, "sessionId");
    const result = await PaymentService.verifyStripeSession(sessionId, user);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Session verified!",
        data: result
    });
});

export const PaymentController = {
    createPaymentIntent,
    createCheckoutSession,
    handleStripeWebhookEvent,
    getPaymentsByOrder,
    completePaymentManually,
    verifyStripeSession,
}
