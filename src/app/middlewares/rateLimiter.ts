import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 300;

const requestBuckets = new Map<string, { count: number; expiresAt: number }>();

const getClientKey = (req: Request) => {
    return req.ip || req.socket.remoteAddress || "unknown";
};

const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
    const key = getClientKey(req);
    const now = Date.now();
    const bucket = requestBuckets.get(key);

    if (!bucket || bucket.expiresAt < now) {
        requestBuckets.set(key, { count: 1, expiresAt: now + WINDOW_MS });
        return next();
    }

    if (bucket.count >= MAX_REQUESTS) {
        return res.status(httpStatus.TOO_MANY_REQUESTS).json({
            success: false,
            message: "Too many requests. Please try again later.",
        });
    }

    bucket.count += 1;
    requestBuckets.set(key, bucket);
    return next();
};

export default rateLimiter;
