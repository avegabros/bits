import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Upload, X as XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEmployeeImport } from '../hooks/useEmployeeImport';
import { ImportSelectPhase } from './ImportSelectPhase';
import { ImportPreviewPhase } from './ImportPreviewPhase';
import { ImportResultsPhase } from './ImportResultsPhase';

interface EmployeeImportModalProps {
  departments: { id: number; name: string }[];
  branches: any[];
  companies: { id: number; name: string }[];
  shifts: any[];
  onImportComplete: () => void;
}

const STEP_SUBTITLE: Record<string, string> = {
  select: 'Upload from Excel or CSV',
  preview: 'Review before importing',
  results: 'Import results',
};

const STEP_MAX_WIDTH: Record<string, string> = {
  select: 'sm:max-w-md',
  preview: 'sm:max-w-5xl',
  results: 'sm:max-w-3xl',
};

export function EmployeeImportModal({ departments, branches, companies, shifts, onImportComplete }: EmployeeImportModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  const {
    importStep,
    importFile,
    importFileError,
    importParsedRows,
    importResults,
    failedResults,
    isImporting,
    isDownloadingTemplate,
    validCount,
    invalidCount,
    succeededCount,
    failedCount,
    skippedInvalidCount,
    handleFileSelect,
    downloadTemplate,
    submitImport,
    resetImport,
  } = useEmployeeImport({ departments, branches, companies, shifts, onImportComplete });

  const closeAndReset = () => {
    setIsOpen(false);
    resetImport();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetImport(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex-1 sm:flex-none border-border text-foreground hover:bg-red-700 hover:text-white gap-2 transition-all active:scale-95">
          <Upload className="w-4 h-4" /> Import
        </Button>
      </DialogTrigger>

      <DialogContent
        showCloseButton={false}
        className={`bg-white border-0 p-0 rounded-2xl overflow-hidden shadow-xl transition-all ${STEP_MAX_WIDTH[importStep]}`}
      >
        {/* Header */}
        <div className="bg-red-600 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <DialogTitle className="text-white font-bold text-lg">Import Employees</DialogTitle>
            <DialogDescription className="text-white/80 text-[10px] uppercase tracking-widest font-bold mt-1">
              {STEP_SUBTITLE[importStep]}
            </DialogDescription>
          </div>
          <button onClick={closeAndReset} className="text-white/80 hover:text-white transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Phase views */}
        {importStep === 'select' && (
          <ImportSelectPhase
            importFile={importFile}
            importFileError={importFileError}
            isDownloadingTemplate={isDownloadingTemplate}
            onFileSelect={handleFileSelect}
            onDownloadTemplate={downloadTemplate}
            onDiscard={closeAndReset}
          />
        )}

        {importStep === 'preview' && (
          <ImportPreviewPhase
            importParsedRows={importParsedRows}
            validCount={validCount}
            invalidCount={invalidCount}
            isImporting={isImporting}
            onChangeFile={resetImport}
            onSubmit={submitImport}
          />
        )}

        {importStep === 'results' && (
          <ImportResultsPhase
            importResults={importResults}
            failedResults={failedResults}
            succeededCount={succeededCount}
            failedCount={failedCount}
            skippedInvalidCount={skippedInvalidCount}
            onDone={() => { closeAndReset(); onImportComplete(); }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
