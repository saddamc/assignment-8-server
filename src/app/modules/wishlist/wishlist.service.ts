import { prisma } from "../../shared/prisma";
import { IJWTPayload } from "../../types/common";
import ApiError from "../../errors/ApiError";
import httpStatus from "http-status";

const toggleWishlist = async (user: IJWTPayload, productId: string) => {
    // Ensure product exists
    await prisma.product.findUniqueOrThrow({ where: { id: productId, isDeleted: false } });

    // Get or create wishlist
    let wishlist = await prisma.wishlist.findUnique({ where: { customerEmail: user.email } });
    if (!wishlist) {
        wishlist = await prisma.wishlist.create({ data: { customerEmail: user.email } });
    }

    // Check if item already in wishlist
    const existing = await prisma.wishlistItem.findUnique({
        where: { wishlistId_productId: { wishlistId: wishlist.id, productId } }
    });

    if (existing) {
        await prisma.wishlistItem.delete({ where: { id: existing.id } });
        return { added: false, message: "Removed from wishlist" };
    } else {
        await prisma.wishlistItem.create({ data: { wishlistId: wishlist.id, productId } });
        return { added: true, message: "Added to wishlist" };
    }
};

const getMyWishlist = async (user: IJWTPayload) => {
    const wishlist = await prisma.wishlist.findUnique({
        where: { customerEmail: user.email },
        include: {
            items: {
                include: {
                    product: {
                        include: {
                            category: true,
                            reviews: { select: { rating: true } }
                        }
                    }
                },
                orderBy: { createdAt: "desc" }
            }
        }
    });

    return wishlist?.items || [];
};

const isInWishlist = async (user: IJWTPayload, productId: string) => {
    const wishlist = await prisma.wishlist.findUnique({ where: { customerEmail: user.email } });
    if (!wishlist) return { isWishlisted: false };

    const item = await prisma.wishlistItem.findUnique({
        where: { wishlistId_productId: { wishlistId: wishlist.id, productId } }
    });

    return { isWishlisted: !!item };
};

export const WishlistService = { toggleWishlist, getMyWishlist, isInWishlist };
