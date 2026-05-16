import { prisma } from "../../shared/prisma";
import { PaymentStatus, UserRole } from "@prisma/client";

const getDashboardStats = async () => {
    const [
        totalUsers,
        totalCustomers,
        totalSellers,
        totalProducts,
        totalOrders,
        revenueResult,
        pendingOrders,
        recentOrders,
        topProducts,
        lowStockProducts
    ] = await Promise.all([
        prisma.user.count(),
        prisma.customer.count({ where: { isDeleted: false } }),
        prisma.seller.count({ where: { isDeleted: false } }),
        prisma.product.count({ where: { isDeleted: false } }),
        prisma.order.count(),
        prisma.order.aggregate({
            _sum: { totalAmount: true },
            where: { paymentStatus: PaymentStatus.PAID }
        }),
        prisma.order.count({ where: { status: "PENDING" } }),
        prisma.order.findMany({
            take: 10,
            orderBy: { createdAt: "desc" },
            include: {
                customer: { select: { name: true, profilePhoto: true } },
                items: {
                    include: {
                        product: { select: { name: true, images: true } }
                    }
                }
            }
        }),
        prisma.orderItem.groupBy({
            by: ["productId"],
            _sum: { quantity: true },
            orderBy: { _sum: { quantity: "desc" } },
            take: 5
        }),
        prisma.product.findMany({
            where: { stock: { lte: 5 }, isDeleted: false },
            select: { id: true, name: true, stock: true, images: true },
            take: 5
        })
    ]);

    // Fetch top product details
    const topProductIds = topProducts.map(p => p.productId);
    const topProductDetails = await prisma.product.findMany({
        where: { id: { in: topProductIds } },
        select: { id: true, name: true, images: true, price: true }
    });

    const topProductsWithDetails = topProducts.map(tp => ({
        ...tp,
        product: topProductDetails.find(p => p.id === tp.productId)
    }));

    // Monthly revenue for last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyOrders = await prisma.order.findMany({
        where: {
            paymentStatus: PaymentStatus.PAID,
            createdAt: { gte: sixMonthsAgo }
        },
        select: { totalAmount: true, createdAt: true }
    });

    const monthlyRevenue: Record<string, number> = {};
    monthlyOrders.forEach(order => {
        const key = order.createdAt.toISOString().slice(0, 7); // YYYY-MM
        monthlyRevenue[key] = (monthlyRevenue[key] || 0) + order.totalAmount;
    });

    const revenueChart = Object.entries(monthlyRevenue)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, revenue]) => ({ month, revenue: Math.round(revenue) }));

    return {
        overview: {
            totalUsers,
            totalCustomers,
            totalSellers,
            totalProducts,
            totalOrders,
            totalRevenue: revenueResult._sum.totalAmount || 0,
            pendingOrders
        },
        recentOrders,
        topProducts: topProductsWithDetails,
        lowStockProducts,
        revenueChart
    };
};

const getSellerStats = async (sellerEmail: string) => {
    const [products, orders, paidOrderItems, pendingOrders] = await Promise.all([
        prisma.product.count({ where: { sellerEmail, isDeleted: false } }),
        prisma.order.count({
            where: { 
                items: { some: { product: { sellerEmail } } },
                OR: [{ paymentMethod: "COD" }, { paymentStatus: "PAID" }]
            }
        }),
        prisma.orderItem.findMany({
            where: { product: { sellerEmail }, order: { paymentStatus: PaymentStatus.PAID } }
            ,
            select: { price: true, quantity: true }
        }),
        prisma.order.count({
            where: { 
                status: "PENDING",
                items: { some: { product: { sellerEmail } } },
                OR: [{ paymentMethod: "COD" }, { paymentStatus: "PAID" }]
            }
        })
    ]);

    const totalRevenue = paidOrderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const recentOrders = await prisma.orderItem.findMany({
        where: { 
            product: { sellerEmail },
            order: { OR: [{ paymentMethod: "COD" }, { paymentStatus: "PAID" }] }
        },
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
            product: { select: { name: true, images: true } },
            order: {
                include: {
                    customer: { select: { name: true } }
                }
            }
        }
    });

    const myProducts = await prisma.product.findMany({
        where: { sellerEmail, isDeleted: false },
        orderBy: { createdAt: "desc" },
        include: { category: true }
    });

    return {
        overview: {
            totalProducts: products,
            totalOrders: orders,
            totalRevenue,
            pendingOrders
        },
        recentOrders,
        myProducts
    };
};

export const AnalyticsService = { getDashboardStats, getSellerStats };
