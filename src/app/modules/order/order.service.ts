import { OrderStatus } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import ApiError from "../../errors/ApiError";
import httpStatus from "http-status";
import { IJWTPayload } from "../../types/common";
import { IOptions, paginationHelper } from "../../helper/paginationHelper";

interface ICreateOrderPayload {
    shippingAddress?: string;
    addressId?: string;
    contactNumber?: string;
    couponCode?: string;
    paymentMethod?: "STRIPE" | "COD";
    notes?: string;
}

const createOrder = async (user: IJWTPayload, payload: ICreateOrderPayload) => {
    const { shippingAddress, addressId, contactNumber, couponCode, paymentMethod = "STRIPE", notes } = payload;

    // Get customer's cart with items
    const cart = await prisma.cart.findUnique({
        where: { customerEmail: user.email },
        include: {
            items: {
                include: { product: true }
            }
        }
    });

    if (!cart || cart.items.length === 0) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Cart is empty!");
    }

    // Get address details if addressId is provided
    let addressDetails = null;
    let finalShippingAddress = shippingAddress;
    let finalContactNumber = contactNumber;

    console.log('Order creation - addressId:', addressId, 'shippingAddress:', shippingAddress, 'contactNumber:', contactNumber);

    if (addressId) {
        addressDetails = await prisma.address.findUnique({
            where: { id: addressId, customerEmail: user.email }
        });

        console.log('Address lookup result:', addressDetails);

        if (!addressDetails) {
            throw new ApiError(httpStatus.BAD_REQUEST, "Invalid address selected!");
        }

        // Format shipping address from address details
        finalShippingAddress = `${addressDetails.fullName}, ${addressDetails.line1}${addressDetails.line2 ? ', ' + addressDetails.line2 : ''}, ${addressDetails.city}, ${addressDetails.state} ${addressDetails.postalCode}, ${addressDetails.country}`;

        // Use phone from address if not provided separately
        finalContactNumber = contactNumber || addressDetails.phone;

        console.log('Final shipping address:', finalShippingAddress, 'Final contact number:', finalContactNumber);
    }

    // Calculate total and validate stock (soft-check only — stock reserved on payment)
    let totalAmount = 0;
    for (const item of cart.items) {
        if (item.product.stock < item.quantity) {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                `Insufficient stock for "${item.product.name}". Available: ${item.product.stock}`
            );
        }
        const discountedPrice = item.product.price * (1 - item.product.discount / 100);
        totalAmount += discountedPrice * item.quantity;
    }

    // Apply coupon if provided
    let discountAmount = 0;
    if (couponCode) {
        const coupon = await prisma.coupon.findFirst({
            where: { code: couponCode, isActive: true }
        });
        if (coupon && (!coupon.expiresAt || coupon.expiresAt > new Date())) {
            if (totalAmount >= coupon.minOrderAmount) {
                discountAmount = coupon.discountType === "PERCENTAGE"
                    ? totalAmount * (coupon.discountValue / 100)
                    : coupon.discountValue;
                discountAmount = Math.min(discountAmount, totalAmount);
            }
        }
    }

    const finalTotal = totalAmount - discountAmount;

    // Create order in a transaction (NO stock decrement here — deducted after payment)
    const result = await prisma.$transaction(async (tnx) => {
        const order = await tnx.order.create({
            data: {
                customerEmail: user.email,
                totalAmount: finalTotal,
                discountAmount,
                couponCode: couponCode ?? null,
                shippingAddress: finalShippingAddress ?? null,
                addressId: addressId ?? null,
                contactNumber: finalContactNumber ?? null,
                paymentMethod: paymentMethod.toUpperCase(), // Ensure consistent casing
                notes: notes ?? null,
                // COD orders go straight to PENDING; online orders await payment
                status: paymentMethod === "COD" ? "PENDING" : "PENDING",
                paymentStatus: paymentMethod === "COD" ? "UNPAID" : "UNPAID"
            }
        });

        for (const item of cart.items) {
            const discountedPrice = item.product.price * (1 - item.product.discount / 100);
            await tnx.orderItem.create({
                data: {
                    orderId: order.id,
                    productId: item.productId,
                    quantity: item.quantity,
                    price: discountedPrice
                }
            });
        }

        // For COD orders, clear the cart now; for online payment, cart is cleared in webhook
        if (paymentMethod === "COD") {
            await tnx.cartItem.deleteMany({ where: { cartId: cart.id } });
        }

        return order;
    });

    const fullOrder = await prisma.order.findUnique({
        where: { id: result.id },
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

    // Notify sellers about new order
    try {
        const sellerNotifications = new Map<string, { products: string[], total: number }>();

        // Group order items by seller
        for (const item of cart.items) {
            const sellerEmail = item.product.sellerEmail;
            if (!sellerNotifications.has(sellerEmail)) {
                sellerNotifications.set(sellerEmail, { products: [], total: 0 });
            }
            const sellerData = sellerNotifications.get(sellerEmail)!;
            sellerData.products.push(`${item.product.name} (x${item.quantity})`);
            sellerData.total += (item.product.price * (1 - item.product.discount / 100)) * item.quantity;
        }

        // Create notifications for each seller
        for (const [sellerEmail, data] of sellerNotifications) {
            await prisma.notification.create({
                data: {
                    customerEmail: sellerEmail, // Sellers receive notifications as "customers" in this system
                    type: "ORDER_PLACED",
                    title: "New Order Received",
                    message: `You have received a new order #${result.id.slice(-8).toUpperCase()} for: ${data.products.join(", ")}. Total: $${data.total.toFixed(2)}`,
                    metadata: {
                        orderId: result.id,
                        products: data.products,
                        totalAmount: data.total
                    }
                }
            });
        }

        console.log(`📢 Notified ${sellerNotifications.size} seller(s) about new order ${result.id}`);
    } catch (error) {
        console.error("Failed to notify sellers:", error);
        // Don't fail the order creation if notifications fail
    }

    return fullOrder;
};

const getMyOrders = async (user: IJWTPayload, options: IOptions) => {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(options);

    const result = await prisma.order.findMany({
        where: { customerEmail: user.email },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
            items: {
                include: {
                    product: {
                        select: {
                            name: true,
                            images: true,
                            price: true
                        }
                    }
                }
            }
        }
    });

    const total = await prisma.order.count({
        where: { customerEmail: user.email }
    });

    return {
        meta: { page, limit, total },
        data: result
    };
};

const getOrderById = async (id: string, user: IJWTPayload) => {
    const order = await prisma.order.findUniqueOrThrow({
        where: { id },
        include: {
            items: {
                include: {
                    product: {
                        include: {
                            category: true,
                            seller: {
                                select: {
                                    name: true,
                                    storeName: true
                                }
                            }
                        }
                    }
                }
            },
            customer: {
                select: {
                    name: true,
                    email: true,
                    contactNumber: true,
                    address: true
                }
            }
        }
    });

    // Only the customer who placed the order, or admin can view
    if (user.role !== "ADMIN" && order.customerEmail !== user.email) {
        throw new ApiError(httpStatus.FORBIDDEN, "You can only view your own orders!");
    }

    return order;
};

const getAllOrders = async (options: IOptions, filters?: any) => {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(options);

    const whereConditions: any = {};

    if (filters?.status) {
        whereConditions.status = filters.status;
    }

    if (filters?.paymentStatus) {
        whereConditions.paymentStatus = filters.paymentStatus;
    }

    const result = await prisma.order.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
            items: {
                include: {
                    product: {
                        select: {
                            name: true,
                            images: true
                        }
                    }
                }
            },
            customer: {
                select: {
                    name: true,
                    email: true
                }
            }
        }
    });

    const total = await prisma.order.count({ where: whereConditions });

    return {
        meta: { page, limit, total },
        data: result
    };
};

const updateOrderStatus = async (id: string, payload: { status: OrderStatus }) => {
    const order = await prisma.order.findUniqueOrThrow({
        where: { id }
    });

    // If cancelling, restore stock
    if (payload.status === OrderStatus.CANCELLED) {
        const orderItems = await prisma.orderItem.findMany({
            where: { orderId: id }
        });

        await prisma.$transaction(async (tnx) => {
            for (const item of orderItems) {
                await tnx.product.update({
                    where: { id: item.productId },
                    data: {
                        stock: {
                            increment: item.quantity
                        }
                    }
                });
            }

            await tnx.order.update({
                where: { id },
                data: payload
            });
        });
    } else {
        // For COD orders, mark as paid when delivered
        const updateData: any = { ...payload };
        if (payload.status === OrderStatus.DELIVERED && order.paymentMethod === "COD") {
            updateData.paymentStatus = "PAID";
        }

        await prisma.order.update({
            where: { id },
            data: updateData
        });
    }

    const updatedOrder = await prisma.order.findUnique({
        where: { id },
        include: {
            items: {
                include: { product: true }
            }
        }
    });

    return updatedOrder;
};

const cancelOrder = async (user: IJWTPayload, id: string) => {
    const order = await prisma.order.findFirst({
        where: { id, customerEmail: user.email },
        include: { items: true }
    });
    if (!order) throw new ApiError(httpStatus.NOT_FOUND, 'Order not found');
    if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.CANCELLED) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'This order cannot be cancelled');
    }

    await prisma.$transaction(async (tnx) => {
        // Only restore stock if it was already decremented (i.e. order was PAID / COD)
        const stockWasDeducted = order.paymentStatus === "PAID" || order.paymentMethod === "COD";
        if (stockWasDeducted) {
            for (const item of order.items) {
                await tnx.product.update({
                    where: { id: item.productId },
                    data: { stock: { increment: item.quantity } }
                });
            }
        }
        await tnx.order.update({
            where: { id },
            data: {
                status: OrderStatus.CANCELLED,
                paymentStatus: order.paymentStatus === "PAID" ? "REFUNDED" : order.paymentStatus
            }
        });
    });

    return prisma.order.findUnique({
        where: { id },
        include: { items: { include: { product: { select: { name: true } } } } }
    });
};

const addShipment = async (user: IJWTPayload, orderId: string, payload: {
    carrier?: string;
    trackingNumber?: string;
    trackingUrl?: string;
    estimatedDelivery?: string;
    notes?: string;
}) => {
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });

    if (user.role !== "ADMIN") {
        // Seller can only update shipments on their own orders
        const sellerItem = await prisma.orderItem.findFirst({
            where: { orderId, product: { sellerEmail: user.email } }
        });
        if (!sellerItem) throw new ApiError(httpStatus.FORBIDDEN, "Not your order");
    }

    const shipment = await prisma.shipment.upsert({
        where: { orderId },
        update: {
            carrier: payload.carrier,
            trackingNumber: payload.trackingNumber,
            trackingUrl: payload.trackingUrl,
            estimatedDelivery: payload.estimatedDelivery ? new Date(payload.estimatedDelivery) : undefined,
            notes: payload.notes,
            shippedAt: payload.trackingNumber && !await prisma.shipment.findUnique({ where: { orderId } }).then(s => s?.shippedAt)
                ? new Date() : undefined
        },
        create: {
            orderId,
            carrier: payload.carrier,
            trackingNumber: payload.trackingNumber,
            trackingUrl: payload.trackingUrl,
            estimatedDelivery: payload.estimatedDelivery ? new Date(payload.estimatedDelivery) : undefined,
            notes: payload.notes,
            shippedAt: payload.trackingNumber ? new Date() : undefined
        }
    });

    // Auto-advance order to SHIPPED if tracking added
    if (payload.trackingNumber && order.status === "PACKED") {
        await prisma.order.update({ where: { id: orderId }, data: { status: "SHIPPED" } });
    }

    return shipment;
};

const getSellerOrders = async (user: IJWTPayload, options: IOptions) => {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(options);
    const [data, total] = await prisma.$transaction([
        prisma.order.findMany({
            where: { items: { some: { product: { sellerEmail: user.email } } } },
            include: {
                items: { where: { product: { sellerEmail: user.email } }, include: { product: { select: { name: true, images: true, sellerEmail: true } } } },
                customer: { select: { name: true, email: true } },
                address: true,
            },
            skip, take: limit, orderBy: { [sortBy]: sortOrder }
        }),
        prisma.order.count({ where: { items: { some: { product: { sellerEmail: user.email } } } } })
    ]);
    return { meta: { page, limit, total }, data };
};

export const OrderService = {
    createOrder,
    getMyOrders,
    getOrderById,
    getAllOrders,
    updateOrderStatus,
    cancelOrder,
    getSellerOrders,
    addShipment,
}

