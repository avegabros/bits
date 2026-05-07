import { Request, Response } from 'express';

/**
 * Controller for returning the centralized server time.
 * This acts as the single source of truth for the entire system,
 * including frontend clients and ZKTeco devices.
 */
export const getServerTime = (req: Request, res: Response) => {
    try {
        const now = new Date();
        
        // Return both raw UTC and formatted ISO strings for the frontend
        res.status(200).json({
            success: true,
            data: {
                utc: now.toISOString(),
                timestamp: now.getTime(),
                timezone: 'Asia/Manila' // Enforced standard time
            }
        });
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve server time',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};
