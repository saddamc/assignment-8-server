import express from "express";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import { AnalyticsController } from "./analytics.controller";

const router = express.Router();

router.get("/admin", auth(UserRole.ADMIN), AnalyticsController.getDashboardStats);
router.get("/seller", auth(UserRole.SELLER), AnalyticsController.getSellerStats);

export const analyticsRoutes = router;
