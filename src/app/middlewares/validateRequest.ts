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
        const parsedAny: any = parsed;
        if (parsedAny.body !== undefined) req.body = parsedAny.body;
        if (parsedAny.query !== undefined) req.query = parsedAny.query;
        if (parsedAny.params !== undefined) req.params = parsedAny.params;
        return next();
    } catch (err) {
        next(err);
    }
}

export default validateRequest;
