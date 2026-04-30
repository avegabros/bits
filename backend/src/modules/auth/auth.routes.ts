import { Router } from 'express';
import { register, login, refreshToken, logout, me } from './auth.controller';
import { validate } from '../../shared/middleware/validation.middleware';
import { registerValidator, loginValidator } from './auth.validator';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { managerOrAdmin } from '../../shared/middleware/role.middleware';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// ── Rate Limiters ─────────────────────────────────────────────────────────────

/**
 * Login rate limiter — hybrid key (IP + email) with auto-reset on success.
 *
 * Key strategy:  `${req.ip}:${email}` scopes the limit to a specific
 * IP + user combination. This prevents:
 *   - One attacker from blocking ALL users (IP-only problem behind NAT/proxy)
 *   - An attacker from trying many accounts from one IP (email-only problem)
 *
 * skipSuccessfulRequests: successful logins (2xx) do NOT count toward the limit,
 * so legitimate users never accumulate strikes from their own correct logins.
 */
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req, res) => {
        const email = req.body?.email?.toLowerCase?.() || 'unknown';
        return `${(ipKeyGenerator as (req: unknown, res: unknown) => string)(req, res)}:${email}`;
    },
    message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.', error: 'rate_limited' }
});

/** Refresh: max 30 refreshes per 15 minutes per IP */
const refreshLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many token refresh requests. Please try again later.', error: 'rate_limited' }
});

/** Register: max 5 new accounts per hour per IP */
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many registration attempts. Please try again in 1 hour.', error: 'rate_limited' }
});

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication endpoints
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user (Admin only)
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - password
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               employeeNumber:
 *                 type: string
 *               department:
 *                 type: string
 *               position:
 *                 type: string
 *               contactNumber:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [USER, ADMIN, HR]
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation error or user already exists
 *       401:
 *         description: Unauthorized - must be logged in
 *       403:
 *         description: Forbidden - ADMIN role required
 */
router.post('/register', registerLimiter, authenticate, managerOrAdmin, validate(registerValidator), register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', loginLimiter, validate(loginValidator), login);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: New access token generated
 *       401:
 *         description: Invalid refresh token
 */
router.post('/refresh', refreshLimiter, refreshToken);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout - clears auth cookies and invalidates refresh token in DB
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post('/logout', logout);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get the currently authenticated user
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Authenticated user data
 *       401:
 *         description: Not authenticated
 */
router.get('/me', authenticate, me);

export default router;