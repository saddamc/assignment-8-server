import express, { NextFunction, Request, Response } from 'express'
import { UserController } from './user.controller';
import { fileUploader } from '../../helper/fileUploader';
import { UserValidation } from './user.validation';
import { UserRole } from '@prisma/client';
import auth from '../../middlewares/auth';


const router = express.Router();

const parseBodyData = (body: unknown) => {
    const reqBody = body as Record<string, unknown>;
    const rawData = reqBody?.data;

    if (typeof rawData === 'string') {
        return JSON.parse(rawData);
    }

    return reqBody;
};

const normalizeCreateCustomerPayload = (payload: Record<string, unknown>) => {
    if ('customer' in payload && 'password' in payload) {
        return payload;
    }

    const name = payload.name;
    const email = payload.email;
    const password = payload.password;

    if (typeof name === 'string' && typeof email === 'string' && typeof password === 'string') {
        return {
            password,
            customer: {
                name,
                email,
                contactNumber: (payload.contactNumber as string) || (payload.phone as string) || undefined,
                address: (payload.address as string) || undefined,
            },
        };
    }

    return payload;
};

router.get(
    "/",
    auth(UserRole.ADMIN),
    UserController.getAllFromDB
)

router.get(
    '/me',
    auth(UserRole.ADMIN, UserRole.SELLER, UserRole.CUSTOMER),
    UserController.getMyProfile
)

router.post(
    "/create-customer",
    fileUploader.upload.single('file'),
    (req: Request, res: Response, next: NextFunction) => {
        const payload = normalizeCreateCustomerPayload(parseBodyData(req.body));
        req.body = UserValidation.createCustomerValidationSchema.parse(payload)
        return UserController.createCustomer(req, res, next)
    }
)

router.post(
    "/create-seller",
    fileUploader.upload.single('file'),
    (req: Request, res: Response, next: NextFunction) => {
        req.body = UserValidation.createSellerValidationSchema.parse(parseBodyData(req.body))
        return UserController.createSeller(req, res, next)
    }
)

router.post(
    "/create-admin",
    (req: Request, res: Response, next: NextFunction) => {
        // Allow creation via seed secret OR require ADMIN auth
        const seedSecret = req.headers['x-seed-secret'];
        const expectedSecret = process.env.SEED_SECRET || 'luxe-seed-secret-2024';
        if (seedSecret && seedSecret === expectedSecret) {
            return next();
        }
        // Otherwise require ADMIN auth
        return auth(UserRole.ADMIN)(req, res, next);
    },
    fileUploader.upload.single('file'),
    (req: Request, res: Response, next: NextFunction) => {
        req.body = UserValidation.createAdminValidationSchema.parse(parseBodyData(req.body))
        return UserController.createAdmin(req, res, next)
    }
);

router.patch(
    '/:id/status',
    auth(UserRole.ADMIN),
    UserController.changeProfileStatus
);

router.patch(
    "/update-my-profile",
    auth(UserRole.ADMIN, UserRole.SELLER, UserRole.CUSTOMER),
    fileUploader.upload.single('file'),
    (req: Request, res: Response, next: NextFunction) => {
        const body = parseBodyData(req.body);
        const user = (req as any).user;
        
        try {
            if (user.role === UserRole.ADMIN) {
                req.body = UserValidation.updateAdminProfileSchema.parse(body);
            } else if (user.role === UserRole.SELLER) {
                req.body = UserValidation.updateSellerProfileSchema.parse(body);
            } else if (user.role === UserRole.CUSTOMER) {
                req.body = UserValidation.updateCustomerProfileSchema.parse(body);
            }
        } catch (error) {
            return next(error);
        }
        
        return UserController.updateMyProfile(req, res, next)
    }
);

export const userRoutes = router;
