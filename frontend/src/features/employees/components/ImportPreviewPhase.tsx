import React from 'react';
import { RotateCcw, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ParsedImportRow } from '../hooks/useEmployeeImport';

interface ImportPreviewPhaseProps {
  importParsedRows: ParsedImportRow[];
  validCount: number;
  invalidCount: number;
  isImporting: boolean;
  onChangeFile: () => void;
  onSubmit: () => void;
}

export function ImportPreviewPhase({
  importParsedRows,
  validCount,
  invalidCount,
  isImporting,
  onChangeFile,
  onSubmit,
}: ImportPreviewPhaseProps) {
  return (
    <div className="p-6 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600 font-medium">
          <span className="text-green-600 font-bold">{validCount}</span> row{validCount !== 1 ? 's' : ''} ready
          {invalidCount > 0 && (
            <>, <span className="text-red-500 font-bold">{invalidCount}</span> row{invalidCount !== 1 ? 's' : ''} {invalidCount !== 1 ? 'have' : 'has'} errors</>
          )}.
        </p>
        <Button variant="ghost" size="sm" onClick={onChangeFile}>
          <RotateCcw className="w-4 h-4 mr-1" /> Change file
        </Button>
      </div>

      <div className="max-h-[50vh] overflow-y-auto mb-4 border border-slate-200 rounded-xl">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase">Row</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase">Emp. No.</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase">First Name</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase">Last Name</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase">Company</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase">Department</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase">Branch</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {importParsedRows.map((row, idx) => (
              <tr key={idx} className={row.status === 'invalid' ? 'bg-red-50' : 'hover:bg-slate-50'}>
                <td className="px-3 py-2 text-slate-400 font-mono">{row._rowNumber}</td>
                <td className="px-3 py-2 font-bold text-slate-700">{row.employeeNumber || '—'}</td>
                <td className="px-3 py-2 text-slate-600">{row.firstName || '—'}</td>
                <td className="px-3 py-2 text-slate-600">{row.lastName || '—'}</td>
                <td className="px-3 py-2 text-slate-600">{row.company || '—'}</td>
                <td className="px-3 py-2 text-slate-600">{row.department || '—'}</td>
                <td className="px-3 py-2 text-slate-600">{row.branch || '—'}</td>
                <td className="px-3 py-2">
                  {row.status === 'valid' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold">
                      <CheckCircle className="w-3 h-3" /> Ready
                    </span>
                  ) : (
                    <span className="inline-flex items-start gap-1 px-2 py-1 rounded-lg bg-red-100 text-red-700 text-[10px] font-bold" title={row.reason}>
                      <XCircle className="w-3 h-3 shrink-0 mt-0.5" /> <span className="break-words">{row.reason}</span>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button
        className="w-full bg-red-600 hover:bg-red-700 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={onSubmit}
        disabled={isImporting || validCount === 0 || invalidCount > 0}
      >
        {isImporting ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing...</>
        ) : invalidCount > 0 ? (
          `Fix ${invalidCount} error${invalidCount !== 1 ? 's' : ''} to upload`
        ) : (
          `Upload & Import ${validCount} Row${validCount !== 1 ? 's' : ''}`
        )}
      </Button>
    </div>
  );
}
