import express from 'express';
import { SiteConfigController } from './siteConfig.controller';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';

const router = express.Router();

router.get('/public/:key', SiteConfigController.getPublicConfig);
router.get('/', auth(UserRole.ADMIN), SiteConfigController.getAllConfig);
router.patch('/:key', auth(UserRole.ADMIN), SiteConfigController.upsertConfig);

export const siteConfigRoutes = router;
