import { IJWTPayload } from "./common";

declare global {
    namespace Express {
        interface Request {
            user?: IJWTPayload;
        }
    }
}

export {};
