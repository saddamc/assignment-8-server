import express from 'express';
import { AdminController } from './admin.controller';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';

const router = express.Router();
const ADMIN = auth(UserRole.ADMIN);

// Users
router.get('/users', ADMIN, AdminController.getAllUsers);
router.get('/users/:id', ADMIN, AdminController.getUserById);
router.patch('/users/:id/block', ADMIN, AdminController.blockUser);
router.patch('/users/:id/unblock', ADMIN, AdminController.unblockUser);

// Sellers
router.get('/sellers', ADMIN, AdminController.getAllSellers);
router.get('/sellers/:id', ADMIN, AdminController.getSellerById);
router.patch('/sellers/:id/approve', ADMIN, AdminController.approveSeller);
router.patch('/sellers/:id/reject', ADMIN, AdminController.rejectSeller);
router.patch('/sellers/:id/commission', ADMIN, AdminController.updateCommission);

// Disputes
router.get('/disputes', ADMIN, AdminController.getAllDisputes);
router.get('/disputes/:id', ADMIN, AdminController.getDisputeById);
router.patch('/disputes/:id/resolve', ADMIN, AdminController.resolveDispute);
router.post('/disputes/:orderId', auth(UserRole.CUSTOMER), AdminController.createDispute);

// Fraud flags
router.get('/fraud-flags', ADMIN, AdminController.getFraudFlags);
router.patch('/fraud-flags/:id/resolve', ADMIN, AdminController.resolveFraudFlag);

// Logs
router.get('/logs', ADMIN, AdminController.getActivityLogs);

// Finance
router.get('/finance/revenue', ADMIN, AdminController.getRevenueOverview);

export const adminRoutes = router;
