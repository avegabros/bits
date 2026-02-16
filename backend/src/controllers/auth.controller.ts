import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/token.utils';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { firstName, lastName, email, password, role, zkId, department, position, contactNumber, employeeNumber, branch, hireDate } = req.body;

        if (!firstName || !lastName || !email || !password) {
            res.status(400).json({ success: false, message: 'First name, last name, email, and password are required' });
            return;
        }

        const existingUser = await prisma.employee.findFirst({
            where: {
                OR: [
                    { email },
                    { zkId: zkId ? parseInt(zkId) : undefined },
                    { employeeNumber: employeeNumber || undefined }
                ]
            }
        });

        if (existingUser) {
            res.status(400).json({ success: false, message: 'User with this email, zkId, or employee number already exists' });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.employee.create({
            data: {
                firstName,
                lastName,
                email,
                password: hashedPassword,
                role: role || 'USER',
                zkId: zkId ? parseInt(zkId) : null,
                department: department || null,
                position: position || null,
                contactNumber: contactNumber || null,
                employeeNumber: employeeNumber || null,
                branch: branch || null,
                hireDate: hireDate ? new Date(hireDate) : null,
            }
        });

        res.status(201).json({
            success: true,
            message: 'Employee registered successfully',
            employee: {
                id: newUser.id,
                firstName: newUser.firstName,
                lastName: newUser.lastName,
                email: newUser.email,
                role: newUser.role,
                department: newUser.department,
                position: newUser.position,
                branch: newUser.branch
            }
        });

    } catch (error: any) {
        console.error('Registration failed:', error);
        res.status(500).json({ success: false, message: 'Registration failed', error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' });
    }
};

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ success: false, message: 'Email and password are required' });
            return;
        }

        const employee = await prisma.employee.findFirst({
            where: { email }
        });

        if (!employee || !employee.password) {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
            return;
        }

        const isPasswordValid = await bcrypt.compare(password, employee.password);

        if (!isPasswordValid) {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
            return;
        }
        // Role-based access control: Only ADMIN and HR can access the web app
        if (employee.role !== 'ADMIN' && employee.role !== 'HR') {
            res.status(403).json({
                success: false,
                message: 'Access denied. Only administrators and HR personnel can access this system.'
            });
            return;
        }

        // Generate tokens using utility functions
        const tokenPayload = {
            employeeId: employee.id,
            role: employee.role,
            firstName: employee.firstName,
            lastName: employee.lastName,
            name: `${employee.firstName} ${employee.lastName}` // Maintain backward compatibility in token if possible, or just send fields
        };

        const accessToken = generateAccessToken(tokenPayload);
        const refreshToken = generateRefreshToken(tokenPayload);

        res.status(200).json({
            success: true,
            message: 'Login successful',
            accessToken,
            token: accessToken, // Alias for frontend compatibility
            refreshToken,
            employee: {
                id: employee.id,
                firstName: employee.firstName,
                lastName: employee.lastName,
                email: employee.email,
                role: employee.role
            }
        });

    } catch (error: any) {
        console.error('Login failed:', error);
        res.status(500).json({ success: false, message: 'Login failed', error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' });
    }
};

/**
 * Refresh Token Controller
 * Generates new access token using valid refresh token
 */
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            res.status(400).json({
                success: false,
                message: 'Refresh token is required'
            });
            return;
        }

        // Verify refresh token
        const decoded = verifyRefreshToken(refreshToken);

        // Generate new access token
        const newAccessToken = generateAccessToken({
            employeeId: decoded.employeeId,
            role: decoded.role,
            firstName: decoded.firstName,
            lastName: decoded.lastName,
            name: decoded.name
        });

        res.status(200).json({
            success: true,
            message: 'Token refreshed successfully',
            accessToken: newAccessToken
        });

    } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
            res.status(401).json({
                success: false,
                message: 'Refresh token has expired. Please login again.',
                error: 'refresh_token_expired'
            });
            return;
        }

        if (error.name === 'JsonWebTokenError') {
            res.status(401).json({
                success: false,
                message: 'Invalid refresh token.',
                error: 'invalid_refresh_token'
            });
            return;
        }

        console.error('Token refresh failed:', error);
        res.status(500).json({
            success: false,
            message: 'Token refresh failed',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};
