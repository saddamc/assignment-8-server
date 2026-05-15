import { NextFunction, Request, Response } from "express";
import { ZodTypeAny } from "zod";

const validateRequest = (schema: ZodTypeAny) => async (req: Request, res: Response, next: NextFunction) => {
    try {
        const parsed = await schema.parseAsync({
            body: req.body,
            query: req.query,
            params: req.params,
        });
        // Assign stripped/parsed body back so unknown fields don't leak into services
        if (parsed.body !== undefined) req.body = parsed.body;
        if (parsed.query !== undefined) req.query = parsed.query;
        if (parsed.params !== undefined) req.params = parsed.params;
        return next();
    } catch (err) {
        next(err);
    }
}

export default validateRequest;
