import express from 'express';
import { BannerController } from './banner.controller';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';

const router = express.Router();

router.get('/active', BannerController.getActiveBanners);
router.get('/', auth(UserRole.ADMIN), BannerController.getAllBanners);
router.post('/', auth(UserRole.ADMIN), BannerController.createBanner);
router.patch('/:id', auth(UserRole.ADMIN), BannerController.updateBanner);
router.delete('/:id', auth(UserRole.ADMIN), BannerController.deleteBanner);

export const bannerRoutes = router;
