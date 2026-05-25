import { prisma } from "../../shared/prisma";
import { stripe } from "../../helper/stripe";
import ApiError from "../../errors/ApiError";
import httpStatus from "http-status";
import { IJWTPayload } from "../../types/common";
import { PaymentStatus, OrderStatus } from "@prisma/client";
import Stripe from "stripe";
import { IOptions, paginationHelper } from "../../helper/paginationHelper";

/**
 * Industry-Standard Payment Processor
 * Decoupled from notifications to ensure payment success is never blocked.
 */
const processSuccessfulPayment = async (orderId: string, transactionId: string, stripeSessionId?: string) => {
    console.log(`🚀 [PAYMENT ENGINE] Processing Order: ${orderId} | Trans: ${transactionId}`);
    
    // 1. Core Payment Transaction (Stock & Status)
    const result = await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({
            where: { id: orderId },
            include: { items: true }
        });

        if (!order) throw new Error(`Order ${orderId} not found.`);
        if (order.paymentStatus === PaymentStatus.PAID) return order;

        // Update Order
        const updatedOrder = await tx.order.update({
            where: { id: order.id },
            data: {
                paymentStatus: PaymentStatus.PAID,
                status: OrderStatus.PROCESSING,
                transactionId: transactionId,
                stripeSessionId: stripeSessionId || order.stripeSessionId
            }
        });

        // Reduce Stock
        for (const item of order.items) {
            if (item.variantId) {
                await tx.productVariant.update({
                    where: { id: item.variantId },
                    data: { stock: { decrement: item.quantity } }
                });
            } else {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stock: { decrement: item.quantity } }
                });
            }
        }

        // Clear Cart
        const cart = await tx.cart.findUnique({ where: { customerEmail: order.customerEmail } });
        if (cart) {
            await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        }

        return updatedOrder;
    });

    // 2. Background Notifications (Outside Transaction)
    // This way, if notifications fail, the payment is still SUCCESSFUL.
    try {
        const orderWithItems = await prisma.order.findUnique({
            where: { id: orderId },
            include: { items: { include: { product: true } } }
        });

        if (orderWithItems) {
            const sellerNotifications = new Map<string, { products: string[], total: number }>();
            for (const item of orderWithItems.items) {
                const sellerEmail = item.product.sellerEmail;
                if (!sellerNotifications.has(sellerEmail)) {
                    sellerNotifications.set(sellerEmail, { products: [], total: 0 });
                }
                const sellerData = sellerNotifications.get(sellerEmail)!;
                sellerData.products.push(`${item.product.name} (x${item.quantity})`);
                sellerData.total += (item.price * item.quantity);
            }

            for (const [sellerEmail, data] of sellerNotifications) {
                await prisma.notification.create({
                    data: {
                        customerEmail: sellerEmail,
                        type: "ORDER_PLACED",
                        title: "New Payment Received",
                        message: `Order #${orderId.slice(-8).toUpperCase()} for ${data.products.join(", ")} is PAID. Total: $${data.total.toFixed(2)}`,
                        metadata: { orderId, products: data.products, totalAmount: data.total }
                    }
                }).catch(e => console.warn(`Notification failed for ${sellerEmail}:`, e.message));
            }
        }
    } catch (error) {
        console.error("Post-payment tasks failed:", error);
    }

    return result;
};

const createCheckoutSession = async (user: IJWTPayload, payload: { orderId: string }) => {
    const order = await prisma.order.findUniqueOrThrow({
        where: { id: payload.orderId },
        include: { items: { include: { product: { select: { name: true, images: true } } } } }
    });

    if (order.customerEmail !== user.email) throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");
    if (order.paymentStatus === PaymentStatus.PAID) throw new ApiError(httpStatus.BAD_REQUEST, "Already paid");

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

    if (order.shippingAmount > 0) {
        lineItems.push({
            price_data: {
                currency: "usd",
                product_data: { name: "Shipping Fee" },
                unit_amount: Math.round(order.shippingAmount * 100),
            },
            quantity: 1,
        });
    }

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: lineItems,
        mode: "payment",
        success_url: `${clientBaseUrl}/checkout/success?orderId=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${clientBaseUrl}/checkout?cancelled=1&orderId=${order.id}`,
        customer_email: user.email,
        metadata: { orderId: order.id, customerEmail: user.email },
    });

    await prisma.order.update({
        where: { id: order.id },
        data: { stripeSessionId: session.id }
    });

    return { url: session.url };
};

const handleStripeWebhookEvent = async (event: Stripe.Event) => {
    const data = event.data.object as any;
    const orderId = data.metadata?.orderId;
    const transactionId = data.payment_intent || data.id;

    if (orderId && (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded")) {
        await processSuccessfulPayment(orderId, transactionId, data.id);
    }
};

const verifyStripeSession = async (sessionId: string, user?: IJWTPayload) => {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") return { paid: false };

    const orderId = session.metadata?.orderId;
    if (!orderId) throw new ApiError(httpStatus.BAD_REQUEST, "Order metadata missing");

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    if (user && user.role !== "ADMIN" && order.customerEmail !== user.email) throw new ApiError(httpStatus.FORBIDDEN, "Unauthorized");

    if (order.paymentStatus !== PaymentStatus.PAID) {
        const transactionId = typeof session.payment_intent === 'string' ? session.payment_intent : session.id;
        await processSuccessfulPayment(orderId, transactionId, session.id);
    }

    return { paid: true, orderId };
};

const getPaymentsByOrder = async (orderId: string, user: IJWTPayload) => {
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    if (user.role !== "ADMIN" && order.customerEmail !== user.email) throw new ApiError(httpStatus.FORBIDDEN, "Unauthorized");
    return {
        orderId: order.id,
        totalAmount: order.totalAmount,
        paymentStatus: order.paymentStatus,
        transactionId: order.transactionId,
        stripeSessionId: order.stripeSessionId,
    };
};

const getAllPayments = async (options: IOptions) => {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(options);

    const result = await prisma.order.findMany({
        skip,
        take: limit,
        orderBy: {
            [sortBy]: sortOrder
        },
        include: {
            customer: {
                select: {
                    name: true,
                    email: true
                }
            }
        }
    });

    const total = await prisma.order.count();

    const payments = result.map((order) => ({
        id: order.id,
        transactionId: order.transactionId || order.id,
        orderId: order.id,
        amount: order.totalAmount,
        method: order.paymentMethod,
        status: order.paymentStatus,
        createdAt: order.createdAt,
        order: {
            id: order.id,
            customer: {
                name: order.customer?.name || "Customer",
                email: order.customer?.email || order.customerEmail
            }
        }
    }));

    return {
        meta: {
            page,
            limit,
            total
        },
        data: payments
    };
};

const verifyBkashSimulation = async (user: IJWTPayload, payload: { orderId: string; paymentMethod: string; transactionId?: string }) => {
    const order = await prisma.order.findUniqueOrThrow({
        where: { id: payload.orderId }
    });

    if (order.customerEmail !== user.email) throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");
    if (order.paymentStatus === PaymentStatus.PAID) throw new ApiError(httpStatus.BAD_REQUEST, "Already paid");

    const txnId = payload.transactionId || `TXN-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;

    // Process successful payment inside database
    const updatedOrder = await processSuccessfulPayment(order.id, txnId);

    // Also update order paymentMethod to the selected one (e.g. BKASH or NAGAD)
    await prisma.order.update({
        where: { id: order.id },
        data: { paymentMethod: payload.paymentMethod.toUpperCase() }
    });

    return updatedOrder;
};

export const PaymentService = {
    createCheckoutSession,
    handleStripeWebhookEvent,
    getPaymentsByOrder,
    verifyStripeSession,
    getAllPayments,
    verifyBkashSimulation,
};
