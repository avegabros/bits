import { Response } from 'express';

/** Check if a Prisma error is a unique constraint violation (P2002) */
export function isPrismaUniqueViolation(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
    );
}

/** Send a standardized 409 response for duplicate record errors */
export function handleDuplicateError(res: Response, entityName: string): void {
    res.status(409).json({
        success: false,
        message: `Duplicate ${entityName} record. A record with the same unique field(s) already exists.`,
    });
}
