import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../../shared/lib/prisma';
import { Prisma } from '@prisma/client';
import { syncEmployeesToDevice, enrollEmployeeFingerprint, enrollEmployeeCard, deleteEmployeeCard, addUserToDevice, deleteUserFromDevice, findNextSafeZkId, acquireRegistrationMutex, deleteFingerprintGlobally, syncEmployeeFingerprints } from '../devices/zk';
import { enqueueGlobalUpsertUser, enqueueGlobalDeleteUser, processDeviceSyncQueue } from '../devices/deviceSyncQueue.service';
import { audit } from '../../shared/lib/auditLogger';
import bcrypt from 'bcryptjs';
import { generateRandomPassword, getBirthdatePassword } from '../../shared/utils/password.utils';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../../shared/lib/email.service';


// GET /api/employees/export - Export employees to .xlsx
export const exportEmployees = async (req: Request, res: Response) => {
    try {
        const { department, branch, company, shift, status, employmentStatus } = req.query;

        const where: Prisma.EmployeeWhereInput = {
            role: 'USER',
        };

        if (employmentStatus && employmentStatus !== 'all') {
            const empStatus = (employmentStatus as string).toUpperCase();
            if (empStatus === 'ACTIVE') {
                 where.employmentStatus = { in: ['ACTIVE', 'STAGED'] };
            } else {
                 where.employmentStatus = empStatus as import('@prisma/client').EmploymentStatus;
            }
        } else {
            where.employmentStatus = 'ACTIVE'; // fallback
        }

        if (status && status !== 'all') {
            // overriding the employmentStatus array if specific status is selected
            where.employmentStatus = status as import('@prisma/client').EmploymentStatus;
        }

        // Filter by relation name (look up ID first so we can filter by FK)
        if (company && company !== 'All Companies') {
            const comp = await prisma.company.findFirst({ where: { name: company as string }, select: { id: true } });
            if (comp) where.companyId = comp.id;
        }
        if (department && department !== 'all') {
            const dept = await prisma.department.findFirst({ where: { name: department as string }, select: { id: true } });
            if (dept) where.departmentId = dept.id;
        }
        if (branch && branch !== 'all') {
            const br = await prisma.branch.findFirst({ where: { name: branch as string }, select: { id: true } });
            if (br) where.branchId = br.id;
        }
        if (shift && shift !== 'all') {
            const sh = await prisma.shift.findFirst({ where: { name: shift as string }, select: { id: true } });
            if (sh) where.shiftId = sh.id;
        }

        const employees = await prisma.employee.findMany({
            where,
            select: {
                employeeNumber: true,
                firstName: true,
                middleName: true,
                lastName: true,
                suffix: true,
                gender: true,
                dateOfBirth: true,
                email: true,
                contactNumber: true,
                Company: { select: { name: true } },
                Department: { select: { name: true } },
                Section: { select: { name: true } },
                Branch: { select: { name: true } },
                hireDate: true,
                Shift: { select: { shiftCode: true } },
                EmployeeShift: { select: { shift: { select: { shiftCode: true } } }, orderBy: { sortOrder: 'asc' } },
                employmentStatus: true,
            },
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        });

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Employees');

        const columns = [
            { header: 'Employee Number', key: 'employeeNumber', width: 18 },
            { header: 'First Name', key: 'firstName', width: 16 },
            { header: 'Middle Name', key: 'middleName', width: 16 },
            { header: 'Last Name', key: 'lastName', width: 16 },
            { header: 'Suffix', key: 'suffix', width: 10 },
            { header: 'Gender', key: 'gender', width: 12 },
            { header: 'Date of Birth', key: 'dateOfBirth', width: 16 },
            { header: 'Email', key: 'email', width: 28 },
            { header: 'Contact Number', key: 'contactNumber', width: 18 },
            { header: 'Company', key: 'company', width: 20 },
            { header: 'Department', key: 'department', width: 18 },
            { header: 'Section', key: 'section', width: 18 },
            { header: 'Branch', key: 'branch', width: 16 },
            { header: 'Hire Date', key: 'hireDate', width: 16 },
            { header: 'Shift Code', key: 'shiftCode', width: 14 },
        ];
        sheet.columns = columns;

        // Style header row
        const headerRow = sheet.getRow(1);
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FF000000' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
            cell.border = {
                bottom: { style: 'thin', color: { argb: 'FF999999' } },
            };
        });
        headerRow.commit();

        // Add data rows
        for (const emp of employees) {
            sheet.addRow({
                employeeNumber: emp.employeeNumber || '',
                firstName: emp.firstName || '',
                middleName: emp.middleName || '',
                lastName: emp.lastName || '',
                suffix: emp.suffix || '',
                gender: emp.gender || '',
                dateOfBirth: emp.dateOfBirth ? new Date(emp.dateOfBirth).toISOString().split('T')[0] : '',
                email: emp.email || '',
                contactNumber: emp.contactNumber || '',
                company: emp.Company?.name || '',
                department: emp.Department?.name || '',
                section: emp.Section?.name || '',
                branch: emp.Branch?.name || '',
                hireDate: emp.hireDate ? new Date(emp.hireDate).toISOString().split('T')[0] : '',
                shiftCode: emp.EmployeeShift?.length ? emp.EmployeeShift.map(es => es.shift.shiftCode).join(',') : (emp.Shift?.shiftCode || ''),
            });
        }

        const today = new Date().toISOString().split('T')[0];
        const filename = `employees_export_${today}.xlsx`;

        const buffer = await workbook.xlsx.writeBuffer();

        void audit({
            action: 'EXPORT',
            entityType: 'Employee',
            performedBy: req.user?.employeeId,
            details: `Exported ${employees.length} employee(s) to Excel`,
            metadata: {
                count: employees.length,
                filters: { company: company || 'all', department: department || 'all', branch: branch || 'all', shift: shift || 'all', status: status || 'all' },
                filename,
            },
            correlationId: req.correlationId
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(Buffer.from(buffer as ArrayBuffer));
    } catch (error: unknown) {
        console.error('Error exporting employees:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export employees',
            error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined,
        });
    }
};
// GET /api/employees/export-template - Download blank import template
export const exportTemplate = async (req: Request, res: Response) => {
    try {
        const workbook = new ExcelJS.Workbook();

        // ── Fetch reference data first (needed for dropdown ranges) ───────────
        const [departments, branches, shifts, companies] = await Promise.all([
            prisma.department.findMany({ select: { name: true }, orderBy: { name: 'asc' } }),
            prisma.branch.findMany({ select: { name: true }, orderBy: { name: 'asc' } }),
            prisma.shift.findMany({ select: { shiftCode: true, name: true }, orderBy: { shiftCode: 'asc' } }),
            prisma.company.findMany({
                select: { name: true, branches: { include: { branch: true } } },
                orderBy: { name: 'asc' },
            }),
        ]);

        // ── Helper: sanitize company name to a valid Excel named range identifier ──
        // Replaces every non-alphanumeric character with '_', prefixed with 'C_', suffixed with '_BRANCHES'
        const sanitizeForNamedRange = (name: string): string => {
            return 'C_' + name.replace(/[^A-Za-z0-9]/g, '_') + '_BRANCHES';
        };

        // ── Sheet 1: Employee Import ──────────────────────────────────────────
        const sheet1 = workbook.addWorksheet('Employee Import');

        const templateColumns = [
            { header: 'Employee Number', key: 'employeeNumber', width: 20, required: true, hint: 'Unique ID (e.g. 10001)' },
            { header: 'First Name', key: 'firstName', width: 18, required: true, hint: 'Legal first name' },
            { header: 'Middle Name', key: 'middleName', width: 18, required: false, hint: 'Optional middle name' },
            { header: 'Last Name', key: 'lastName', width: 18, required: true, hint: 'Legal last name' },
            { header: 'Suffix', key: 'suffix', width: 12, required: false, hint: 'Jr., Sr., II, III, etc.' },
            { header: 'Gender', key: 'gender', width: 14, required: false, hint: 'Male / Female / Prefer not to say' },
            { header: 'Date of Birth', key: 'dateOfBirth', width: 18, required: true, hint: 'MM-DD-YYYY format (required)' },
            { header: 'Email', key: 'email', width: 28, required: false, hint: 'Optional valid email (if provided, login credentials sent here)' },
            { header: 'Contact Number', key: 'contactNumber', width: 20, required: true, hint: 'Enter in +63 format (e.g. +639171234567) — saved as 09XXXXXXXXX' },
            { header: 'Company', key: 'company', width: 24, required: true, hint: 'Select from dropdown (see Reference Lists)' },
            { header: 'Branch', key: 'branch', width: 18, required: true, hint: 'Select from dropdown (filtered by Company)' },
            { header: 'Department', key: 'department', width: 20, required: true, hint: 'Select from dropdown (see Reference Lists)' },
            { header: 'Section', key: 'section', width: 20, required: false, hint: 'Optional. Section name if applicable' },
            { header: 'Hire Date', key: 'hireDate', width: 16, required: true, hint: 'MM-DD-YYYY format (required)' },
            { header: 'Shift Code', key: 'shiftCode', width: 16, required: false, hint: 'Optional. Select from dropdown (see Reference Lists)' },
        ];

        // Column key → 1-based column index map
        const colIndex: Record<string, number> = {};
        templateColumns.forEach((col, idx) => { colIndex[col.key] = idx + 1; });

        sheet1.columns = templateColumns.map(c => ({ header: c.header, key: c.key, width: c.width }));

        // ── Row 1: Color legend ───────────────────────────────────────────────
        const legendRow = sheet1.getRow(1);
        // Clear auto-set headers from .columns assignment (they go to row 1)
        for (let c = 1; c <= templateColumns.length; c++) {
            legendRow.getCell(c).value = null;
        }
        const legendA = legendRow.getCell(1);
        legendA.value = 'Color guide:';
        legendA.font = { bold: true, size: 10 };

        const legendB = legendRow.getCell(2);
        legendB.value = 'Required field';
        legendB.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        legendB.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };

        const legendC = legendRow.getCell(3);
        legendC.value = 'Optional field';
        legendC.font = { bold: true, color: { argb: 'FF000000' } };
        legendC.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
        legendRow.commit();

        // ── Row 2: Header row ─────────────────────────────────────────────────
        const headerRow = sheet1.getRow(2);
        templateColumns.forEach((col, idx) => {
            const cell = headerRow.getCell(idx + 1);
            cell.value = col.header;
            if (col.required) {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };
            } else {
                cell.font = { bold: true, color: { argb: 'FF000000' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
            }
            cell.border = { bottom: { style: 'thin', color: { argb: 'FF999999' } } };
        });
        headerRow.commit();

        // ── Row 3: Hint row ───────────────────────────────────────────────────
        const hintRow = sheet1.getRow(3);
        templateColumns.forEach((col, idx) => {
            const cell = hintRow.getCell(idx + 1);
            cell.value = col.hint;
            cell.font = { italic: true, size: 9, color: { argb: 'FF666666' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F8F8' } };
        });
        hintRow.commit();

        // ── Rows 4–203: 200 blank alternating rows ───────────────────────────
        const DATA_START_ROW = 4;
        const DATA_ROW_COUNT = 200;
        for (let i = 0; i < DATA_ROW_COUNT; i++) {
            const row = sheet1.getRow(DATA_START_ROW + i);
            if (i % 2 === 1) {
                for (let c = 1; c <= templateColumns.length; c++) {
                    const cell = row.getCell(c);
                    if (!cell.value) cell.value = null;
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                }
            }
            row.commit();
        }

        // ── Dropdown validations (rows 4–203) ────────────────────────────────
        const DATA_END_ROW = DATA_START_ROW + DATA_ROW_COUNT - 1; // 203
        const validationBase = {
            showDropDown: false, // false = show the arrow in Excel (counterintuitive)
            showErrorMessage: true,
            errorTitle: 'Invalid value',
            error: 'Please select a value from the dropdown list',
        };

        // Helper: convert 1-based column index to Excel letter
        const colLetter = (n: number): string => {
            let result = '';
            while (n > 0) {
                n--;
                result = String.fromCharCode(65 + (n % 26)) + result;
                n = Math.floor(n / 26);
            }
            return result;
        };

        // Department dropdown — references 'Reference Lists' sheet column A
        // Sheet 2 row 1 = header, row 2 = first header label, data starts row 3
        if (departments.length > 0) {
            const deptLastRow = 2 + departments.length; // header row is 2 now (after our changes to sheet 2)
            const deptCol = colLetter(colIndex['department']);
            for (let r = DATA_START_ROW; r <= DATA_END_ROW; r++) {
                sheet1.getCell(`${deptCol}${r}`).dataValidation = {
                    type: 'list',
                    formulae: [`='Reference Lists'!$A$3:$A$${deptLastRow}`],
                    ...validationBase,
                };
            }
        }

        // Company dropdown — references 'Reference Lists' sheet column E
        if (companies.length > 0) {
            const companyLastRow = 2 + companies.length;
            const companyCol = colLetter(colIndex['company']);
            for (let r = DATA_START_ROW; r <= DATA_END_ROW; r++) {
                sheet1.getCell(`${companyCol}${r}`).dataValidation = {
                    type: 'list',
                    formulae: [`='Reference Lists'!$E$3:$E$${companyLastRow}`],
                    ...validationBase,
                };
            }
        }

        // Branch dropdown — cascading from Company via INDIRECT + named ranges
        // The SUBSTITUTE chain mirrors the server-side sanitizeForNamedRange function:
        //   - spaces → _, dots → _, commas → _, apostrophes → _, other special chars handled by the sanitization
        {
            const branchCol = colLetter(colIndex['branch']);
            const companyCol = colLetter(colIndex['company']);
            for (let r = DATA_START_ROW; r <= DATA_END_ROW; r++) {
                sheet1.getCell(`${branchCol}${r}`).dataValidation = {
                    type: 'list',
                    formulae: [
                        `=INDIRECT("C_"&SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(${companyCol}${r}," ","_"),".","_"),",","_"),"'","_"),"-","_"),"&","_")&"_BRANCHES")`
                    ],
                    showErrorMessage: true,
                    errorTitle: 'Invalid branch',
                    error: 'Please select a Company first, then choose a Branch from the dropdown',
                };
            }
        }

        // Shift Code dropdown — references 'Reference Lists' sheet column C
        if (shifts.length > 0) {
            const shiftLastRow = 2 + shifts.length;
            const shiftCol = colLetter(colIndex['shiftCode']);
            for (let r = DATA_START_ROW; r <= DATA_END_ROW; r++) {
                sheet1.getCell(`${shiftCol}${r}`).dataValidation = {
                    type: 'list',
                    formulae: [`='Reference Lists'!$C$3:$C$${shiftLastRow}`],
                    ...validationBase,
                };
            }
        }

        // Gender dropdown — inline list
        const genderCol = colLetter(colIndex['gender']);
        for (let r = DATA_START_ROW; r <= DATA_END_ROW; r++) {
            sheet1.getCell(`${genderCol}${r}`).dataValidation = {
                type: 'list',
                formulae: ['"Male,Female,Prefer not to say"'],
                ...validationBase,
            };
        }

        // Suffix dropdown — inline list
        const suffixCol = colLetter(colIndex['suffix']);
        for (let r = DATA_START_ROW; r <= DATA_END_ROW; r++) {
            sheet1.getCell(`${suffixCol}${r}`).dataValidation = {
                type: 'list',
                formulae: ['"Jr.,Sr.,II,III,IV,V"'],
                ...validationBase,
            };
        }

        // ── Sheet 2: Reference Lists ──────────────────────────────────────────
        const sheet2 = workbook.addWorksheet('Reference Lists');

        sheet2.columns = [
            { key: 'department', width: 30 },
            { key: 'branch', width: 30 },
            { key: 'shiftCode', width: 24 },
            { key: 'shiftName', width: 28 },
            { key: 'company', width: 30 },
        ];

        // Row 1: Section title
        const refTitleRow = sheet2.getRow(1);
        refTitleRow.getCell(1).value = 'REFERENCE DATA — DO NOT MODIFY THIS SHEET';
        refTitleRow.getCell(1).font = { bold: true, size: 11, color: { argb: 'FFDC2626' } };
        refTitleRow.commit();

        // Row 2: Column headers with descriptive names
        const refHeaderRow = sheet2.getRow(2);
        const refHeaders = ['Departments (copy exactly)', 'Branches (copy exactly)', 'Shift Codes (copy exactly)', 'Shift Name (for reference)', 'Companies (copy exactly)'];
        refHeaders.forEach((h, idx) => {
            const cell = refHeaderRow.getCell(idx + 1);
            cell.value = h;
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
            cell.border = { bottom: { style: 'thin', color: { argb: 'FF999999' } } };
        });
        refHeaderRow.commit();

        // Row 3+: Fill data
        const maxRefRows = Math.max(departments.length, branches.length, shifts.length, companies.length);
        for (let i = 0; i < maxRefRows; i++) {
            const row = sheet2.getRow(i + 3);
            row.getCell(1).value = departments[i]?.name || '';
            row.getCell(2).value = branches[i]?.name || '';
            row.getCell(3).value = shifts[i]?.shiftCode || '';
            row.getCell(4).value = shifts[i]?.name || '';
            row.getCell(5).value = companies[i]?.name || '';
            row.commit();
        }

        // ── Hidden Sheet: _Lookups (per-company branch lists + named ranges) ──
        const lookupsSheet = workbook.addWorksheet('_Lookups');
        lookupsSheet.state = 'hidden';

        companies.forEach((company, colIdx) => {
            const col = colIdx + 1;
            // Row 1: Company name as header
            lookupsSheet.getCell(1, col).value = company.name;
            lookupsSheet.getCell(1, col).font = { bold: true, size: 9 };

            // Rows 2+: Branch names belonging to this company
            const companyBranches = company.branches.map(cb => cb.branch.name).sort();
            companyBranches.forEach((branchName, rowIdx) => {
                lookupsSheet.getCell(rowIdx + 2, col).value = branchName;
            });

            // Define named range for this company's branch list
            const rangeName = sanitizeForNamedRange(company.name);
            const colLetterStr = colLetter(col);
            if (companyBranches.length > 0) {
                const lastRow = 1 + companyBranches.length;
                // ExcelJS definedNames: add a named range pointing to the branch cells
                workbook.definedNames.add(
                    `'_Lookups'!$${colLetterStr}$2:$${colLetterStr}$${lastRow}`,
                    rangeName
                );
            } else {
                // Even if no branches, define a range pointing to an empty cell to avoid #REF errors
                workbook.definedNames.add(
                    `'_Lookups'!$${colLetterStr}$2:$${colLetterStr}$2`,
                    rangeName
                );
            }
        });

        // ── Sheet 3: Instructions ─────────────────────────────────────────────
        const sheet3 = workbook.addWorksheet('Instructions');
        sheet3.getColumn(1).width = 80;

        const instructions = [
            'EMPLOYEE IMPORT INSTRUCTIONS',
            '',
            '⚠️  ALWAYS DOWNLOAD A FRESH TEMPLATE BEFORE EACH IMPORT',
            'This template is generated live from the database. The dropdown lists for',
            'Company, Department, Branch, and Shift Code reflect what is currently in the system.',
            '',
            'If new companies, departments, branches, or shifts have been added since you last',
            'downloaded this template, your old copy will NOT include them in the dropdowns.',
            '',
            'Rule: Never reuse an old template. Always click "Download Template"',
            'in the system before starting a new import.',
            '',
            'COLUMN COLOR GUIDE',
            'Red header   = Required field. The import will fail for this row if left empty.',
            'Orange header = Optional field. Can be left blank.',
            '',
            '1. REQUIRED FIELDS (red headers on Sheet 1):',
            '   • Employee Number — Must be unique across all employees',
            '   • First Name — Legal first name of the employee',
            '   • Last Name — Legal last name of the employee',
            '   • Date of Birth — Legal date of birth',
            '   • Contact Number — Philippine mobile number (e.g. +639171234567 or 09171234567 — auto-converted)',
            '   • Company — Select from the dropdown (must be selected BEFORE Branch)',
            '   • Branch — Filtered by Company. Select Company first, then Branch.',
            '   • Department — Select from the dropdown (values from Reference Lists)',
            '   • Hire Date — Date the employee was hired',
            '',
            '2. OPTIONAL FIELDS (orange headers on Sheet 1):',
            '   • Middle Name — Legal middle name',
            '   • Suffix — Suffix (Jr., Sr., etc.)',
            '   • Gender — Male, Female, or Prefer not to say',
            '   • Email — Optional. If provided, login credentials will be sent here.',
            '   • Shift Code — Optional. Select from dropdown (values from Reference Lists)',
            '',
            '3. COMPANY → BRANCH (CASCADING DROPDOWN):',
            '   • The Company column must be filled BEFORE selecting a Branch',
            '   • Branch choices are automatically filtered based on the selected Company',
            '   • If the Branch dropdown appears empty, re-select the Company value first',
            '   • Each Company only shows branches that are assigned to it in the system',
            '',
            '4. DATE FORMAT:',
            '   • Use YYYY-MM-DD format (e.g. 2025-01-15)',
            '   • Both Date of Birth and Hire Date follow this format',
            '',
            '5. PHONE NUMBER FORMAT:',
            '   • Accepted: +639171234567, 09171234567, 639171234567, or 9171234567',
            '   • Numbers starting with 0 or without +63 are auto-converted to +63 format',
            '   • Spaces and dashes are stripped automatically',
            '',
            '6. GENDER OPTIONS:',
            '   • Male',
            '   • Female',
            '   • Prefer not to say',
            '',
            '7. SUFFIX OPTIONS:',
            '   • Jr., Sr., II, III, IV, V (or leave blank)',
            '',
            '8. DROPDOWNS:',
            '   • Company, Department, Branch, Shift Code, Gender, and Suffix columns have dropdown lists',
            '   • Click a cell in those columns to see the arrow and select a value',
            '   • Typing an invalid value will show an error — use the dropdown instead',
            '   • Branch dropdown is dependent on Company — always fill Company first',
            '',
            '9. WHAT HAPPENS AFTER IMPORT:',
            '   • Each employee will be created with STAGED status and USER role',
            '   • If an email is provided, a random password will be generated and emailed to them',
            '   • If no email is provided, a default password based on Date of Birth (MMDDYY) will be set',
            '   • Employees will be prompted to change their password on first login',
            '   • The employee will be synced to biometric devices automatically when activated',
            '',
            '10. TIPS:',
            '   • The hint row (row 3) will be automatically skipped during import',
            '   • Duplicate employee numbers or provided emails will be rejected',
            '   • Row 1 is a color legend — leave it as-is, the system ignores it',
        ];

        // Title row — bold red
        const titleCell = sheet3.getCell('A1');
        titleCell.value = instructions[0];
        titleCell.font = { bold: true, size: 14, color: { argb: 'FFDC2626' } };

        // Freshness warning section (rows 3–11) — highlight with background
        for (let i = 1; i < instructions.length; i++) {
            const cell = sheet3.getCell(`A${i + 1}`);
            cell.value = instructions[i];

            if (instructions[i].startsWith('⚠️') || instructions[i] === 'COLUMN COLOR GUIDE') {
                cell.font = { bold: true, size: 12, color: { argb: 'FFDC2626' } };
            } else if (instructions[i].match(/^\d+\./)) {
                cell.font = { bold: true, size: 11 };
            } else if (instructions[i].startsWith('Rule:')) {
                cell.font = { bold: true, size: 10, color: { argb: 'FFDC2626' } };
            } else if (instructions[i].startsWith('Red header')) {
                cell.font = { bold: true, size: 10, color: { argb: 'FFDC2626' } };
            } else if (instructions[i].startsWith('Orange header')) {
                cell.font = { bold: true, size: 10, color: { argb: 'FFB45309' } };
            } else {
                cell.font = { size: 10 };
            }
        }

        const filename = 'employee_import_template.xlsx';
        const buffer = await workbook.xlsx.writeBuffer();

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(Buffer.from(buffer as ArrayBuffer));
    } catch (error: unknown) {
        console.error('Error generating import template:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate import template',
            error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined,
        });
    }
};
// ── Phone number normalization: +63 → 0-prefix ──────────────────────────
function normalizePhoneNumber(phone: string | null | undefined): string | null {
    if (!phone) return null;
    const cleaned = phone.toString().replace(/[\s\-().]/g, '').trim();
    if (cleaned.startsWith('+63')) {
        return '0' + cleaned.slice(3);
    }
    if (cleaned.startsWith('63') && cleaned.length === 12) {
        return '0' + cleaned.slice(2);
    }
    // Already 0-prefix or other format — pass through
    return cleaned;
}

// POST /api/employees/bulk-validate
export const bulkValidateEmployees = async (req: Request, res: Response) => {
    try {
        const { employees } = req.body;
        if (!Array.isArray(employees)) return res.status(400).json({ success: false });

        const errors: { row: number; reason: string }[] = [];
        
        const empNumsToVerify = employees.map(e => e.employeeNumber ? String(e.employeeNumber).trim() : '').filter(Boolean);
        const emailsToVerify = employees.map(e => e.email ? String(e.email).trim().toLowerCase() : '').filter(Boolean);

        const [existingEmpNums, existingEmails] = await Promise.all([
            prisma.employee.findMany({ where: { employeeNumber: { in: empNumsToVerify } }, select: { employeeNumber: true } }),
            prisma.employee.findMany({ where: { email: { in: emailsToVerify } }, select: { email: true } })
        ]);

        const existingEmpNumSet = new Set(existingEmpNums.map(e => e.employeeNumber));
        const existingEmailSet = new Set(existingEmails.map(e => (e.email || '').toLowerCase()));

        for (let i = 0; i < employees.length; i++) {
            const emp = employees[i];
            const rowNum = emp._rowNumber ?? (i + 1);
            const empNum = emp.employeeNumber ? String(emp.employeeNumber).trim() : '';
            const email = emp.email ? String(emp.email).trim().toLowerCase() : '';

            if (empNum && existingEmpNumSet.has(empNum)) {
                errors.push({ row: rowNum, reason: `Employee number '${empNum}' already exists in database` });
            }
            if (email && existingEmailSet.has(email)) {
                errors.push({ row: rowNum, reason: `Email '${email}' already exists in database` });
            }
        }

        return res.status(200).json({ success: true, errors });
    } catch (err) {
        console.error('[BULK_VALIDATE]', err);
        return res.status(500).json({ success: false, message: 'Validation server error' });
    }
};

// POST /api/employees/bulk - Bulk create employees from import
export const bulkCreateEmployees = async (req: Request, res: Response) => {
    try {
        const { employees } = req.body;

        if (!Array.isArray(employees) || employees.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Request body must contain a non-empty "employees" array',
            });
        }

        if (employees.length > 200) {
            return res.status(400).json({
                success: false,
                message: 'Maximum 200 employees per bulk import',
            });
        }

        const errors: { row: number; employeeNumber: string; status: 'failed'; reason: string }[] = [];
        
        // ── Pre-fetch for Duplicate Validation ────────────────────────────────
        const empNumsToVerify = employees.map(e => String(e.employeeNumber || '').trim()).filter(Boolean);
        const emailsToVerify = employees.map(e => String(e.email || '').trim().toLowerCase()).filter(Boolean);

        const [existingEmpNums, existingEmails] = await Promise.all([
            prisma.employee.findMany({ where: { employeeNumber: { in: empNumsToVerify } }, select: { employeeNumber: true } }),
            prisma.employee.findMany({ where: { email: { in: emailsToVerify } }, select: { email: true } })
        ]);

        const existingEmpNumSet = new Set(existingEmpNums.map(e => e.employeeNumber));
        const existingEmailSet = new Set(existingEmails.map(e => (e.email || '').toLowerCase()));
        
        const inFileDataEmpNumSet = new Set<string>();
        const inFileDataEmailSet = new Set<string>();

        // ── PASS 1: Validation ────────────────────────────────────────────────
        for (let i = 0; i < employees.length; i++) {
            const emp = employees[i];
            const rowNum = emp._rowNumber ?? (i + 1);
            const empNum = (emp.employeeNumber || '').toString().trim();

            if (!empNum || empNum.length < 2) {
                errors.push({ row: rowNum, employeeNumber: empNum, status: 'failed', reason: 'Employee ID must be at least 2 characters long.' });
            }
            if (!emp.firstName || !emp.lastName) {
                errors.push({ row: rowNum, employeeNumber: empNum, status: 'failed', reason: 'First name and last name are required' });
            }
            if (emp.email && emp.email.toString().trim() !== '') {
                const trimmedEmail = emp.email.toString().trim();
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
                    errors.push({ row: rowNum, employeeNumber: empNum, status: 'failed', reason: 'Email format is invalid' });
                }
            }
            if (!emp.dateOfBirth || emp.dateOfBirth.toString().trim() === '' || isNaN(Date.parse(emp.dateOfBirth.toString()))) {
                errors.push({ row: rowNum, employeeNumber: empNum, status: 'failed', reason: 'A valid Date of Birth is required' });
            }
            if (!emp.hireDate || emp.hireDate.toString().trim() === '' || isNaN(Date.parse(emp.hireDate.toString()))) {
                errors.push({ row: rowNum, employeeNumber: empNum, status: 'failed', reason: 'A valid Hire Date is required' });
            }

            // Intra-file duplicates
            if (empNum) {
                if (inFileDataEmpNumSet.has(empNum)) {
                    errors.push({ row: rowNum, employeeNumber: empNum, status: 'failed', reason: 'Duplicate employee number in file' });
                }
                inFileDataEmpNumSet.add(empNum);
            }
            const emailKey = (emp.email || '').toString().trim().toLowerCase();
            if (emailKey) {
                if (inFileDataEmailSet.has(emailKey)) {
                    errors.push({ row: rowNum, employeeNumber: empNum, status: 'failed', reason: 'Duplicate email in file' });
                }
                inFileDataEmailSet.add(emailKey);
            }

            // DB duplicates
            if (empNum && existingEmpNumSet.has(empNum)) {
                errors.push({ row: rowNum, employeeNumber: empNum, status: 'failed', reason: 'Employee number already in use' });
            }
            if (emailKey && existingEmailSet.has(emailKey)) {
                errors.push({ row: rowNum, employeeNumber: empNum, status: 'failed', reason: 'Email already in use' });
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed. No employees were imported. Please fix the errors and try again.',
                errors
            });
        }

        const results: { row: number; employeeNumber: string; status: 'success' | 'failed'; reason?: string }[] = [];

        // ── PASS 2: Insertion ──────────────────────────────────────────────────
        for (let i = 0; i < employees.length; i++) {
            const emp = employees[i];
            const rowNum = emp._rowNumber ?? (i + 1);
            const empNum = (emp.employeeNumber || '').toString().trim();

            try {
                let resolvedCompanyId: number | null = null;
                if (emp.company) {
                    const matchedCompany = await prisma.company.findFirst({
                        where: { name: { equals: emp.company, mode: 'insensitive' } },
                        select: { id: true },
                    });
                    if (matchedCompany) {
                        resolvedCompanyId = matchedCompany.id;
                    }
                }

                // ── Acquire mutex, assign zkId, create employee ──────────────
                const normalizedEmail = emp.email && String(emp.email).trim() !== ''
                    ? String(emp.email).trim().toLowerCase()
                    : null;
                const generatedPassword = normalizedEmail ? generateRandomPassword(10) : getBirthdatePassword(emp.dateOfBirth);
                const hashedPassword = await bcrypt.hash(generatedPassword, 10);

                // No longer acquiring registration mutex for zkId during import
                let newEmployee;

                try {
                    newEmployee = await prisma.employee.create({
                        data: {
                            employeeNumber: empNum,
                            firstName: emp.firstName,
                            lastName: emp.lastName,
                            middleName: emp.middleName || null,
                            suffix: emp.suffix || null,
                            gender: emp.gender || null,
                            dateOfBirth: new Date(emp.dateOfBirth),
                            email: normalizedEmail,
                            password: hashedPassword,
                            role: 'USER',
                            departmentId: emp.department
                                ? (await prisma.department.findFirst({
                                    where: { name: { equals: emp.department, mode: 'insensitive' } },
                                    select: { id: true }
                                }))?.id ?? null
                                : null,
                            sectionId: emp.section && emp.department
                                ? (await prisma.section.findFirst({
                                    where: {
                                        name: { equals: emp.section, mode: 'insensitive' },
                                        departments: {
                                            some: {
                                                department: {
                                                    name: { equals: emp.department, mode: 'insensitive' }
                                                }
                                            }
                                        }
                                    },
                                    select: { id: true }
                                }))?.id ?? null
                                : null,
                            position: null,
                            branchId: emp.branch
                                ? (await prisma.branch.findFirst({
                                    where: { name: { equals: emp.branch, mode: 'insensitive' } },
                                    select: { id: true }
                                }))?.id ?? null
                                : null,
                            companyId: resolvedCompanyId,
                            contactNumber: normalizePhoneNumber(emp.contactNumber),
                            hireDate: new Date(emp.hireDate),
                            employmentStatus: 'STAGED',
                            zkId: null, // zkId assigned upon biometric enrollment
                            shiftId: emp.shiftId ? parseInt(emp.shiftId, 10) : null,
                            ...(emp.shiftId ? {
                                                            } : {}),
                            ...(emp.shiftId ? {
                                EmployeeShift: {
                                    create: { shiftId: parseInt(emp.shiftId, 10), sortOrder: 0, isPrimary: true }
                                }
                            } : {}),
                            needsPasswordChange: true,
                            updatedAt: new Date(),
                        },
                        select: {
                            id: true,
                            zkId: true,
                            employeeNumber: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            role: true,
                        },
                    });
                } catch (dbErr) {
                    console.error('[BULK] Database creation error:', dbErr);
                }

                if (!newEmployee) {
                    results.push({ row: rowNum, employeeNumber: empNum, status: 'failed', reason: 'Unexpected state after registration' });
                    continue;
                }

                results.push({ row: rowNum, employeeNumber: empNum, status: 'success' });

                console.log(`[BULK] Created employee: ${newEmployee.firstName} ${newEmployee.lastName} (Staged)`);

                void audit({
                    action: 'CREATE',
                    entityType: 'Employee',
                    entityId: newEmployee.id,
                    performedBy: req.user?.employeeId,
                    details: `Bulk import: created employee ${newEmployee.firstName} ${newEmployee.lastName} (Staged)`,
                    metadata: { email: normalizedEmail, employeeNumber: empNum, source: 'bulk_import' },
                    correlationId: req.correlationId
                });

                // NOTE: Immediate email + device sync bypassed for STAGED employees.
                // It will be triggered upon biometric activation.

            } catch (rowError: unknown) {
                console.error(`[BULK] Error processing row ${rowNum}:`, rowError instanceof Error ? rowError.message : String(rowError));
                results.push({ row: rowNum, employeeNumber: empNum, status: 'failed', reason: rowError instanceof Error ? rowError.message : 'Unexpected server error' });
            }
        }

        const succeeded = results.filter(r => r.status === 'success').length;
        const failed = results.filter(r => r.status === 'failed').length;

        void audit({
            action: 'CREATE',
            entityType: 'Employee',
            performedBy: req.user?.employeeId,
            details: `Bulk import completed: ${succeeded} succeeded, ${failed} failed out of ${employees.length} rows`,
            metadata: { source: 'bulk_import', succeeded, failed, total: employees.length },
            correlationId: req.correlationId
        });

        res.status(200).json({
            success: true,
            results,
        });

    } catch (error: unknown) {
        console.error('[BULK] Bulk import error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process bulk import',
            error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : 'Internal server error',
        });
    }
};




