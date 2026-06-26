import { prisma } from '../../shared/lib/prisma';
import { processAttendanceLogs } from '../../modules/attendance/attendance-processor';
import { toPHTDate } from '../../modules/attendance/attendance-utils';
import * as readline from 'readline';

// Define CLI colors
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

// Helper for readline prompting
function askQuestion(query: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise((resolve) => rl.question(query, (ans) => {
        rl.close();
        resolve(ans.trim());
    }));
}

// Convert Philippine Time string (date: YYYY-MM-DD, time: HH:MM) to UTC Date object
function parsePHTToUTC(dateStr: string, timeStr: string): Date {
    const phtString = `${dateStr}T${timeStr}:00+08:00`;
    return new Date(phtString);
}

// Format UTC date to local PHT ISO string for display
function formatToLocalISO(date: Date): string {
    const localTime = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    return localTime.toISOString().slice(0, 19).replace('T', ' ') + ' (PHT)';
}

function printHelp() {
    console.log(`
${colors.bright}${colors.cyan}Manual Attendance Log Generator Helper${colors.reset}
--------------------------------------------------
Usage:
  npx ts-node src/scripts/debug/create-attendance-log.ts [options]

If run without options, the script launches an interactive prompt flow.

Options:
  --employeeId <id>       Database ID of the employee
  --email <email>         Email of the employee
  --zkId <id>             ZK Biometric ID of the employee
  --employeeNumber <no>   Employee number
  --date <YYYY-MM-DD>     Log date (defaults to today)
  --punches <HH:MM,...>   Comma-separated list of punch times (e.g. --punches "08:00,17:00")
  --deviceId <id>         Associate logs with a specific device ID
  --auth <method>         Authentication method (FINGERPRINT, CARD, PASSWORD, MANUAL)
  --process               Automatically run reconciliation process
  --help                  Show this help message
`);
}

function parseArgs() {
    const args: Record<string, string | boolean> = {};
    for (let i = 2; i < process.argv.length; i++) {
        const arg = process.argv[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const nextVal = process.argv[i + 1];
            if (nextVal && !nextVal.startsWith('--')) {
                args[key] = nextVal;
                i++; // Skip the next argument
            } else {
                args[key] = true;
            }
        }
    }
    return args;
}

async function main() {
    const args = parseArgs();

    if (args.help) {
        printHelp();
        return;
    }

    let employee = null;
    let dateStr = '';
    const punches: { time: string }[] = [];
    let selectedDeviceId: number | null = null;
    let autoProcess = false;
    let authMethod = 'FINGERPRINT';

    // Check if arguments were passed for non-interactive run
    const hasArgs = args.employeeId || args.email || args.zkId || args.employeeNumber;

    if (hasArgs) {
        // --- NON-INTERACTIVE MODE ---
        console.log(`${colors.cyan}Running in non-interactive CLI mode...${colors.reset}`);

        // 1. Find employee
        if (args.employeeId) {
            employee = await prisma.employee.findUnique({ where: { id: Number(args.employeeId) } });
        } else if (args.email) {
            employee = await prisma.employee.findUnique({ where: { email: String(args.email) } });
        } else if (args.zkId) {
            employee = await prisma.employee.findUnique({ where: { zkId: Number(args.zkId) } });
        } else if (args.employeeNumber) {
            employee = await prisma.employee.findUnique({ where: { employeeNumber: String(args.employeeNumber) } });
        }

        if (!employee) {
            console.error(`${colors.red}Error: Employee not found with specified criteria.${colors.reset}`);
            process.exit(1);
        }

        // 2. Resolve date
        const todayStr = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
        dateStr = args.date ? String(args.date) : todayStr;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            console.error(`${colors.red}Error: Invalid date format. Use YYYY-MM-DD.${colors.reset}`);
            process.exit(1);
        }

        // 3. Resolve punches
        if (args.punches) {
            const punchTimes = String(args.punches).split(',');
            for (const pt of punchTimes) {
                let time = pt.trim();
                // Auto-pad single-digit hour formats (e.g. "8:00" -> "08:00")
                if (/^\d:\d{2}$/.test(time)) {
                    time = `0${time}`;
                }
                if (!/^\d{2}:\d{2}$/.test(time)) {
                    console.error(`${colors.red}Error: Invalid punch time format "${time}". Use HH:MM.${colors.reset}`);
                    process.exit(1);
                }
                punches.push({ time });
            }
        } else {
            console.error(`${colors.red}Error: You must specify --punches <HH:MM,...> when using CLI arguments.${colors.reset}`);
            process.exit(1);
        }

        // 4. Device ID
        if (args.deviceId) {
            selectedDeviceId = Number(args.deviceId);
            const deviceExists = await prisma.device.findUnique({ where: { id: selectedDeviceId } });
            if (!deviceExists) {
                console.warn(`${colors.yellow}Warning: Device with ID ${selectedDeviceId} does not exist in DB.${colors.reset}`);
            }
        }

        // 5. Auth Method
        if (args.auth) {
            const requestedAuth = String(args.auth).toUpperCase();
            if (['FINGERPRINT', 'CARD', 'PASSWORD', 'MANUAL'].includes(requestedAuth)) {
                authMethod = requestedAuth;
                console.log(`Auth Method: ${authMethod}`);
            } else {
                console.error(`${colors.red}Error: Invalid auth method. Use FINGERPRINT, CARD, PASSWORD, or MANUAL.${colors.reset}`);
                process.exit(1);
            }
        }

        autoProcess = !!args.process;

    } else {
        // --- INTERACTIVE MODE ---
        console.log(`\n${colors.bright}${colors.cyan}=== MANUAL ATTENDANCE LOG GENERATOR ===${colors.reset}`);
        
        // 1. Search employee
        while (!employee) {
            const searchTerm = await askQuestion('Search Employee (by name, email, zkId, employeeNumber): ');
            if (!searchTerm) {
                console.log('Search term cannot be empty.');
                continue;
            }

            const matches = await prisma.employee.findMany({
                where: {
                    OR: [
                        { firstName: { contains: searchTerm, mode: 'insensitive' } },
                        { lastName: { contains: searchTerm, mode: 'insensitive' } },
                        { email: { contains: searchTerm, mode: 'insensitive' } },
                        { employeeNumber: { contains: searchTerm, mode: 'insensitive' } }
                    ]
                },
                take: 10
            });

            // Also check if numeric search matches ID, zkId, or cardNumber
            const searchNum = parseInt(searchTerm, 10);
            if (!isNaN(searchNum)) {
                const numMatches = await prisma.employee.findMany({
                    where: {
                        OR: [
                            { id: searchNum },
                            { zkId: searchNum },
                            { cardNumber: searchNum }
                        ]
                    }
                });
                for (const emp of numMatches) {
                    if (!matches.some(m => m.id === emp.id)) {
                        matches.push(emp);
                    }
                }
            }

            if (matches.length === 0) {
                console.log(`${colors.yellow}No employees found matching "${searchTerm}". Please try again.${colors.reset}`);
                continue;
            }

            console.log(`\nFound ${matches.length} matching employee(s):`);
            matches.forEach((emp, index) => {
                console.log(`  [${index + 1}] ID: ${emp.id} | zkId: ${emp.zkId ?? 'N/A'} | EmpNo: ${emp.employeeNumber ?? 'N/A'} | Name: ${emp.firstName} ${emp.lastName} | Email: ${emp.email ?? 'N/A'}`);
            });

            const choiceStr = await askQuestion(`Select employee (1-${matches.length}) or press enter to search again: `);
            if (!choiceStr) continue;

            const choice = parseInt(choiceStr, 10);
            if (isNaN(choice) || choice < 1 || choice > matches.length) {
                console.log('Invalid choice.');
                continue;
            }

            employee = matches[choice - 1];
        }

        console.log(`\nSelected employee: ${colors.bright}${colors.green}${employee.firstName} ${employee.lastName}${colors.reset} (ID: ${employee.id})`);

        // 2. Date
        const todayStr = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
        while (true) {
            const inputDate = await askQuestion(`Enter punch date (YYYY-MM-DD, default is today: ${todayStr}): `);
            if (!inputDate) {
                dateStr = todayStr;
                break;
            }
            if (/^\d{4}-\d{2}-\d{2}$/.test(inputDate)) {
                dateStr = inputDate;
                break;
            }
            console.log(`${colors.red}Invalid date format. Please use YYYY-MM-DD.${colors.reset}`);
        }

        // 3. Log punches (input comma-separated)
        console.log(`\n${colors.bright}Enter Punch Times:${colors.reset}`);
        console.log(`- You can enter a single time (e.g. "8:00") or multiple times (e.g. "8:00, 17:00").`);
        console.log(`- A single punch will either create a Check-In record (if none exists),`);
        console.log(`  or pair with an existing Check-In to record a Check-Out.`);
        
        while (true) {
            const inputPunchesStr = await askQuestion('Enter punch times (comma-separated, default "08:00, 17:00"): ');
            const resolvedInput = inputPunchesStr === '' ? '08:00, 17:00' : inputPunchesStr;
            
            const timeParts = resolvedInput.split(',');
            let valid = true;
            const parsedPunches = [];
            
            for (const part of timeParts) {
                let trimmed = part.trim();
                // Auto-pad single digit hours (e.g. "8:00" -> "08:00")
                if (/^\d:\d{2}$/.test(trimmed)) {
                    trimmed = `0${trimmed}`;
                }
                
                if (!/^\d{2}:\d{2}$/.test(trimmed)) {
                    console.log(`${colors.red}Invalid time format "${trimmed}". Please use HH:MM (e.g. 08:00).${colors.reset}`);
                    valid = false;
                    break;
                }
                parsedPunches.push({ time: trimmed });
            }
            
            if (valid && parsedPunches.length > 0) {
                punches.push(...parsedPunches);
                break;
            }
        }

        // 4. Device Selection
        console.log('\nFetching active biometric devices...');
        const devices = await prisma.device.findMany({ where: { isActive: true } });
        if (devices.length > 0) {
            console.log('Select a device to associate with these logs:');
            console.log('  [0] None (No device)');
            devices.forEach((dev, idx) => {
                console.log(`  [${idx + 1}] ${dev.name} (IP: ${dev.ip}, Location: ${dev.location ?? 'N/A'})`);
            });
            const devChoiceStr = await askQuestion(`Select device (0-${devices.length}, default 1): `);
            const devChoice = devChoiceStr === '' ? 1 : parseInt(devChoiceStr, 10);
            if (!isNaN(devChoice) && devChoice > 0 && devChoice <= devices.length) {
                selectedDeviceId = devices[devChoice - 1].id;
                console.log(`Selected Device: ${devices[devChoice - 1].name}`);
            } else {
                console.log('No device selected.');
            }
        } else {
            console.log('No active devices found in the database. Logs will be created without device association.');
        }

        // 4.5. Auth Method Selection
        console.log('\nSelect authentication method:');
        console.log('  [1] Fingerprint (default)');
        console.log('  [2] RFID Card');
        console.log('  [3] Password');
        console.log('  [4] Manual');
        const authChoiceStr = await askQuestion('Select method [1-4, default 1]: ');
        const authChoice = authChoiceStr === '' ? 1 : parseInt(authChoiceStr, 10);
        if (authChoice === 2) {
            authMethod = 'CARD';
        } else if (authChoice === 3) {
            authMethod = 'PASSWORD';
        } else if (authChoice === 4) {
            authMethod = 'MANUAL';
        }

        // 5. 48-hour cutoff warning
        const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
        let hasCutoffWarning = false;
        for (const p of punches) {
            const punchTime = parsePHTToUTC(dateStr, p.time);
            if (punchTime < cutoff) {
                hasCutoffWarning = true;
                break;
            }
        }

        if (hasCutoffWarning) {
            console.log(`\n${colors.yellow}⚠️  WARNING: One or more selected times are older than 48 hours.${colors.reset}`);
            console.log(`   The system's automatic log processor only reconciles logs from the last 48 hours.`);
            console.log(`   Cutoff time is: ${colors.bright}${formatToLocalISO(cutoff)}${colors.reset}`);
            console.log(`   If you proceed, these logs will be inserted as raw logs, but they will NOT be`);
            console.log(`   processed into the Attendance table automatically.`);
            const proceedStr = await askQuestion('Do you want to proceed anyway? (y/n, default y): ');
            if (proceedStr.toLowerCase() === 'n') {
                console.log('Operation cancelled.');
                return;
            }
        }

        // 6. Final Confirmation
        console.log(`\n${colors.bright}=== SUMMARY OF LOGS TO CREATE ===${colors.reset}`);
        console.log(`Employee: ${employee.firstName} ${employee.lastName} (ID: ${employee.id})`);
        punches.forEach((p, idx) => {
            const utcTime = parsePHTToUTC(dateStr, p.time);
            console.log(` - Punch #${idx + 1}: PHT: ${dateStr} ${p.time} | UTC: ${utcTime.toISOString()}`);
        });
        console.log(`Device ID: ${selectedDeviceId ?? 'None'}`);
        console.log(`Auth Method: ${authMethod}`);

        const confirm = await askQuestion('\nInsert these logs into database? (y/n, default y): ');
        if (confirm.toLowerCase() === 'n') {
            console.log('Operation cancelled.');
            return;
        }

        autoProcess = true;
    }

    // --- EXECUTION / WRITING TO DATABASE ---
    console.log(`\nInserting logs for employee ID ${employee.id}...`);
    for (const p of punches) {
        const timestamp = parsePHTToUTC(dateStr, p.time);

        // Check for duplicates
        const existingLog = await prisma.attendanceLog.findUnique({
            where: {
                timestamp_employeeId: {
                    timestamp,
                    employeeId: employee.id
                }
            }
        });

        if (existingLog) {
            console.log(`${colors.yellow}⚠️  Log at ${dateStr} ${p.time} already exists for employee. Skipping creation.${colors.reset}`);
            continue;
        }

        const log = await prisma.attendanceLog.create({
            data: {
                employeeId: employee.id,
                timestamp,
                status: 0, // Default status for raw punches
                deviceId: selectedDeviceId,
                authMethod,
                createdAt: new Date()
            }
        });
        console.log(`${colors.green}✅ Inserted AttendanceLog ID: ${log.id}${colors.reset} (PHT: ${dateStr} ${p.time})`);
    }

    // --- RECONCILIATION / PROCESSING ---
    if (autoProcess || (!hasArgs && (await askQuestion('\nDo you want to run processAttendanceLogs() now to reconcile logs? (y/n, default y): ')).toLowerCase() !== 'n')) {
        console.log('\nRunning attendance logs processor...');
        const result = await processAttendanceLogs();
        console.log(`${colors.bright}${colors.green}Reconciliation process completed!${colors.reset}`);
        console.log(`  Success:   ${result.success}`);
        console.log(`  Processed: ${result.processed} log(s)`);
        console.log(`  Created:   ${result.created} attendance record(s)`);
        console.log(`  Updated:   ${result.updated} attendance record(s)`);

        // Display results
        console.log(`\n${colors.bright}${colors.cyan}=== UPDATED ATTENDANCE RECORDS ===${colors.reset}`);
        const targetDate = toPHTDate(parsePHTToUTC(dateStr, punches[0].time));
        const attRecords = await prisma.attendance.findMany({
            where: {
                employeeId: employee.id,
                date: targetDate
            },
            include: {
                shift: true
            }
        });

        if (attRecords.length === 0) {
            console.log(`${colors.yellow}No Attendance records found for this employee on ${dateStr}.${colors.reset}`);
            console.log(`Note: If the punch date is older than 48 hours, it will not be processed automatically.`);
        } else {
            attRecords.forEach((att, idx) => {
                console.log(`Record #${idx + 1}:`);
                console.log(`  Date:            ${new Date(att.date.getTime() + 8*60*60*1000).toISOString().slice(0, 10)}`);
                console.log(`  Shift:           ${att.shift?.name ?? 'None'} (${att.shift?.startTime ?? 'N/A'} - ${att.shift?.endTime ?? 'N/A'})`);
                console.log(`  Check-In Time:   ${att.checkInTime ? formatToLocalISO(att.checkInTime) : 'N/A'}`);
                console.log(`  Check-Out Time:  ${att.checkOutTime ? formatToLocalISO(att.checkOutTime) : `${colors.red}N/A (Open Record)${colors.reset}`}`);
                console.log(`  Status:          ${colors.bright}${att.status === 'present' ? colors.green : colors.yellow}${att.status}${colors.reset}`);
                console.log(`  Total Hours:     ${att.totalHours} hrs`);
                console.log(`  Late Minutes:    ${att.lateMinutes} mins`);
                console.log(`  Overtime Mins:   ${att.overtimeMinutes} mins`);
            });
        }
    }
}

main()
    .catch((err) => {
        console.error(`${colors.red}Execution failed:${colors.reset}`, err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
