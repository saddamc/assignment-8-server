import express from 'express';
import { AddressController } from './address.controller';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import validateRequest from '../../middlewares/validateRequest';
import { AddressValidation } from './address.validation';

const router = express.Router();

router.get('/', auth(UserRole.CUSTOMER), AddressController.getMyAddresses);
router.post('/', auth(UserRole.CUSTOMER), validateRequest(AddressValidation.createAddressSchema), AddressController.createAddress);
router.patch('/:id', auth(UserRole.CUSTOMER), validateRequest(AddressValidation.updateAddressSchema), AddressController.updateAddress);
router.delete('/:id', auth(UserRole.CUSTOMER), AddressController.deleteAddress);
router.patch('/:id/set-default', auth(UserRole.CUSTOMER), AddressController.setDefaultAddress);

export const addressRoutes = router;
