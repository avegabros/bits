import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../shared/lib/prisma';
import { getAllConnectedAgents } from './agent-gateway.service';
import { auditCreate, auditDelete, auditUpdate } from '../../shared/lib/auditHelpers';

// ─── GET /api/agents ─────────────────────────────────────────────────────────
export const getAllAgents = async (req: Request, res: Response) => {
    try {
        const dbAgents = await prisma.branchAgent.findMany({
            orderBy: { createdAt: 'asc' },
            include: {
                branch: {
                    select: { name: true }
                }
            }
        });

        // Correlate with active WebSocket connection state
        const connected = getAllConnectedAgents();
        const connectedMap = new Map(connected.map(c => [c.branchId, c]));

        const agents = dbAgents.map(agent => {
            const liveConn = connectedMap.get(agent.branchId);
            return {
                id: agent.id,
                branchId: agent.branchId,
                branchName: agent.branch?.name || 'Unknown',
                label: agent.label,
                isEnabled: agent.isEnabled,
                status: liveConn ? 'ONLINE' : 'OFFLINE',
                lastHeartbeatAt: agent.lastHeartbeatAt,
                lastConnectedAt: agent.lastConnectedAt,
                lastDisconnectedAt: agent.lastDisconnectedAt,
                agentVersion: agent.agentVersion,
                metadata: agent.metadata,
                createdAt: agent.createdAt
            };
        });

        res.json({ success: true, agents });
    } catch (error: any) {
        console.error('[Agents] Error listing agents:', error);
        res.status(500).json({ success: false, message: 'Failed to list branch agents', error: error.message });
    }
};

// ─── POST /api/agents ────────────────────────────────────────────────────────
export const createAgent = async (req: Request, res: Response) => {
    try {
        const { label, branchId } = req.body;

        if (!label?.trim()) {
            return res.status(400).json({ success: false, message: 'Agent label is required' });
        }
        if (!branchId) {
            return res.status(400).json({ success: false, message: 'Branch ID is required' });
        }

        // Verify branch exists
        const branch = await prisma.branch.findUnique({
            where: { id: Number(branchId) }
        });
        if (!branch) {
            return res.status(404).json({ success: false, message: 'Specified branch not found' });
        }

        // Verify if agent already exists for this branch
        const existingAgent = await prisma.branchAgent.findUnique({
            where: { branchId: Number(branchId) }
        });
        if (existingAgent) {
            return res.status(409).json({ success: false, message: `An agent is already registered for branch "${branch.name}"` });
        }

        // Generate raw security token
        const rawToken = 'agent_' + crypto.randomBytes(24).toString('hex');
        
        // Hash token for database storage
        const tokenHash = await bcrypt.hash(rawToken, 10);

        const agent = await prisma.branchAgent.create({
            data: {
                branchId: Number(branchId),
                label: label.trim(),
                tokenHash,
                isEnabled: true
            },
            include: {
                branch: { select: { name: true } }
            }
        });

        console.log(`[Agents] Created branch agent "${agent.label}" for branch "${agent.branch.name}"`);

        void auditCreate({
            entityType: 'BranchAgent',
            entityId: agent.id,
            performedBy: req.user?.employeeId,
            source: 'admin-panel',
            details: `Registered branch agent "${agent.label}" for branch "${agent.branch.name}"`,
            correlationId: req.correlationId
        }, {
            label: agent.label,
            branchName: agent.branch.name
        });

        // Return rawToken ONLY on initial creation so the admin can copy it!
        res.status(201).json({
            success: true,
            message: 'Branch agent registered successfully. Please copy the token now as it will not be displayed again.',
            agent: {
                id: agent.id,
                branchId: agent.branchId,
                branchName: agent.branch.name,
                label: agent.label,
                isEnabled: agent.isEnabled,
                createdAt: agent.createdAt
            },
            rawToken
        });
    } catch (error: any) {
        console.error('[Agents] Error registering agent:', error);
        res.status(500).json({ success: false, message: 'Failed to register branch agent', error: error.message });
    }
};

// ─── POST /api/agents/:id/toggle ─────────────────────────────────────────────
export const toggleAgent = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const { enabled } = req.body;

        if (enabled === undefined) {
            return res.status(400).json({ success: false, message: 'Missing "enabled" field' });
        }

        const previousAgent = await prisma.branchAgent.findUnique({
            where: { id },
            include: { branch: { select: { name: true } } }
        });

        if (!previousAgent) {
            return res.status(404).json({ success: false, message: 'Branch agent not found' });
        }

        const agent = await prisma.branchAgent.update({
            where: { id },
            data: { isEnabled: Boolean(enabled) },
            include: { branch: { select: { name: true } } }
        });

        const state = enabled ? 'enabled' : 'disabled';
        console.log(`[Agents] Branch agent "${agent.label}" has been ${state}`);

        void auditUpdate({
            entityType: 'BranchAgent',
            entityId: agent.id,
            performedBy: req.user?.employeeId,
            source: 'admin-panel',
            details: `Branch agent "${agent.label}" for branch "${agent.branch.name}" was ${state}`,
            correlationId: req.correlationId
        }, [
            { field: 'Enabled Status', oldValue: previousAgent.isEnabled ? 'Enabled' : 'Disabled', newValue: agent.isEnabled ? 'Enabled' : 'Disabled' }
        ]);

        res.json({
            success: true,
            message: `Branch agent is now ${state}`,
            agent: {
                id: agent.id,
                branchId: agent.branchId,
                branchName: agent.branch.name,
                label: agent.label,
                isEnabled: agent.isEnabled
            }
        });
    } catch (error: any) {
        console.error('[Agents] Error toggling agent:', error);
        res.status(500).json({ success: false, message: 'Failed to toggle agent status', error: error.message });
    }
};

// ─── DELETE /api/agents/:id ──────────────────────────────────────────────────
export const deleteAgent = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);

        const agent = await prisma.branchAgent.findUnique({
            where: { id },
            include: { branch: { select: { name: true } } }
        });

        if (!agent) {
            return res.status(404).json({ success: false, message: 'Branch agent not found' });
        }

        await prisma.branchAgent.delete({
            where: { id }
        });

        console.log(`[Agents] Deleted branch agent "${agent.label}"`);

        void auditDelete({
            entityType: 'BranchAgent',
            entityId: agent.id,
            performedBy: req.user?.employeeId,
            source: 'admin-panel',
            details: `Deleted branch agent "${agent.label}" of branch "${agent.branch.name}"`,
            correlationId: req.correlationId
        }, {
            label: agent.label,
            branchName: agent.branch.name
        });

        res.json({ success: true, message: 'Branch agent deleted successfully' });
    } catch (error: any) {
        console.error('[Agents] Error deleting agent:', error);
        res.status(500).json({ success: false, message: 'Failed to delete branch agent', error: error.message });
    }
};
