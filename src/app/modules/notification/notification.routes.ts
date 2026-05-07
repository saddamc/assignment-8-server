import express from 'express';
import { NotificationController } from './notification.controller';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';

const router = express.Router();

router.get('/', auth(UserRole.CUSTOMER), NotificationController.getMyNotifications);
router.patch('/read-all', auth(UserRole.CUSTOMER), NotificationController.markAllAsRead);
router.patch('/:id/read', auth(UserRole.CUSTOMER), NotificationController.markAsRead);
router.delete('/:id', auth(UserRole.CUSTOMER), NotificationController.deleteNotification);

export const notificationRoutes = router;
