import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/useToast';

const MAX_IMPORT_ROWS = 200;

export interface ParsedImportRow {
  _rowNumber: number;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  suffix?: string;
  gender?: string;
  dateOfBirth?: string;
  email: string;
  contactNumber: string;
  company: string;
  department: string;
  branch: string;
  hireDate?: string;
  shiftCode?: string;
  shiftId: number | null;
  status: 'valid' | 'invalid';
  reason?: string;
}

export interface ImportResult {
  row: number;
  employeeNumber: string;
  status: 'success' | 'failed';
  reason?: string;
}

export type ImportStep = 'select' | 'preview' | 'results';

interface UseEmployeeImportOptions {
  departments: { id: number; name: string }[];
  branches: any[];
  companies: { id: number; name: string }[];
  shifts: any[];
  onImportComplete: () => void;
}

export function useEmployeeImport({
  departments,
  branches,
  companies,
  shifts,
  onImportComplete,
}: UseEmployeeImportOptions) {
  const { showToast } = useToast();

  const [importStep, setImportStep] = useState<ImportStep>('select');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importFileError, setImportFileError] = useState<string | null>(null);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [importParsedRows, setImportParsedRows] = useState<ParsedImportRow[]>([]);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // ─── Reset ────────────────────────────────────────────────────────────────

  const resetImport = useCallback(() => {
    setImportFile(null);
    setImportStep('select');
    setImportParsedRows([]);
    setImportResults([]);
    setImportFileError(null);
    setIsImporting(false);
  }, []);

  // ─── Template download ────────────────────────────────────────────────────

  const downloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    try {
      const res = await fetch('/api/employees/export-template');
      if (!res.ok) throw new Error('Template download failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'employee_import_template.xlsx';
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      showToast('error', 'Download Failed', 'Could not download template');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  // ─── CSV / XLSX parsing + client-side validation ──────────────────────────
  //
  // CLIENT-SIDE VALIDATION (runs before any API call):
  //   Required fields : employeeNumber, firstName, lastName, email,
  //                     contactNumber, department, branch, dateOfBirth, hireDate
  //   Format checks   : email regex, contactNumber must be exactly 11 digits,
  //                     dateOfBirth / hireDate must be parseable as a Date
  //   Reference checks: department must exist in `departments` prop,
  //                     branch must exist in `branches` prop,
  //                     shiftCode (if provided) must match a shift in `shifts` prop
  //   Duplicate checks: duplicate employeeNumber within the file,
  //                     duplicate email (case-insensitive) within the file

  const parseAndValidateFile = async (file: File) => {
    setImportFileError(null);
    try {
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: 'array', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) { setImportFileError('No worksheet found.'); return; }

      const jsonRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '', range: 1 });
      const dataRows = jsonRows.filter(r => {
        const v = String(r?.employeeNumber ?? r?.['Employee Number'] ?? '').trim().toLowerCase();
        return !v.startsWith('e.g') && !v.startsWith('color') && !v.startsWith('unique') && v !== 'required field' && v !== 'optional field';
      });

      if (dataRows.length === 0) { setImportFileError('No data rows.'); return; }
      if (dataRows.length > MAX_IMPORT_ROWS) { setImportFileError(`Max ${MAX_IMPORT_ROWS} rows.`); return; }

      const deptNames = departments.map(d => d.name);
      const branchNames = branches.map(b => b.name);
      const seenEmpNums = new Set<string>();
      const seenEmails = new Set<string>();

      const parsed: ParsedImportRow[] = dataRows.map((raw, idx) => {
        const n: Record<string, string> = {};
        for (const [k, v] of Object.entries(raw))
          n[k.replace(/[\s_]+/g, '').toLowerCase()] = v instanceof Date ? v.toISOString() : String(v ?? '').trim();

        const errors: string[] = [];
        const empNum = n['employeenumber'] || n['employeeid'] || n['empid'] || '';
        const firstName = n['firstname'] || '';
        const lastName = n['lastname'] || '';
        const middleName = n['middlename'];
        const suffix = n['suffix'];
        const gender = n['gender'];
        const dateOfBirth = n['dateofbirth'] || n['dob'] || n['birthday'];
        const email = n['email'] || n['emailaddress'] || '';
        // Fix 3: Extract contact from raw row to prevent Excel numeric formatting issues
        const contactRawKey = Object.keys(raw).find(k => ['contactnumber', 'phonenumber', 'phone', 'contact'].includes(k.replace(/[\s_]+/g, '').toLowerCase()));
        const contactRawVal = contactRawKey ? raw[contactRawKey] : '';
        const contactNumber = typeof contactRawVal === 'number' ? String(Math.round(contactRawVal)) : String(contactRawVal ?? '').replace(/\.0+$/, '');
        // Fix 3: Normalize phone — convert +63 format to 0-prefix for DB storage
        const normalizePhone = (raw: string): string => {
          const cleaned = String(raw).replace(/[\s\-().]/g, '').trim();
          if (cleaned.startsWith('+63') && cleaned.length === 13) return '0' + cleaned.slice(3);
          if (cleaned.startsWith('63') && cleaned.length === 12) return '0' + cleaned.slice(2);
          if (/^\d{10}$/.test(cleaned)) return '0' + cleaned;
          return cleaned;
        };
        const normalizedContact = normalizePhone(contactNumber);
        const company = n['company'] || '';
        const department = n['department'] || n['dept'] || '';
        const branch = n['branch'] || '';
        const hireDate = n['hiredate'] || n['datehired'];
        const shiftCode = n['shiftcode'] || n['shift'] || undefined;

        if (!empNum) errors.push('Missing emp#');
        if (!firstName) errors.push('Missing first name');
        if (!lastName) errors.push('Missing last name');
        if (!email) errors.push('Missing email');
        if (!normalizedContact) errors.push('Missing contact');
        if (!company) errors.push('Missing company');
        if (!department) errors.push('Missing department');
        if (!branch) errors.push('Missing branch');
        if (!shiftCode || !shiftCode.trim()) errors.push('Missing shift');
        if (!dateOfBirth) errors.push('Missing date of birth');
        if (!hireDate) errors.push('Missing hire date');

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Invalid email format');
        if (normalizedContact && !/^0\d{10}$/.test(normalizedContact)) errors.push('Contact must be 11 digits starting with 0 (e.g. 09171234567)');
        if (dateOfBirth && isNaN(Date.parse(dateOfBirth))) errors.push('Invalid date of birth');
        if (hireDate && isNaN(Date.parse(hireDate))) errors.push('Invalid hire date');

        if (department && !deptNames.some(d => d.toLowerCase() === department.toLowerCase())) errors.push(`Invalid dept: ${department}`);
        if (branch && !branchNames.some(b => b.toLowerCase() === branch.toLowerCase())) errors.push(`Invalid branch: ${branch}`);

        // Cross-validate: branch must belong to selected company
        if (company && branch) {
          const matchedBranch = branches.find((b: any) => b.name.toLowerCase() === branch.toLowerCase());
          if (matchedBranch) {
            const matchedCompany = companies.find(c => c.name.toLowerCase() === company.toLowerCase());
            if (matchedCompany) {
              const branchBelongsToCompany = matchedBranch.companies?.some(
                (cb: any) => cb.companyId === matchedCompany.id
              );
              if (!branchBelongsToCompany) {
                errors.push(`Branch '${branch}' does not belong to Company '${company}'`);
              }
            } else {
              errors.push(`Invalid company: ${company}`);
            }
          }
        }

        let resolvedShiftId: number | null = null;
        if (shiftCode) {
          const ms = shifts.find(s => s.shiftCode === shiftCode);
          if (!ms) errors.push(`Invalid shift: ${shiftCode}`); else resolvedShiftId = ms.id;
        }

        if (empNum) {
          if (seenEmpNums.has(empNum)) errors.push('Duplicate employee number in file');
          else seenEmpNums.add(empNum);
        }
        if (email) {
          const lowerEmail = email.toLowerCase();
          if (seenEmails.has(lowerEmail)) errors.push('Duplicate email in file');
          else seenEmails.add(lowerEmail);
        }

        return {
          _rowNumber: idx + 2,
          employeeNumber: empNum, firstName, lastName,
          middleName, suffix, gender, dateOfBirth,
          email, contactNumber: normalizedContact, company, department, branch,
          hireDate, shiftCode, shiftId: resolvedShiftId,
          status: errors.length === 0 ? 'valid' : 'invalid',
          reason: errors.length > 0 ? errors.join('; ') : undefined,
        };
      });

      setImportParsedRows(parsed);
      // ── Transition: select → preview (only on successful parse with ≥1 data row) ──
      setImportStep('preview');
    } catch {
      setImportFileError('Failed to parse file.');
    }
  };

  const handleFileSelect = (file: File) => {
    setImportFile(file);
    parseAndValidateFile(file);
  };

  // ─── Bulk import API call ─────────────────────────────────────────────────

  const submitImport = async () => {
    const validRows = importParsedRows.filter(r => r.status === 'valid');
    if (validRows.length === 0) return;
    setIsImporting(true);
    try {
      const payload = validRows.map(r => ({
        _rowNumber: r._rowNumber,
        employeeNumber: r.employeeNumber,
        firstName: r.firstName,
        lastName: r.lastName,
        middleName: r.middleName || undefined,
        suffix: r.suffix || undefined,
        gender: r.gender || undefined,
        dateOfBirth: r.dateOfBirth || undefined,
        email: r.email,
        contactNumber: r.contactNumber || undefined,
        company: r.company || undefined,
        department: r.department,
        branch: r.branch,
        hireDate: r.hireDate || undefined,
        shiftId: r.shiftId || undefined,
      }));
      const res = await fetch('/api/employees/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employees: payload }),
      });
      const data = await res.json();
      if (data.success && data.results) {
        setImportResults(data.results);
        // ── Transition: preview → results (only when API returns success + results) ──
        setImportStep('results');
        onImportComplete();
      } else {
        showToast('error', 'Import Failed', data.message || 'Server error.');
      }
    } catch {
      showToast('error', 'Import Failed', 'Could not reach the server.');
    } finally {
      setIsImporting(false);
    }
  };

  // ─── Derived counts ───────────────────────────────────────────────────────

  const validCount = importParsedRows.filter(r => r.status === 'valid').length;
  const invalidCount = importParsedRows.filter(r => r.status === 'invalid').length;
  const succeededCount = importResults.filter(r => r.status === 'success').length;
  const failedCount = importResults.filter(r => r.status === 'failed').length;
  const skippedInvalidCount = importParsedRows.filter(r => r.status === 'invalid').length;
  const failedResults = importResults.filter(r => r.status === 'failed');

  return {
    // phase
    importStep,
    // file
    importFile,
    importFileError,
    // parsed data
    importParsedRows,
    importResults,
    failedResults,
    // progress
    isImporting,
    isDownloadingTemplate,
    // derived counts
    validCount,
    invalidCount,
    succeededCount,
    failedCount,
    skippedInvalidCount,
    // actions
    handleFileSelect,
    downloadTemplate,
    submitImport,
    resetImport,
  };
}
