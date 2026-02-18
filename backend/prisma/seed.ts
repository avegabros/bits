import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Starting seed...')

    // 1. Create Departments
    const departments = ['Engineering', 'Design', 'HR', 'Finance', 'Marketing', 'Operations']
    for (const name of departments) {
        await prisma.department.upsert({
            where: { name },
            update: {},
            create: { name, updatedAt: new Date() }
        })
    }

    // 2. Create Devices (mock)
    await prisma.device.upsert({
        where: { ip: '192.168.1.201' },
        update: {},
        create: {
            name: 'Main Entrance Biometric',
            ip: '192.168.1.201',
            port: 4370,
            location: 'Main Lobby',
            isActive: true,
            updatedAt: new Date()
        }
    })

    // 3. Create Employees/Users
    const passwordHash = await bcrypt.hash('password123', 10)

    const users = [
        {
            email: 'admin@bits.com',
            firstName: 'Admin',
            lastName: 'User',
            role: 'ADMIN',
            department: 'Operations',
            position: 'System Administrator',
            preferredZkId: 1
        },
        {
            email: 'hr@bits.com',
            firstName: 'Maria',
            lastName: 'Santos',
            role: 'HR',
            department: 'HR',
            position: 'HR Manager',
            preferredZkId: 2
        },
        {
            email: 'john@bits.com',
            firstName: 'John',
            lastName: 'Doe',
            role: 'EMPLOYEE',
            department: 'Engineering',
            position: 'Senior Developer',
            preferredZkId: 3
        },
        {
            email: 'jane@bits.com',
            firstName: 'Jane',
            lastName: 'Smith',
            role: 'EMPLOYEE',
            department: 'Design',
            position: 'UI Designer',
            preferredZkId: 4
        },
        {
            email: 'alex@bits.com',
            firstName: 'Alex',
            lastName: 'Rivera',
            role: 'EMPLOYEE',
            department: 'Marketing',
            position: 'Marketing Lead',
            preferredZkId: 5
        }
    ]

    for (const u of users) {
        // Check if user exists by email
        const existing = await prisma.employee.findUnique({ where: { email: u.email } })
        let empId = existing?.id
        let empZkId = existing?.zkId

        if (!existing) {
            // Find a valid zkId: try preferred, if taken, find max + 1
            const zkCheck = await prisma.employee.findUnique({ where: { zkId: u.preferredZkId } })

            let finalZkId = u.preferredZkId
            if (zkCheck) {
                // Preferred ID taken, find next available
                const max = await prisma.employee.findFirst({ orderBy: { zkId: 'desc' } })
                finalZkId = (max?.zkId || 0) + 1
            }

            const newEmp = await prisma.employee.create({
                data: {
                    firstName: u.firstName,
                    lastName: u.lastName,
                    email: u.email,
                    password: passwordHash,
                    role: u.role as any,
                    department: u.department,
                    position: u.position,
                    zkId: finalZkId,
                    employmentStatus: 'ACTIVE',
                    employeeNumber: `EMP${String(finalZkId).padStart(3, '0')}`,
                    branch: 'MAIN OFFICE',
                    hireDate: new Date('2024-01-15'),
                    updatedAt: new Date()
                }
            })
            empId = newEmp.id
            empZkId = newEmp.zkId
            console.log(`👤 Created user: ${u.email} (zkId: ${finalZkId})`)
        } else {
            console.log(`👤 User already exists: ${u.email}`)
        }

        // 4. Generate Attendance for last 7 days ONLY if we have a valid employee
        if (empId && empZkId) {
            const today = new Date()
            for (let i = 0; i < 7; i++) {
                const date = new Date(today)
                date.setDate(date.getDate() - i)
                const dateStr = date.toISOString().split('T')[0]

                // Skip weekends
                if (date.getDay() === 0 || date.getDay() === 6) continue

                // Check if attendance already exists for this date
                const existingAtt = await prisma.attendance.findUnique({
                    where: {
                        employeeId_date: {
                            employeeId: empId,
                            date: new Date(dateStr + 'T00:00:00.000Z')
                        }
                    }
                })

                if (existingAtt) continue // Don't overwrite existing attendance

                // Generate mock attendance
                const rand = Math.random()
                if (rand > 0.95) continue // Absent

                let inHour = 7, inMin = 45 + Math.floor(Math.random() * 15) // On time
                if (rand > 0.8 && rand <= 0.95) { // Late
                    inHour = 8
                    inMin = Math.floor(Math.random() * 30) // 8:00 - 8:30
                }

                const checkIn = new Date(dateStr)
                checkIn.setHours(inHour, inMin, 0, 0)

                let checkOut = null
                if (Math.random() > 0.05) {
                    checkOut = new Date(dateStr)
                    checkOut.setHours(17, Math.floor(Math.random() * 30), 0, 0) // 5:00 - 5:30 PM
                }

                await prisma.attendance.create({
                    data: {
                        employeeId: empId,
                        date: new Date(dateStr + 'T00:00:00.000Z'),
                        checkInTime: checkIn,
                        checkOutTime: checkOut || undefined,
                        status: (inHour === 7 || (inHour === 8 && inMin === 0)) ? 'present' : 'late',
                    }
                })
            }
        }
    }

    console.log('✅ Seed completed')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
