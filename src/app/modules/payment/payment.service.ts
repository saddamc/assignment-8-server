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
        amount: Math.round(order.totalAmount * 100),
        currency: "usd",
        metadata: {
            orderId: order.id,
            customerEmail: user.email
        }
    });

    await prisma.order.update({
        where: { id: order.id },
        data: { transactionId: paymentIntent.id }
    });

    return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: order.totalAmount
    };
};

const createCheckoutSession = async (user: IJWTPayload, payload: { orderId: string }) => {
    const order = await prisma.order.findUniqueOrThrow({
        where: { id: payload.orderId },
        include: {
            items: {
                include: {
                    product: {
                        select: { name: true, images: true }
                    }
                }
            }
        }
    });

    if (order.customerEmail !== user.email) {
        throw new ApiError(httpStatus.FORBIDDEN, "You can only pay for your own orders!");
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
        throw new ApiError(httpStatus.BAD_REQUEST, "This order is already paid!");
    }

    const clientBaseUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:3000";

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = order.items.map((item) => ({
        price_data: {
            currency: "usd",
            product_data: {
                name: item.product.name,
                images: item.product.images?.slice(0, 1) ?? [],
            },
            unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: lineItems,
        mode: "payment",
        success_url: `${clientBaseUrl}/checkout/success?orderId=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${clientBaseUrl}/checkout?cancelled=1&orderId=${order.id}`,
        customer_email: user.email,
        metadata: {
            orderId: order.id,
            customerEmail: user.email,
        },
    });

    await prisma.order.update({
        where: { id: order.id },
        data: { stripeSessionId: session.id }
    });

    return { url: session.url, sessionId: session.id };
};

/** Webhook handler processes stock decrement internally via the transaction below */
const handleStripeWebhookEvent = async (event: Stripe.Event) => {
    switch (event.type) {
        // Checkout Session flow (preferred)
        case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            const orderId = session.metadata?.orderId;

            if (orderId && session.payment_status === "paid") {
                const order = await prisma.order.findUnique({
                    where: { id: orderId },
                    include: { items: true }
                });
                if (order && order.paymentStatus !== PaymentStatus.PAID) {
                    await prisma.$transaction(async (tnx) => {
                        // Decrement stock
                        for (const item of order.items) {
                            await tnx.product.update({
                                where: { id: item.productId },
                                data: { stock: { decrement: item.quantity } }
                            });
                        }
                        // Clear customer's DB cart
                        const cart = await tnx.cart.findUnique({ where: { customerEmail: order.customerEmail } });
                        if (cart) {
                            await tnx.cartItem.deleteMany({ where: { cartId: cart.id } });
                        }
                        // Mark paid + processing
                        const paymentIntentId =
                            typeof session.payment_intent === 'string'
                                ? session.payment_intent
                                : session.payment_intent?.id;

                        await tnx.order.update({
                            where: { id: orderId },
                            data: {
                                paymentStatus: PaymentStatus.PAID,
                                status: "PROCESSING",
                                transactionId: paymentIntentId ?? undefined,
                                stripeSessionId: session.id // Ensure session ID is stored
                            }
                        });
                    });
                }
            }
            break;
        }

        // PaymentIntent flow (legacy / fallback)
        case "payment_intent.succeeded": {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            const orderId = paymentIntent.metadata?.orderId;

            if (orderId) {
                const order = await prisma.order.findUnique({
                    where: { id: orderId },
                    include: { items: true }
                });
                if (order && order.paymentStatus !== PaymentStatus.PAID) {
                    await prisma.$transaction(async (tnx) => {
                        for (const item of order.items) {
                            await tnx.product.update({
                                where: { id: item.productId },
                                data: { stock: { decrement: item.quantity } }
                            });
                        }
                        const cart = await tnx.cart.findUnique({ where: { customerEmail: order.customerEmail } });
                        if (cart) {
                            await tnx.cartItem.deleteMany({ where: { cartId: cart.id } });
                        }
                        await tnx.order.update({
                            where: { id: orderId },
                            data: {
                                paymentStatus: PaymentStatus.PAID,
                                status: "PROCESSING"
                            }
                        });
                    });
                }
            }
            break;
        }

        case "payment_intent.payment_failed": {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            const orderId = paymentIntent.metadata?.orderId;

            if (orderId) {
                await prisma.order.update({
                    where: { id: orderId },
                    data: { paymentStatus: PaymentStatus.FAILED }
                });
            }
            break;
        }

        default:
            console.log(`ℹ️ Unhandled Stripe event: ${event.type}`);
    }
};

const getPaymentsByOrder = async (orderId: string, user: IJWTPayload) => {
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });

    if (user.role !== "ADMIN" && order.customerEmail !== user.email) {
        throw new ApiError(httpStatus.FORBIDDEN, "You can only view your own payment details!");
    }

    return {
        orderId: order.id,
        totalAmount: order.totalAmount,
        paymentStatus: order.paymentStatus,
        transactionId: order.transactionId,
        stripeSessionId: order.stripeSessionId,
    };
};

const completePaymentManually = async (orderId: string) => {
    console.log("🔄 Manually completing payment for order:", orderId);

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true }
    });

    if (!order) {
        throw new ApiError(httpStatus.NOT_FOUND, "Order not found!");
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Order is already paid!");
    }

    // Manually complete the payment (simulate webhook logic)
    await prisma.$transaction(async (tnx) => {
        // Decrement stock
        for (const item of order.items) {
            await tnx.product.update({
                where: { id: item.productId },
                data: { stock: { decrement: item.quantity } }
            });
        }

        // Clear customer's DB cart
        const cart = await tnx.cart.findUnique({ where: { customerEmail: order.customerEmail } });
        if (cart) {
            await tnx.cartItem.deleteMany({ where: { cartId: cart.id } });
        }

        // Mark paid + processing
        await tnx.order.update({
            where: { id: orderId },
            data: {
                paymentStatus: PaymentStatus.PAID,
                status: "PROCESSING",
                transactionId: `manual_${Date.now()}`, // Mock transaction ID
                stripeSessionId: order.stripeSessionId || `manual_session_${Date.now()}`
            }
        });
    });

    console.log("✅ Payment completed manually for order:", orderId);
    return { orderId, status: "PAID" };
};

export const PaymentService = {
    createPaymentIntent,
    createCheckoutSession,
    handleStripeWebhookEvent,
    getPaymentsByOrder,
    completePaymentManually,
    verifyStripeSession,
}

// ---- verifyStripeSession ----
async function verifyStripeSession(sessionId: string, user: IJWTPayload) {
    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
        return { paid: false };
    }

    // Find the order associated with this session
    const order = await prisma.order.findFirst({
        where: { stripeSessionId: sessionId },
        include: { items: true }
    });

    if (!order) {
        return { paid: true, message: "Session paid but order not found" };
    }

    // Auth check: only the order owner or admin
    if (user.role !== "ADMIN" && order.customerEmail !== user.email) {
        throw new ApiError(httpStatus.FORBIDDEN, "Unauthorized");
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
        return { paid: true, orderId: order.id, alreadyProcessed: true };
    }

    // Decrement stock and mark paid (same logic as webhook)
    await prisma.$transaction(async (tx) => {
        for (const item of order.items) {
            await tx.product.update({
                where: { id: item.productId },
                data: { stock: { decrement: item.quantity } }
            });
        }

        // Clear customer's cart
        const cart = await tx.cart.findUnique({ where: { customerEmail: order.customerEmail } });
        if (cart) await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

        const paymentIntentId =
            typeof session.payment_intent === 'string'
                ? session.payment_intent
                : session.payment_intent?.id;

        await tx.order.update({
            where: { id: order.id },
            data: {
                paymentStatus: PaymentStatus.PAID,
                status: "PROCESSING",
                transactionId: paymentIntentId ?? undefined,
            }
        });
    });

    return { paid: true, orderId: order.id, alreadyProcessed: false };
}
