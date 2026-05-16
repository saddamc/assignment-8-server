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
                    },
                    variant: true
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
                        },
                        variant: true
                    }
                }
            }
        });
    }

    return cart;
};

const addToCart = async (user: IJWTPayload, payload: { productId: string; quantity?: number; size?: string; variantId?: string }) => {
    const quantity = payload.quantity || 1;

    // Verify product exists and has stock
    const product = await prisma.product.findUniqueOrThrow({
        where: { id: payload.productId, isDeleted: false }
    });

    const normalizedSize = (payload.size || "").trim();

    const productVariants = await prisma.productVariant.findMany({
        where: { productId: payload.productId },
        select: { id: true, size: true, stock: true }
    });

    const requiresSizeSelection = productVariants.some((v) => !!(v.size || "").trim());

    let selectedVariantId: string | null = null;
    let selectedVariantStock: number | null = null;

    if (requiresSizeSelection) {
        if (!normalizedSize && !payload.variantId) {
            throw new ApiError(httpStatus.BAD_REQUEST, "Please select size for this product");
        }

        const selectedVariant = payload.variantId
            ? productVariants.find((v) => v.id === payload.variantId)
            : productVariants.find((v) => ((v.size || "").trim() === normalizedSize));

        if (!selectedVariant) {
            throw new ApiError(httpStatus.BAD_REQUEST, "Selected size is invalid");
        }

        selectedVariantId = selectedVariant.id;
        selectedVariantStock = selectedVariant.stock;
    }

    const availableStock = selectedVariantStock ?? product.stock;
    if (availableStock < quantity) {
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
    const existingItem = await prisma.cartItem.findFirst({
        where: {
            cartId: cart.id,
            productId: payload.productId,
            size: normalizedSize
        }
    });

    // Check cart limit: max 5 of same item per customer
    const currentQuantity = existingItem ? existingItem.quantity : 0;
    const newTotalQuantity = currentQuantity + quantity;

    if (newTotalQuantity > 5) {
        throw new ApiError(httpStatus.BAD_REQUEST, `You can only add up to 5 of this item to your cart. You currently have ${currentQuantity} in your cart.`);
    }

    if (availableStock < newTotalQuantity) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Insufficient stock!");
    }

    let result;
    if (existingItem) {
        // Update quantity
        result = await prisma.cartItem.update({
            where: { id: existingItem.id },
            data: { quantity: existingItem.quantity + quantity },
            include: { product: true, variant: true }
        });
    } else {
        // Add new item
        result = await prisma.cartItem.create({
            data: {
                cartId: cart.id,
                productId: payload.productId,
                variantId: selectedVariantId,
                size: normalizedSize,
                quantity
            },
            include: { product: true, variant: true }
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
    const [product, variant] = await Promise.all([
        prisma.product.findUniqueOrThrow({ where: { id: cartItem.productId } }),
        cartItem.variantId
            ? prisma.productVariant.findUnique({ where: { id: cartItem.variantId } })
            : Promise.resolve(null)
    ]);

    const availableStock = variant?.stock ?? product.stock;
    if (availableStock < payload.quantity) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Insufficient stock!");
    }

    const result = await prisma.cartItem.update({
        where: { id: cartItemId },
        data: { quantity: payload.quantity },
        include: { product: true, variant: true }
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
