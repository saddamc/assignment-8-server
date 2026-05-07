import ApiError from "../errors/ApiError";
import httpStatus from "http-status";

export const getParamAsString = (value: string | string[] | undefined, paramName: string): string => {
    if (typeof value === "string") {
        return value;
    }

    if (Array.isArray(value) && value.length > 0) {
        return value[0];
    }

    throw new ApiError(httpStatus.BAD_REQUEST, `Invalid route param: ${paramName}`);
};
