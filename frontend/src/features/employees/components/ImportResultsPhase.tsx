import React from 'react';
import { Button } from '@/components/ui/button';
import { ImportResult } from '../hooks/useEmployeeImport';

interface ImportResultsPhaseProps {
  importResults: ImportResult[];
  failedResults: ImportResult[];
  succeededCount: number;
  failedCount: number;
  skippedInvalidCount: number;
  onDone: () => void;
}

export function ImportResultsPhase({
  importResults,
  failedResults,
  succeededCount,
  failedCount,
  skippedInvalidCount,
  onDone,
}: ImportResultsPhaseProps) {
  return (
    <div className="px-6 py-5 space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-slate-700">{importResults.length}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Attempted</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-green-600">{succeededCount}</p>
          <p className="text-[10px] font-bold text-green-500 uppercase tracking-wider">Succeeded</p>
        </div>
        <div className={`rounded-xl p-3 text-center ${failedCount > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
          <p className={`text-2xl font-black ${failedCount > 0 ? 'text-red-600' : 'text-slate-400'}`}>{failedCount}</p>
          <p className={`text-[10px] font-bold uppercase tracking-wider ${failedCount > 0 ? 'text-red-400' : 'text-slate-400'}`}>Failed</p>
        </div>
      </div>

      {skippedInvalidCount > 0 && (
        <p className="text-xs text-slate-400 text-center">
          {skippedInvalidCount} invalid row{skippedInvalidCount !== 1 ? 's were' : ' was'} skipped before sending.
        </p>
      )}

      {failedCount > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Failed Rows</p>
          <div className="max-h-[30vh] overflow-auto border border-red-200 rounded-xl">
            <table className="w-full text-xs">
              <thead className="bg-red-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-black text-red-400 uppercase">Row</th>
                  <th className="px-3 py-2 text-left text-[10px] font-black text-red-400 uppercase">Emp. No.</th>
                  <th className="px-3 py-2 text-left text-[10px] font-black text-red-400 uppercase">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100">
                {failedResults.map((r, idx) => (
                  <tr key={idx} className="bg-red-50/50">
                    <td className="px-3 py-2 text-slate-500 font-mono">{r.row}</td>
                    <td className="px-3 py-2 font-bold text-slate-700">{r.employeeNumber || '—'}</td>
                    <td className="px-3 py-2 text-red-600">{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-center justify-center pt-2 border-t border-slate-100">
        <Button
          className="px-10 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl"
          onClick={onDone}
        >
          Done
        </Button>
      </div>
    </div>
  );
}
