import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Generates a unique correlation ID for each incoming HTTP request.
 * This ID is attached to the request object and used to group related system actions (e.g. audit logs).
 */
export const correlationId = (req: Request, _res: Response, next: NextFunction): void => {
    req.correlationId = (req.headers['x-correlation-id'] as string) || randomUUID();
    next();
};
