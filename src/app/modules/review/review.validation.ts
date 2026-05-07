import { z } from 'zod';

const createReviewSchema = z.object({
    body: z.object({
        rating: z.number().int().min(1).max(5),
        comment: z.string().optional(),
        images: z.array(z.string().url()).optional().default([]),
    })
});

const updateReviewSchema = z.object({
    body: z.object({
        rating: z.number().int().min(1).max(5).optional(),
        comment: z.string().optional(),
        images: z.array(z.string().url()).optional(),
    })
});

export const ReviewValidation = { createReviewSchema, updateReviewSchema };
