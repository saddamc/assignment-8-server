import { Request, Response } from 'express';
import catchAsync from '../../shared/catchAsync';
import sendResponse from '../../shared/sendResponse';
import httpStatus from 'http-status';
import { AddressService } from './address.service';
import { IJWTPayload } from '../../types/common';

const getMyAddresses = catchAsync(async (req: Request, res: Response) => {
    const result = await AddressService.getMyAddresses(req.user as IJWTPayload);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Addresses fetched', data: result });
});

const createAddress = catchAsync(async (req: Request, res: Response) => {
    const result = await AddressService.createAddress(req.user as IJWTPayload, req.body);
    sendResponse(res, { statusCode: httpStatus.CREATED, success: true, message: 'Address created', data: result });
});

const updateAddress = catchAsync(async (req: Request, res: Response) => {
    const result = await AddressService.updateAddress(req.user as IJWTPayload, req.params.id, req.body);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Address updated', data: result });
});

const deleteAddress = catchAsync(async (req: Request, res: Response) => {
    await AddressService.deleteAddress(req.user as IJWTPayload, req.params.id);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Address deleted', data: null });
});

const setDefaultAddress = catchAsync(async (req: Request, res: Response) => {
    const result = await AddressService.setDefaultAddress(req.user as IJWTPayload, req.params.id);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Default address updated', data: result });
});

export const AddressController = { getMyAddresses, createAddress, updateAddress, deleteAddress, setDefaultAddress };



