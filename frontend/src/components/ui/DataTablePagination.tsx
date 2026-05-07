'use client'

import React, { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

interface DataTablePaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  totalCount: number
  pageSize: number
  entityName?: string
  loading?: boolean
  className?: string
}

export function DataTablePagination({
  currentPage,
  totalPages,
  onPageChange,
  totalCount,
  pageSize,
  entityName = 'records',
  loading = false,
  className = ''
}: DataTablePaginationProps) {

  const [inputValue, setInputValue] = useState(String(currentPage))

  useEffect(() => {
    setInputValue(String(currentPage))
  }, [currentPage])

  const startRange = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endRange = Math.min(currentPage * pageSize, totalCount)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Current value tracking is handled via defaultValue and onKeyDown/onBlur
  }

  const navigateToPage = (val: number) => {
    if (!isNaN(val) && val >= 1 && val <= (totalPages || 1)) {
      onPageChange(val)
    }
  }

  return (
    <div className={`px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4 flex-wrap ${className}`}>
      {/* Selection Info */}
      <span className="text-xs text-slate-400 font-bold">
        <span className="hidden sm:inline">Showing </span>
        <span className="font-bold text-slate-700">{startRange}–{endRange}</span>
        {' '}of <span className="font-bold text-slate-700">{totalCount}</span> {entityName}
      </span>

      <div className="flex items-center gap-2">
        {/* Go-to-page input */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block">Go to</span>
          <input
            type="number"
            min={1}
            max={totalPages || 1}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={loading || totalPages <= 1}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const val = parseInt((e.target as HTMLInputElement).value)
                navigateToPage(val)
              }
            }}
            onBlur={(e) => {
              const val = parseInt(e.target.value)
              navigateToPage(val)
            }}
            className="w-12 px-1.5 py-1 text-xs font-bold text-slate-700 text-center border border-slate-200 bg-white rounded-lg focus:outline-none focus:border-red-300 focus:ring-1 focus:ring-red-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50"
          />
          <span className="text-xs font-bold text-slate-500">/ {totalPages || 1}</span>
        </div>

        <div className="h-4 w-px bg-slate-200 mx-1" />

        {/* Navigation Controls */}
        <div className="flex items-center gap-1">
          {/* First Page */}
          <button
            onClick={() => onPageChange(1)}
            disabled={loading || currentPage === 1}
            title="First Page"
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-colors"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>

          {/* Previous Page */}
          <button
            onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
            disabled={loading || currentPage === 1}
            title="Previous Page"
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Current / Total */}
          <div className="px-2 py-1 rounded-lg bg-white border border-slate-200 shadow-sm min-w-12 text-center">
            <span className="text-xs font-bold text-slate-700">{currentPage}</span>
          </div>

          {/* Next Page */}
          <button
            onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
            disabled={loading || currentPage === totalPages || totalPages === 0}
            title="Next Page"
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Last Page */}
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={loading || currentPage === totalPages || totalPages === 0}
            title="Last Page"
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-colors"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
