import { Request, Response } from 'express';
import { prisma } from '../../shared/lib/prisma';
import bcrypt from 'bcryptjs';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../shared/utils/token.utils';
import { audit } from '../../shared/lib/auditLogger';
import { loginLimiter } from './auth.routes';


// ── Helpers ───────────────────────────────────────────────────────────────────

/** 7 days in milliseconds */
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Cookie options shared by both auth cookies */
const cookieOptions = {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax' as const,
    path: '/',
};

// ── Controllers ───────────────────────────────────────────────────────────────

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

        const requesterRole = req.user?.role;
        if (requesterRole === 'MANAGER' && role === 'ADMIN') {
            res.status(403).json({ success: false, message: 'Managers cannot assign the Admin role during registration.' });
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
                position: position || null,
                contactNumber: contactNumber || null,
                employeeNumber: employeeNumber || null,
                hireDate: hireDate ? new Date(hireDate) : null,
                updatedAt: new Date(),
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
                position: newUser.position,
                needsPasswordChange: newUser.needsPasswordChange
            }
        });

    } catch (error: unknown) {
        console.error('Registration failed:', error);
        res.status(500).json({ success: false, message: 'Registration failed', error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : 'Internal server error' });
    }
};

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        let { email, employeeId, identifier, password } = req.body;

        if (identifier) {
            if (identifier.includes('@')) {
                email = identifier;
            } else {
                employeeId = identifier;
            }
        }

        if ((!email && !employeeId) || !password) {
            res.status(400).json({ success: false, message: 'Email or Employee ID and password are required' });
            return;
        }

        let employee = null;
        if (email) {
            employee = await prisma.employee.findFirst({ where: { email } });
        } else if (employeeId) {
            employee = await prisma.employee.findFirst({ where: { employeeNumber: employeeId } });
        }

        if (!employee || !employee.password) {
            res.status(401).json({ success: false, message: 'Invalid credentials' });

            // Log failed login — unknown user
            const auditIdentifier = email || employeeId;
            void audit({
                action: 'FAILED_LOGIN',
                level: 'WARN',
                entityType: 'Account',
                source: 'admin-panel',
                details: `Failed login attempt for identifier "${auditIdentifier}" — account not found`,
                metadata: { identifier: auditIdentifier, reason: 'account_not_found', ip: req.ip },
                correlationId: req.correlationId
            });
            return;
        }

        const isPasswordValid = await bcrypt.compare(password, employee.password);
        if (!isPasswordValid) {
            res.status(401).json({ success: false, message: 'Invalid credentials' });

            // Log failed login — wrong password
            void audit({
                action: 'FAILED_LOGIN',
                level: 'WARN',
                entityType: 'Account',
                entityId: employee.id,
                performedBy: employee.id,
                source: 'admin-panel',
                details: `Failed login attempt for ${employee.firstName} ${employee.lastName} — invalid password`,
                metadata: { email: employee.email, employeeNumber: employee.employeeNumber, reason: 'invalid_password', ip: req.ip },
                correlationId: req.correlationId
            });
            return;
        }

        // Block inactive/terminated accounts from logging in
        if (employee.employmentStatus === 'INACTIVE' || employee.employmentStatus === 'TERMINATED') {
            res.status(403).json({
                success: false,
                message: 'Your account has been deactivated. Please contact your administrator.'
            });

            // Log blocked login — inactive account
            void audit({
                action: 'FAILED_LOGIN',
                level: 'WARN',
                entityType: 'Account',
                entityId: employee.id,
                performedBy: employee.id,
                source: 'admin-panel',
                details: `Blocked login for deactivated account ${employee.firstName} ${employee.lastName}`,
                metadata: { email: employee.email, employeeNumber: employee.employeeNumber, reason: 'account_inactive', status: employee.employmentStatus, ip: req.ip },
                correlationId: req.correlationId
            });
            return;
        }

        const tokenPayload = {
            employeeId: employee.id,
            role: employee.role,
            firstName: employee.firstName,
            lastName: employee.lastName,
            name: `${employee.firstName} ${employee.lastName}`
        };

        // Generate tokens
        const accessToken = generateAccessToken(tokenPayload);
        const refreshTokenValue = generateRefreshToken(tokenPayload);

        // ── Store refresh token in DB ──────────────────────────────────────────
        const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

        // Clean up globally expired tokens (any user) to keep the table lean
        await prisma.refreshToken.deleteMany({
            where: {
                expiresAt: { lt: new Date() },
            }
        });

        // Enforce per-user session cap (max 5 concurrent sessions).
        // If at limit, delete the oldest session to make room for the new one.
        const MAX_SESSIONS = 5;
        const existingSessions = await prisma.refreshToken.findMany({
            where: { employeeId: employee.id },
            orderBy: { createdAt: 'asc' },
            select: { id: true },
        });

        if (existingSessions.length >= MAX_SESSIONS) {
            const sessionsToDelete = existingSessions.slice(0, existingSessions.length - MAX_SESSIONS + 1);
            await prisma.refreshToken.deleteMany({
                where: { id: { in: sessionsToDelete.map(s => s.id) } },
            });
        }

        await prisma.refreshToken.create({
            data: {
                token: refreshTokenValue,
                employeeId: employee.id,
                expiresAt,
            }
        });


        // ── Set HttpOnly cookies ───────────────────────────────────────────────
        res.cookie('auth_token', accessToken, {
            ...cookieOptions,
            maxAge: 60 * 60 * 1000, // 1 hour
        });
        res.cookie('refresh_token', refreshTokenValue, {
            ...cookieOptions,
            maxAge: REFRESH_TOKEN_TTL_MS, // 7 days
        });

        res.status(200).json({
            success: true,
            message: 'Login successful',
            // These tokens are included so the Next.js route handler can relay
            // them as HttpOnly cookies. The handler strips them from the
            // browser-facing JSON response, so they never reach client-side JS.
            accessToken,
            refreshToken: refreshTokenValue,
            employee: {
                id: employee.id,
                firstName: employee.firstName,
                lastName: employee.lastName,
                email: employee.email,
                role: employee.role,
                needsPasswordChange: employee.needsPasswordChange
            }
        });

        // Reset the rate limit counter for this IP+user on successful login
        // so accumulated failed attempts don't carry over.
        const inputIdentifier = email || employeeId;
        const rateLimitKey = `${req.ip}:${inputIdentifier.toLowerCase()}`;
        loginLimiter.resetKey(rateLimitKey);

        void audit({
            action: 'LOGIN',
            entityType: 'Account',
            entityId: employee.id,
            performedBy: employee.id,
            source: 'admin-panel',
            details: `User ${employee.firstName} ${employee.lastName} logged in successfully`,
            metadata: { email: employee.email, employeeNumber: employee.employeeNumber },
            correlationId: req.correlationId
        });


    } catch (error: unknown) {
        console.error('Login failed:', error);
        res.status(500).json({ success: false, message: 'Login failed', error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : 'Internal server error' });
    }
};

/**
 * Refresh Token Controller — Token Rotation
 * Validates refresh token against DB, issues new access + refresh tokens,
 * deletes old refresh token (rotation = one-time use).
 */
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
        // Accept refresh token from cookie (preferred) or body (fallback)
        const incomingToken = req.cookies?.refresh_token || req.body?.refreshToken;

        if (!incomingToken) {
            res.status(401).json({ success: false, message: 'No refresh token provided.', error: 'no_refresh_token' });
            return;
        }

        // 1. Look up the token in DB — must exist and not be expired
        const storedToken = await prisma.refreshToken.findUnique({
            where: { token: incomingToken },
            include: { employee: true }
        });

        if (!storedToken) {
            // Token not in DB — either already used (rotation) or forged
            res.clearCookie('auth_token', cookieOptions);
            res.clearCookie('refresh_token', cookieOptions);
            res.status(401).json({ success: false, message: 'Invalid refresh token.', error: 'invalid_refresh_token' });
            return;
        }

        if (storedToken.expiresAt < new Date()) {
            // Expired — clean up and force re-login
            await prisma.refreshToken.delete({ where: { id: storedToken.id } });
            res.clearCookie('auth_token', cookieOptions);
            res.clearCookie('refresh_token', cookieOptions);
            res.status(401).json({ success: false, message: 'Refresh token has expired. Please login again.', error: 'refresh_token_expired' });
            return;
        }

        // 2. Verify JWT signature (extra security layer)
        try {
            verifyRefreshToken(incomingToken);
        } catch {
            await prisma.refreshToken.delete({ where: { id: storedToken.id } });
            res.clearCookie('auth_token', cookieOptions);
            res.clearCookie('refresh_token', cookieOptions);
            res.status(401).json({ success: false, message: 'Invalid refresh token.', error: 'invalid_refresh_token' });
            return;
        }

        const employee = storedToken.employee;

        // Block inactive/terminated accounts from refreshing tokens
        if (employee.employmentStatus === 'INACTIVE' || employee.employmentStatus === 'TERMINATED') {
            await prisma.refreshToken.deleteMany({ where: { employeeId: employee.id } });
            res.clearCookie('auth_token', cookieOptions);
            res.clearCookie('refresh_token', cookieOptions);
            res.status(403).json({ success: false, message: 'Your account has been deactivated.', error: 'account_inactive' });
            return;
        }

        const tokenPayload = {
            employeeId: employee.id,
            role: employee.role,
            firstName: employee.firstName,
            lastName: employee.lastName,
            name: `${employee.firstName} ${employee.lastName}`
        };

        // 3. Rotate — delete old token, issue new pair
        const newAccessToken = generateAccessToken(tokenPayload);
        const newRefreshTokenValue = generateRefreshToken(tokenPayload);
        const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

        await prisma.refreshToken.delete({ where: { id: storedToken.id } });
        await prisma.refreshToken.create({
            data: { token: newRefreshTokenValue, employeeId: employee.id, expiresAt }
        });

        // 4. Set new cookies
        res.cookie('auth_token', newAccessToken, { ...cookieOptions, maxAge: 60 * 60 * 1000 });
        res.cookie('refresh_token', newRefreshTokenValue, { ...cookieOptions, maxAge: REFRESH_TOKEN_TTL_MS });

        res.status(200).json({
            success: true,
            message: 'Token refreshed successfully',
            // Returned so the Next.js proxy can relay them as HttpOnly cookies.
            // These are stripped from the browser-facing response in the route handler.
            accessToken: newAccessToken,
            refreshToken: newRefreshTokenValue,
        });

    } catch (error: unknown) {
        console.error('Token refresh failed:', error);
        res.status(500).json({ success: false, message: 'Token refresh failed', error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : 'Internal server error' });
    }
};

/**
 * Logout Controller
 * Deletes the refresh token from DB and clears both auth cookies.
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
    try {
        const refreshTokenValue = req.cookies?.refresh_token;
        let employeeIdToLog: number | undefined;
        let employeeNameToLog: string = 'Unknown User';

        if (refreshTokenValue) {
            // Find the token to identify WHO is logging out before we delete it
            const storedToken = await prisma.refreshToken.findUnique({
                where: { token: refreshTokenValue },
                select: { 
                    id: true, 
                    employeeId: true,
                    employee: { select: { firstName: true, lastName: true, email: true } }
                }
            });

            if (storedToken) {
                employeeIdToLog = storedToken.employeeId;
                employeeNameToLog = `${storedToken.employee.firstName} ${storedToken.employee.lastName}`;
                // Delete from DB — token is now truly dead, cannot be reused
                await prisma.refreshToken.delete({
                    where: { id: storedToken.id }
                });
            }
        }

        res.clearCookie('auth_token', cookieOptions);
        res.clearCookie('refresh_token', cookieOptions);

        res.status(200).json({ success: true, message: 'Logged out successfully' });

        if (employeeIdToLog) {
            void audit({
                action: 'LOGOUT',
                entityType: 'Account',
                entityId: employeeIdToLog,
                performedBy: employeeIdToLog,
                source: 'admin-panel',
                details: `User ${employeeNameToLog} logged out`,
                metadata: { 
                    ip: req.ip, 
                    userAgent: req.headers['user-agent'] 
                },
                correlationId: req.correlationId
            });
        }

    } catch (error: unknown) {
        console.error('Logout failed:', error);
        // Still clear cookies even if DB operation fails
        res.clearCookie('auth_token', cookieOptions);
        res.clearCookie('refresh_token', cookieOptions);
        res.status(200).json({ success: true, message: 'Logged out successfully' });
    }
};
/**
 * GET /api/auth/me
 * Returns the currently authenticated user's data from the DB.
 * Requires a valid auth_token cookie (HttpOnly).
 */
export const me = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Not authenticated.', error: 'unauthorized' });
            return;
        }

        const employee = await prisma.employee.findUnique({
            where: { id: req.user.employeeId },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                contactNumber: true,
                departmentId: true,
                Department: { select: { name: true } },
                branchId: true,
                Branch: { select: { name: true } },
                position: true,
                employmentStatus: true,
                needsPasswordChange: true,
                profilePicture: true,
            }
        });

        if (!employee) {
            res.status(404).json({ success: false, message: 'Employee not found.' });
            return;
        }

        // Boot out inactive/terminated accounts
        if (employee.employmentStatus === 'INACTIVE' || employee.employmentStatus === 'TERMINATED') {
            res.status(403).json({ success: false, message: 'Your account has been deactivated.', error: 'account_inactive' });
            return;
        }

        res.status(200).json({ success: true, employee });

    } catch (error: unknown) {
        console.error('GET /auth/me failed:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch user.', error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : 'Internal server error' });
    }
};

