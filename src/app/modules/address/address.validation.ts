import { z } from 'zod';

const createAddressSchema = z.object({
    body: z.object({
        label: z.string().optional().default('Home'),
        fullName: z.string().min(1, 'Full name is required'),
        phone: z.string().min(1, 'Phone is required'),
        line1: z.string().min(1, 'Address line 1 is required'),
        line2: z.string().optional(),
        city: z.string().min(1, 'City is required'),
        state: z.string().min(1, 'State is required'),
        postalCode: z.string().min(1, 'Postal code is required'),
        country: z.string().optional().default('US'),
        isDefault: z.boolean().optional().default(false),
    })
});

const updateAddressSchema = z.object({
    body: z.object({
        label: z.string().optional(),
        fullName: z.string().optional(),
        phone: z.string().optional(),
        line1: z.string().optional(),
        line2: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        postalCode: z.string().optional(),
        country: z.string().optional(),
        isDefault: z.boolean().optional(),
    })
});

export const AddressValidation = { createAddressSchema, updateAddressSchema };
