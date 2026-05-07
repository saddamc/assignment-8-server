import { Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express"
import httpStatus from "http-status"
import { JsonWebTokenError, TokenExpiredError, NotBeforeError } from "jsonwebtoken"

const globalErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    console.log(err)
    let statusCode: number = err.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
    let success = false;
    let message = err.message || "Something went wrong!";
    let error = err;

    if (err instanceof TokenExpiredError) {
        message = "Your session has expired. Please log in again.";
        statusCode = httpStatus.UNAUTHORIZED;
        error = { name: err.name, expiredAt: err.expiredAt };
    }
    else if (err instanceof NotBeforeError) {
        message = "Token not yet valid.";
        statusCode = httpStatus.UNAUTHORIZED;
        error = { name: err.name };
    }
    else if (err instanceof JsonWebTokenError) {
        message = "Invalid token. Please log in again.";
        statusCode = httpStatus.UNAUTHORIZED;
        error = { name: err.name };
    }
    else if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2002") {
            message = "Duplicate key error",
                error = err.meta,
                statusCode = httpStatus.CONFLICT
        }
        if (err.code === "P1000") {
            message = "Authentication failed against database server",
                error = err.meta,
                statusCode = httpStatus.BAD_GATEWAY
        }
        if (err.code === "P2003") {
            message = "Foreign key constraint failed",
                error = err.meta,
                statusCode = httpStatus.BAD_REQUEST
        }
        if (err.code === "P2025") {
            message = "Record not found",
                error = err.meta,
                statusCode = httpStatus.NOT_FOUND
        }
    }

    else if (err instanceof Prisma.PrismaClientValidationError) {
        message = "Validation Error",
            error = err.message,
            statusCode = httpStatus.BAD_REQUEST
    }
    else if (err instanceof Prisma.PrismaClientUnknownRequestError) {
        message = "Unknown Prisma error occured!",
            error = err.message,
            statusCode = httpStatus.BAD_REQUEST
    }
    else if (err instanceof Prisma.PrismaClientInitializationError) {
        message = "Prisma client failed to initialize!",
            error = err.message,
            statusCode = httpStatus.BAD_REQUEST
    }

    res.status(statusCode).json({
        success,
        message,
        error
    })
};

export default globalErrorHandler;
