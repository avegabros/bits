/// <reference types="node" />
import * as path from 'path'
import * as dotenv from 'dotenv'
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Starting seed...')

    // ──────────────────────────────────────────────
    // 1. Branches
    // ──────────────────────────────────────────────
    const branchNames = ['MAIN OFFICE', 'NRA', 'MAKATI']

    for (const name of branchNames) {
        await prisma.branch.upsert({
            where: { name },
            update: {},
            create: { name, updatedAt: new Date() },
        })
        console.log(`🏢 Branch: ${name}`)
    }

    // ──────────────────────────────────────────────
    // 2. Departments
    // ──────────────────────────────────────────────
    const departmentNames = [
        'ACCOUNTING',
        'ADMIN',
        'ENGINEERING',
        'HUMAN RESOURCES',
        'IT',
        'LOGISTICS',
        'MAINTENANCE',
        'MANAGEMENT',
        'MARKETING',
        'OPERATIONS',
        'PRODUCTION',
        'PURCHASING',
        'QUALITY ASSURANCE',
        'RESEARCH AND DEVELOPMENT',
        'SAFETY',
        'SALES',
        'SUPPLY CHAIN',
        'WAREHOUSE',
    ]

    for (const name of departmentNames) {
        await prisma.department.upsert({
            where: { name },
            update: {},
            create: { name, updatedAt: new Date() },
        })
        console.log(`🏷️  Department: ${name}`)
    }

    // ──────────────────────────────────────────────
    // 3. Shifts
    // ──────────────────────────────────────────────

    // ──────────────────────────────────────────────
    // 4. Company
    // ──────────────────────────────────────────────

    // ──────────────────────────────────────────────
    // 5. SyncConfig
    // ──────────────────────────────────────────────
    await prisma.syncConfig.upsert({
        where: { id: 1 },
        update: {},
        create: {
            id: 1,
            globalSyncEnabled: true,
            defaultIntervalSec: 30,
            highFreqIntervalSec: 30,
            lowFreqIntervalSec: 600,
            shiftAwareSyncEnabled: false,
            shiftBufferMinutes: 120,
            autoTimeSyncEnabled: true,
            timeSyncIntervalSec: 3600,
            updatedAt: new Date()
        }
    })
    console.log('⚙️ Seeded sync config')

    // ──────────────────────────────────────────────
    // 6. Employees
    // NOTE: zkId 1 is RESERVED for the ZKTeco device SUPER ADMIN — never use it.
    //       Employee zkIds start from 2.
    // ──────────────────────────────────────────────
    const passwordHash = await bcrypt.hash('password123', 10)

    const employees = [
        {
            email: 'admin@avegabros.com',
            firstName: 'Admin',
            lastName: 'User',
            role: 'ADMIN' as const,
            department: null,
            position: 'System Administrator',
            branch: null,
            contactNumber: null,
            employeeNumber: null,
            preferredZkId: null, // Admin doesn't need a ZK ID
        },
        {
            email: 'hr@avegabros.com',
            firstName: 'Maria',
            lastName: 'Santos',
            role: 'HR' as const,
            department: null,
            position: 'HR Manager',
            branch: null,
            contactNumber: null,
            employeeNumber: null,
            preferredZkId: null, // Admin doesn't need a ZK ID
        },
    ]

    for (const u of employees) {
        const existing = await prisma.employee.findUnique({ where: { email: u.email } })

        if (!existing) {
            // Determine safe zkId if provided — never use 1 (device SUPER ADMIN)
            let finalZkId: number | null = null

            if (u.preferredZkId) {
                const zkCheck = await prisma.employee.findUnique({ where: { zkId: u.preferredZkId } })
                finalZkId = u.preferredZkId
                if (zkCheck) {
                    const max = await prisma.employee.findFirst({ orderBy: { zkId: 'desc' } })
                    finalZkId = Math.max((max?.zkId || 1) + 1, 2)
                }
            }

            // Look up the branch and department IDs for the FK relations.
            const branchRow = u.branch
                ? await prisma.branch.findUnique({ where: { name: u.branch } })
                : null
            const deptRow = u.department
                ? await prisma.department.findUnique({ where: { name: u.department } })
                : null

            await prisma.employee.create({
                data: {
                    firstName: u.firstName,
                    lastName: u.lastName,
                    email: u.email,
                    password: passwordHash,
                    role: u.role,
                    departmentId: deptRow?.id ?? null,
                    position: u.position,
                    branchId: branchRow?.id ?? null,
                    shiftId: null,
                    contactNumber: u.contactNumber,
                    employeeNumber: u.employeeNumber,
                    zkId: finalZkId,
                    employmentStatus: 'ACTIVE',
                    hireDate: new Date('2024-01-15'),
                    updatedAt: new Date(),
                },
            })
            console.log(`👤 Created: ${u.firstName} ${u.lastName} (${u.role}, zkId: ${finalZkId})`)
        } else {
            // Ensure existing admin/hr don't have a zkId if we are running seed again
            if (u.preferredZkId === null && existing.zkId !== null) {
                await prisma.employee.update({
                    where: { id: existing.id },
                    data: { zkId: null }
                })
                console.log(`👤 Updated: ${u.firstName} ${u.lastName} (Removed zkId)`)
            } else {
                console.log(`👤 Already exists: ${u.email}`)
            }
        }
    }

    console.log('')
    console.log('✅ Seed completed!')
    console.log('')
    console.log('📋 Test accounts:')
    console.log('   Admin:  admin@avegabros.com / password123')
    console.log('   HR:     hr@avegabros.com    / password123')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
