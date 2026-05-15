import { prisma } from "../../shared/prisma";
import ApiError from "../../errors/ApiError";
import httpStatus from "http-status";
import { IJWTPayload } from "../../types/common";

const getMyCart = async (user: IJWTPayload) => {
    // Get or create cart
    let cart = await prisma.cart.findUnique({
        where: { customerEmail: user.email },
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
                },
                orderBy: { createdAt: "desc" }
            }
        }
    });

    if (!cart) {
        cart = await prisma.cart.create({
            data: { customerEmail: user.email },
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
                }
            }
        });
    }

    return cart;
};

const addToCart = async (user: IJWTPayload, payload: { productId: string; quantity?: number }) => {
    const quantity = payload.quantity || 1;

    // Verify product exists and has stock
    const product = await prisma.product.findUniqueOrThrow({
        where: { id: payload.productId, isDeleted: false }
    });

    if (product.stock < quantity) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Insufficient stock!");
    }

    // Get or create cart
    let cart = await prisma.cart.findUnique({
        where: { customerEmail: user.email }
    });

    if (!cart) {
        cart = await prisma.cart.create({
            data: { customerEmail: user.email }
        });
    }

    // Check if item already in cart
    const existingItem = await prisma.cartItem.findUnique({
        where: {
            cartId_productId: {
                cartId: cart.id,
                productId: payload.productId
            }
        }
    });

    // Check cart limit: max 5 of same item per customer
    const currentQuantity = existingItem ? existingItem.quantity : 0;
    const newTotalQuantity = currentQuantity + quantity;

    if (newTotalQuantity > 5) {
        throw new ApiError(httpStatus.BAD_REQUEST, `You can only add up to 5 of this item to your cart. You currently have ${currentQuantity} in your cart.`);
    }

    let result;
    if (existingItem) {
        // Update quantity
        result = await prisma.cartItem.update({
            where: { id: existingItem.id },
            data: { quantity: existingItem.quantity + quantity },
            include: { product: true }
        });
    } else {
        // Add new item
        result = await prisma.cartItem.create({
            data: {
                cartId: cart.id,
                productId: payload.productId,
                quantity
            },
            include: { product: true }
        });
    }

    return result;
};

const updateCartItem = async (user: IJWTPayload, cartItemId: string, payload: { quantity: number }) => {
    const cart = await prisma.cart.findUniqueOrThrow({
        where: { customerEmail: user.email }
    });

    const cartItem = await prisma.cartItem.findUniqueOrThrow({
        where: { id: cartItemId }
    });

    if (cartItem.cartId !== cart.id) {
        throw new ApiError(httpStatus.FORBIDDEN, "This cart item does not belong to you!");
    }

    // Check cart limit: max 5 of same item per customer
    if (payload.quantity > 5) {
        throw new ApiError(httpStatus.BAD_REQUEST, "You can only have up to 5 of this item in your cart.");
    }

    // Check stock
    const product = await prisma.product.findUniqueOrThrow({
        where: { id: cartItem.productId }
    });

    if (product.stock < payload.quantity) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Insufficient stock!");
    }

    const result = await prisma.cartItem.update({
        where: { id: cartItemId },
        data: { quantity: payload.quantity },
        include: { product: true }
    });

    return result;
};

const removeFromCart = async (user: IJWTPayload, cartItemId: string) => {
    const cart = await prisma.cart.findUniqueOrThrow({
        where: { customerEmail: user.email }
    });

    const cartItem = await prisma.cartItem.findUniqueOrThrow({
        where: { id: cartItemId }
    });

    if (cartItem.cartId !== cart.id) {
        throw new ApiError(httpStatus.FORBIDDEN, "This cart item does not belong to you!");
    }

    await prisma.cartItem.delete({
        where: { id: cartItemId }
    });

    return { message: "Item removed from cart!" };
};

const clearCart = async (user: IJWTPayload) => {
    const cart = await prisma.cart.findUnique({
        where: { customerEmail: user.email }
    });

    if (!cart) {
        throw new ApiError(httpStatus.NOT_FOUND, "Cart not found!");
    }

    await prisma.cartItem.deleteMany({
        where: { cartId: cart.id }
    });

    return { message: "Cart cleared!" };
};

export const CartService = {
    getMyCart,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart
}
