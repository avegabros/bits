import express from 'express';
import { getBranches, createBranch, renameBranch, deleteBranch, addCompanyToBranch, removeCompanyFromBranch } from './branch.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { adminOrHR } from '../../shared/middleware/role.middleware';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

/**
 * @swagger
 * /api/branches:
 *   get:
 *     summary: Retrieve a list of branches
 *     tags: [Branches]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of branches.
 */
router.get('/', getBranches);

/**
 * @swagger
 * /api/branches:
 *   post:
 *     summary: Create a new branch
 *     tags: [Branches]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', adminOrHR, createBranch);

/**
 * @swagger
 * /api/branches/{id}:
 *   put:
 *     summary: Rename a branch
 *     tags: [Branches]
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
 *         description: Branch renamed
 *       404:
 *         description: Branch not found
 */
router.put('/:id', adminOrHR, renameBranch);

/**
 * @swagger
 * /api/branches/{id}:
 *   delete:
 *     summary: Delete a branch
 *     tags: [Branches]
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
 *         description: Branch deleted
 *       404:
 *         description: Branch not found
 */
router.delete('/:id', adminOrHR, deleteBranch);

/**
 * @swagger
 * /api/branches/{id}/companies:
 *   post:
 *     summary: Assign a company to a branch
 *     tags: [Branches]
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
 *               companyId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Company assigned to branch
 */
router.post('/:id/companies', adminOrHR, addCompanyToBranch);

/**
 * @swagger
 * /api/branches/{id}/companies/{companyId}:
 *   delete:
 *     summary: Unassign a company from a branch
 *     tags: [Branches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Company unassigned from branch
 */
router.delete('/:id/companies/:companyId', adminOrHR, removeCompanyFromBranch);

export default router;
