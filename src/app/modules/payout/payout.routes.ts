import express from 'express';
import { PayoutController } from './payout.controller';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';

const router = express.Router();

router.get('/balance', auth(UserRole.SELLER), PayoutController.getBalance);
router.post('/withdraw', auth(UserRole.SELLER), PayoutController.requestWithdrawal);
router.get('/withdrawals', auth(UserRole.SELLER), PayoutController.getWithdrawals);
router.get('/withdrawals/all', auth(UserRole.ADMIN), PayoutController.getAllWithdrawals);
router.patch('/withdrawals/:id', auth(UserRole.ADMIN), PayoutController.processWithdrawal);

export const payoutRoutes = router;
