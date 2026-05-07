import React from 'react';
import { Upload, FileSpreadsheet, AlertCircle, Download, Loader2 } from 'lucide-react';

const MAX_IMPORT_ROWS = 200;

interface ImportSelectPhaseProps {
  importFile: File | null;
  importFileError: string | null;
  isDownloadingTemplate: boolean;
  onFileSelect: (file: File) => void;
  onDownloadTemplate: () => void;
  onDiscard: () => void;
}

export function ImportSelectPhase({
  importFile,
  importFileError,
  isDownloadingTemplate,
  onFileSelect,
  onDownloadTemplate,
  onDiscard,
}: ImportSelectPhaseProps) {
  return (
    <>
      <div className="px-6 py-5 space-y-4">
        <p className="text-sm text-slate-500 font-medium">
          Upload an Excel file (.xlsx, .xls) or CSV (.csv) to bulk import employee records.
        </p>
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-red-300 transition-colors">
          <Upload className="w-8 h-8 mx-auto text-slate-300 mb-2" />
          <label htmlFor="excel-upload" className="cursor-pointer">
            <span className="text-sm text-red-500 font-bold hover:underline">Click to select file</span>
            <input
              id="excel-upload"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFileSelect(file);
              }}
            />
          </label>
          <p className="text-xs text-slate-400 mt-1">Supports .xlsx, .xls, .csv · Max {MAX_IMPORT_ROWS} rows</p>
        </div>

        {importFile && !importFileError && (
          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl">
            <FileSpreadsheet className="w-4 h-4 text-red-500" />
            <span className="text-sm text-slate-700 font-medium flex-1 truncate">{importFile.name}</span>
            <span className="text-xs text-slate-400">{(importFile.size / 1024).toFixed(1)} KB</span>
          </div>
        )}

        {importFileError && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <span className="text-sm text-red-700 font-medium">{importFileError}</span>
          </div>
        )}

        <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
          <span className="text-xs text-slate-500 font-medium">Not sure about the format?</span>
          <button
            onClick={onDownloadTemplate}
            disabled={isDownloadingTemplate}
            className="flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 transition-colors disabled:opacity-50"
          >
            {isDownloadingTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Download template
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-6 px-6 py-4 border-t border-slate-100">
        <button
          className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
          onClick={onDiscard}
        >
          Discard
        </button>
      </div>
    </>
  );
}
