import { OrderStatus } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import ApiError from "../../errors/ApiError";
import httpStatus from "http-status";
import { IJWTPayload } from "../../types/common";
import { IOptions, paginationHelper } from "../../helper/paginationHelper";

const createOrder = async (user: IJWTPayload, payload: { shippingAddress: string }) => {
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

    // Calculate total and validate stock
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

    // Create order in a transaction
    const result = await prisma.$transaction(async (tnx) => {
        // Create order
        const order = await tnx.order.create({
            data: {
                customerEmail: user.email,
                totalAmount,
                shippingAddress: payload.shippingAddress
            }
        });

        // Create order items and update stock
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

            // Reduce stock
            await tnx.product.update({
                where: { id: item.productId },
                data: {
                    stock: {
                        decrement: item.quantity
                    }
                }
            });
        }

        // Clear cart
        await tnx.cartItem.deleteMany({
            where: { cartId: cart.id }
        });

        return order;
    });

    // Get the full order with items
    const fullOrder = await prisma.order.findUnique({
        where: { id: result.id },
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
            }
        }
    });

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
    await prisma.order.findUniqueOrThrow({
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
        await prisma.order.update({
            where: { id },
            data: payload
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

export const OrderService = {
    createOrder,
    getMyOrders,
    getOrderById,
    getAllOrders,
    updateOrderStatus
}
