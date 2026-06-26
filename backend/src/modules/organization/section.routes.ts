import express from 'express';
import { getAllSections, createSection, renameSection, deleteSection } from './section.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { adminManagerOrHR } from '../../shared/middleware/role.middleware';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

/**
 * @swagger
 * /api/sections:
 *   get:
 *     summary: Retrieve a list of sections
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: integer
 *         description: Filter sections by department ID
 *     responses:
 *       200:
 *         description: A list of sections.
 */
router.get('/', getAllSections);

/**
 * @swagger
 * /api/sections:
 *   post:
 *     summary: Create a new section
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', adminManagerOrHR, createSection);

/**
 * @swagger
 * /api/sections/{id}:
 *   put:
 *     summary: Rename a section
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Section renamed
 *       404:
 *         description: Section not found
 */
router.put('/:id', adminManagerOrHR, renameSection);

/**
 * @swagger
 * /api/sections/{id}:
 *   delete:
 *     summary: Delete a section
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Section deleted
 *       404:
 *         description: Section not found
 */
router.delete('/:id', adminManagerOrHR, deleteSection);

export default router;
