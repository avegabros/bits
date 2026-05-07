import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async route handler with standardized error handling.
 * Catches unhandled errors and sends them to the next middleware (Express global error handler).
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
