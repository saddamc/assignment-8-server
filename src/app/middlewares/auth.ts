import { NextFunction, Request, Response } from "express"
import { jwtHelper } from "../helper/jwtHelper";
import ApiError from "../errors/ApiError";
import httpStatus from "http-status"
import config from "../../config";
import { Secret } from "jsonwebtoken";
import { IJWTPayload } from "../types/common";

const auth = (...roles: string[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const token = req.cookies.accessToken;

            if (!token) {
                throw new ApiError(httpStatus.UNAUTHORIZED, "You are not authorized!")
            }

            const verifyUser = jwtHelper.verifyToken(token, config.jwt.jwt_secret as Secret) as IJWTPayload;

            req.user = verifyUser;

            if (roles.length && !roles.includes(verifyUser.role)) {
                throw new ApiError(httpStatus.FORBIDDEN, "You do not have permission to access this resource!")
            }

            next();
        }
        catch (err) {
            next(err)
        }
    }
}

export default auth;
