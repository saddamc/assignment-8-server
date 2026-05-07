import express from "express";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import { WishlistController } from "./wishlist.controller";

const router = express.Router();

router.post("/:productId/toggle", auth(UserRole.CUSTOMER), WishlistController.toggleWishlist);
router.get("/", auth(UserRole.CUSTOMER), WishlistController.getMyWishlist);
router.get("/:productId/status", auth(UserRole.CUSTOMER), WishlistController.isInWishlist);

export const wishlistRoutes = router;
