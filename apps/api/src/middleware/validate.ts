import { type Request, type Response, type NextFunction } from "express";
import { type ZodError, type ZodType } from "zod";
import { ApiError } from "./errorHandler.js";

/**
 * Validation middleware factory
 * Validates request body, query, and params against a Zod schema
 */
export const validate = (schema: ZodType) => {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      const zodError = error as ZodError;
      const validationErrors = zodError.issues.map((e) => ({
        field: e.path.slice(1).join("."), // Remove 'body.' prefix
        message: e.message,
      }));

      next(ApiError.validationError(validationErrors));
    }
  };
};
