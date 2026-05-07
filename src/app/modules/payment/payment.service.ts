import { prisma } from "../../shared/prisma";
import { stripe } from "../../helper/stripe";
import ApiError from "../../errors/ApiError";
import httpStatus from "http-status";
import { IJWTPayload } from "../../types/common";
import { PaymentStatus } from "@prisma/client";
import Stripe from "stripe";
import config from "../../../config";

const createPaymentIntent = async (user: IJWTPayload, payload: { orderId: string }) => {
    const order = await prisma.order.findUniqueOrThrow({
        where: { id: payload.orderId },
        include: {
            items: {
                include: { product: true }
            }
        }
    });

    if (order.customerEmail !== user.email) {
        throw new ApiError(httpStatus.FORBIDDEN, "You can only pay for your own orders!");
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
        throw new ApiError(httpStatus.BAD_REQUEST, "This order is already paid!");
    }

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(order.totalAmount * 100), // Stripe expects amount in cents
        currency: "usd",
        metadata: {
            orderId: order.id,
            customerEmail: user.email
        }
    });

    // Store transaction ID
    await prisma.order.update({
        where: { id: order.id },
        data: {
            transactionId: paymentIntent.id
        }
    });

    return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: order.totalAmount
    };
};

const handleStripeWebhookEvent = async (event: Stripe.Event) => {
    switch (event.type) {
        case "payment_intent.succeeded": {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            const orderId = paymentIntent.metadata?.orderId;

            if (orderId) {
                await prisma.order.update({
                    where: { id: orderId },
                    data: {
                        paymentStatus: PaymentStatus.PAID,
                        status: "PROCESSING"
                    }
                });
            }

            break;
        }

        case "payment_intent.payment_failed": {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            const orderId = paymentIntent.metadata?.orderId;

            if (orderId) {
                await prisma.order.update({
                    where: { id: orderId },
                    data: {
                        paymentStatus: PaymentStatus.FAILED
                    }
                });
            }

            break;
        }

        default:
            console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }
};

const getPaymentsByOrder = async (orderId: string, user: IJWTPayload) => {
    const order = await prisma.order.findUniqueOrThrow({
        where: { id: orderId }
    });

    if (user.role !== "ADMIN" && order.customerEmail !== user.email) {
        throw new ApiError(httpStatus.FORBIDDEN, "You can only view your own payment details!");
    }

    return {
        orderId: order.id,
        totalAmount: order.totalAmount,
        paymentStatus: order.paymentStatus,
        transactionId: order.transactionId
    };
};

export const PaymentService = {
    createPaymentIntent,
    handleStripeWebhookEvent,
    getPaymentsByOrder
}
