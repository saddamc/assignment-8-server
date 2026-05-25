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
    paymentMethod?: "STRIPE" | "COD" | "BKASH" | "NAGAD";
    notes?: string;
}

interface IShippingRule {
    country?: string;
    state?: string;
    city?: string;
    postalCode?: string;
    line1Contains?: string;
    charge: number;
    priority?: number;
    isActive?: boolean;
}

interface IShippingLocation {
    shippingAddress?: string | null;
    country?: string | null;
    state?: string | null;
    city?: string | null;
    postalCode?: string | null;
    line1?: string | null;
}

const normalize = (value?: string | null) => String(value || '').trim().toLowerCase();

const toNumber = (value: unknown, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const matchesExact = (actual?: string | null, expected?: string | null) => {
    if (!expected) return true;
    return normalize(actual) === normalize(expected);
};

const matchesContains = (actual?: string | null, expected?: string | null) => {
    if (!expected) return true;
    return normalize(actual).includes(normalize(expected));
};

const resolveShippingCharge = async (location: IShippingLocation) => {
    const configRows = await prisma.siteConfig.findMany({
        where: { key: { in: ['shipping_default_charge', 'shipping_rules'] } }
    });

    const defaultCharge = toNumber(configRows.find((c) => c.key === 'shipping_default_charge')?.value, 100);
    const rulesRaw = configRows.find((c) => c.key === 'shipping_rules')?.value;

    let rules: IShippingRule[] = [];
    if (rulesRaw) {
        try {
            const parsed = JSON.parse(rulesRaw);
            if (Array.isArray(parsed)) {
                rules = parsed.filter((r) => typeof r === 'object' && r && Number.isFinite(Number(r.charge))) as IShippingRule[];
            }
        } catch {
            rules = [];
        }
    }

    if (rules.length === 0) {
        rules = [{ state: 'Dhaka', charge: 60, priority: 100 }, { charge: defaultCharge, priority: 0 }];
    }

    const orderedRules = [...rules]
        .filter((r) => r.isActive !== false)
        .sort((a, b) => toNumber(b.priority, 0) - toNumber(a.priority, 0));

    const shippingAddress = normalize(location.shippingAddress);
    const line1 = normalize(location.line1);

    for (const rule of orderedRules) {
        const exactMatch =
            matchesExact(location.country, rule.country) &&
            matchesExact(location.state, rule.state) &&
            matchesExact(location.city, rule.city) &&
            matchesExact(location.postalCode, rule.postalCode);

        if (!exactMatch) continue;

        if (rule.line1Contains) {
            const token = normalize(rule.line1Contains);
            if (!line1.includes(token) && !shippingAddress.includes(token)) {
                continue;
            }
        }

        return toNumber(rule.charge, defaultCharge);
    }

    const dhakaFallback = matchesContains(location.state, 'dhaka') || matchesContains(location.city, 'dhaka');
    if (dhakaFallback) return 60;

    return defaultCharge;
};

// ─── Resolve shipping for a set of cart items (product/seller rules first) ───
// Priority: product.shippingCost > seller category rule > seller default > global location
const resolveCartShipping = async (
    cartItems: { product: { shippingCost: number | null; sellerEmail: string; categoryId: string | null }; quantity: number }[],
    location: IShippingLocation
): Promise<number> => {
    // Collect per-item seller-defined shipping (if any)
    const sellerEmails = [...new Set(cartItems.map((i) => i.product.sellerEmail))];
    const categoryIds = [...new Set(cartItems.map((i) => i.product.categoryId).filter(Boolean))] as string[];

    // Load all relevant seller category shipping rules in one query
    const sellerRules = await prisma.sellerCategoryShipping.findMany({
        where: {
            sellerEmail: { in: sellerEmails },
            OR: [
                { categoryId: { in: categoryIds } },
                { categoryId: null }, // seller-wide default
            ],
        },
    });

    let totalShipping = 0;
    const globalLocationCharge = await resolveShippingCharge(location);

    // Group items by seller so shipping is charged once per seller
    const itemsBySeller = cartItems.reduce<Record<string, typeof cartItems>>((acc, item) => {
        const seller = item.product.sellerEmail;
        if (!acc[seller]) acc[seller] = [];
        acc[seller].push(item);
        return acc;
    }, {});

    for (const sellerEmail of Object.keys(itemsBySeller)) {
        const sellerItems = itemsBySeller[sellerEmail];
        let sellerCharge: number | null = null;

        // 1. Use the highest product-level shipping override for this seller
        const productOverrides = sellerItems
            .map((item) => item.product.shippingCost)
            .filter((cost): cost is number => cost != null && cost >= 0);
        if (productOverrides.length > 0) {
            sellerCharge = Math.max(...productOverrides);
        }

        if (sellerCharge === null) {
            // 2. Find the highest matching category shipping rule for this seller
            const categoryCharges = sellerItems
                .map((item) => {
                    const catRule = sellerRules.find(
                        (r) => r.sellerEmail === sellerEmail && r.categoryId === item.product.categoryId
                    );
                    return catRule?.charge ?? null;
                })
                .filter((charge): charge is number => charge != null);

            if (categoryCharges.length > 0) {
                sellerCharge = Math.max(...categoryCharges);
            }
        }

        if (sellerCharge === null) {
            // 3. Use seller-wide default rule if available
            const sellerDefault = sellerRules.find(
                (r) => r.sellerEmail === sellerEmail && r.categoryId === null
            );
            if (sellerDefault) {
                sellerCharge = sellerDefault.charge;
            }
        }

        if (sellerCharge === null) {
            // 4. Fallback to global location charge for this seller
            sellerCharge = globalLocationCharge;
        }

        totalShipping += sellerCharge;
    }

    return totalShipping;
};

const getFinalProductPrice = (product: {
    price: number;
    discount: number;
    discountPrice?: number | null;
}, variant?: { price?: number | null }) => {
    if (typeof variant?.price === "number" && variant.price > 0) {
        return variant.price;
    }

    if (
        typeof product.discountPrice === "number" &&
        product.discountPrice > 0 &&
        product.discountPrice < product.price
    ) {
        return product.discountPrice;
    }

    if (typeof product.discount === "number" && product.discount > 0) {
        return product.price * (1 - product.discount / 100);
    }

    return product.price;
};

const createOrder = async (user: IJWTPayload, payload: ICreateOrderPayload) => {
    const { shippingAddress, addressId, contactNumber, couponCode, paymentMethod = "STRIPE", notes } = payload;

    // Get customer's cart with items
    const cart = await prisma.cart.findUnique({
        where: { customerEmail: user.email },
        include: {
            items: {
                include: { product: true, variant: true }
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
        const unitPrice = getFinalProductPrice(item.product, item.variant || undefined);
        totalAmount += unitPrice * item.quantity;
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

    const shippingAmount = await resolveCartShipping(cart.items, {
        shippingAddress: finalShippingAddress,
        country: addressDetails?.country,
        state: addressDetails?.state,
        city: addressDetails?.city,
        postalCode: addressDetails?.postalCode,
        line1: addressDetails?.line1
    });

    const finalTotal = totalAmount - discountAmount + shippingAmount;

    // Create order in a transaction
    const result = await prisma.$transaction(async (tnx) => {
        const order = await tnx.order.create({
            data: {
                customerEmail: user.email,
                totalAmount: finalTotal,
                discountAmount,
                shippingAmount,
                couponCode: couponCode ?? null,
                shippingAddress: finalShippingAddress ?? null,
                addressId: addressId ?? null,
                contactNumber: finalContactNumber ?? null,
                paymentMethod: paymentMethod.toUpperCase(),
                notes: notes ?? null,
                status: paymentMethod === "COD" ? "PENDING" : "PENDING",
                paymentStatus: paymentMethod === "COD" ? "UNPAID" : "UNPAID"
            }
        });

        for (const item of cart.items) {
            const unitPrice = getFinalProductPrice(item.product, item.variant || undefined);
            
            // 🚨 DECREMENT STOCK FOR COD ORDERS IMMEDIATELY
            if (paymentMethod === "COD") {
                if (item.variantId) {
                    await tnx.productVariant.update({
                        where: { id: item.variantId },
                        data: { stock: { decrement: item.quantity } }
                    });
                } else {
                    await tnx.product.update({
                        where: { id: item.productId },
                        data: { stock: { decrement: item.quantity } }
                    });
                }
            }

            await tnx.orderItem.create({
                data: {
                    orderId: order.id,
                    productId: item.productId,
                    variantId: item.variantId,
                    size: item.size || "",
                    quantity: item.quantity,
                    price: unitPrice
                }
            });
        }

        // For COD orders, clear the cart now
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

    // Notify sellers ONLY if it's COD. Online payments notify via webhook.
    if (paymentMethod === "COD") {
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
                sellerData.total += getFinalProductPrice(item.product, item.variant || undefined) * item.quantity;
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

            console.log(`📢 Notified ${sellerNotifications.size} seller(s) about new COD order ${result.id}`);
        } catch (error) {
            console.error("Failed to notify sellers:", error);
            // Don't fail the order creation if notifications fail
        }
    }

    return fullOrder;
};

const getShippingQuote = async (user: IJWTPayload, query: {
    addressId?: string;
    country?: string;
    state?: string;
    city?: string;
    postalCode?: string;
    line1?: string;
    shippingAddress?: string;
}) => {
    let addressDetails: {
        country?: string | null;
        state?: string | null;
        city?: string | null;
        postalCode?: string | null;
        line1?: string | null;
        line2?: string | null;
        fullName?: string | null;
    } | null = null;

    if (query.addressId) {
        addressDetails = await prisma.address.findUnique({
            where: { id: query.addressId, customerEmail: user.email },
            select: {
                country: true,
                state: true,
                city: true,
                postalCode: true,
                line1: true,
                line2: true,
                fullName: true
            }
        });

        if (!addressDetails) {
            throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid address selected');
        }
    }

    const shippingAddress = query.shippingAddress || (addressDetails
        ? `${addressDetails.fullName || ''}, ${addressDetails.line1 || ''}${addressDetails.line2 ? `, ${addressDetails.line2}` : ''}, ${addressDetails.city || ''}, ${addressDetails.state || ''} ${addressDetails.postalCode || ''}, ${addressDetails.country || ''}`
        : undefined);

    // Also check the customer's cart products for seller-level shipping overrides
    const cart = await prisma.cart.findUnique({
        where: { customerEmail: user.email },
        include: { items: { include: { product: { select: { shippingCost: true, sellerEmail: true, categoryId: true } } } } },
    });

    const location: IShippingLocation = {
        shippingAddress,
        country: query.country ?? addressDetails?.country,
        state: query.state ?? addressDetails?.state,
        city: query.city ?? addressDetails?.city,
        postalCode: query.postalCode ?? addressDetails?.postalCode,
        line1: query.line1 ?? addressDetails?.line1,
    };

    const shippingAmount = cart && cart.items.length > 0
        ? await resolveCartShipping(cart.items, location)
        : await resolveShippingCharge(location);

    return {
        shippingAmount,
        location: {
            country: query.country ?? addressDetails?.country ?? null,
            state: query.state ?? addressDetails?.state ?? null,
            city: query.city ?? addressDetails?.city ?? null,
            postalCode: query.postalCode ?? addressDetails?.postalCode ?? null
        }
    };
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
            where: { 
                items: { some: { product: { sellerEmail: user.email } } },
                OR: [{ paymentMethod: "COD" }, { paymentStatus: "PAID" }]
            },
            include: {
                items: { where: { product: { sellerEmail: user.email } }, include: { product: { select: { name: true, images: true, sellerEmail: true } } } },
                customer: { select: { name: true, email: true } },
                address: true,
            },
            skip, take: limit, orderBy: { [sortBy]: sortOrder }
        }),
        prisma.order.count({ 
            where: { 
                items: { some: { product: { sellerEmail: user.email } } },
                OR: [{ paymentMethod: "COD" }, { paymentStatus: "PAID" }]
            } 
        })
    ]);
    return { meta: { page, limit, total }, data };
};

export const OrderService = {
    createOrder,
    getShippingQuote,
    getMyOrders,
    getOrderById,
    getAllOrders,
    updateOrderStatus,
    cancelOrder,
    getSellerOrders,
    addShipment,
}

