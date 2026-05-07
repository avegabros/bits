import { Response } from 'express';

interface ApiResponse<T = any> {
    success: boolean;
    message: string;
    data?: T;
    error?: string;
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export const successResponse = <T>(res: Response, data: T, message: string = 'Success', statusCode: number = 200): void => {
    const response: ApiResponse<T> = {
        success: true,
        message,
        data,
    };
    res.status(statusCode).json(response);
};

export const errorResponse = (res: Response, message: string, error: string = 'internal_error', statusCode: number = 500): void => {
    const response: ApiResponse = {
        success: false,
        message,
        error,
    };
    res.status(statusCode).json(response);
};

export const paginatedResponse = <T>(
    res: Response,
    data: T[],
    page: number,
    limit: number,
    total: number,
    message: string = 'Success'
): void => {
    const response: ApiResponse<T[]> = {
        success: true,
        message,
        data,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
    res.status(200).json(response);
};
