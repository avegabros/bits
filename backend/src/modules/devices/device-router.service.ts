import { prisma } from '../../shared/lib/prisma';
import { Device } from '@prisma/client';

export async function getDeviceRoute(deviceId: number): Promise<
    | { mode: 'direct'; device: Device }
    | { mode: 'agent'; branchId: number; device: Device }
> {
    const device = await prisma.device.findUnique({
        where: { id: deviceId },
        include: { 
            branch: { 
                include: { 
                    agents: { 
                        where: { isEnabled: true } 
                    } 
                } 
            } 
        },
    });

    if (!device) throw new Error(`Device ${deviceId} not found`);

    // Route through Agent if device is linked to a branch with at least one enabled agent
    if (device.branchId && device.branch && (device.branch as any).agents?.length > 0) {
        return { mode: 'agent', branchId: device.branchId, device };
    }

    return { mode: 'direct', device };
}
