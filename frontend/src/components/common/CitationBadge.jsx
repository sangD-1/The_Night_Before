import React, { useState } from 'react'
import {
  FileText,
  Presentation,
  PenTool,
  ArrowRight,
  FileCode,
  ExternalLink,
} from 'lucide-react'
import { SAMPLE_CITATIONS } from '../../data/mockData'
import { BACKEND_URL } from '../../services/api'

export default function CitationBadge({
  citationId,
  citation: customCitation,
  documents = [],
  onSelect,
  active = false,
  layout = 'card', // 'card' | 'inline'
}) {
  const [fileNotice, setFileNotice] = useState(null)
  const citation = customCitation || SAMPLE_CITATIONS[citationId]

  if (!citation) return null

  const type = (citation.type || '').toLowerCase()
  const isHandwritten = citation.isHandwritten || type === 'handwritten' || type === 'image'
  const isPptx = type === 'pptx' || type === 'ppt' || type === 'presentation'
  const isMarkdown = type === 'markdown' || type === 'md' || type === 'text' || type === 'txt'
  const isPdf = type === 'pdf' || (citation.docTitle || '').toLowerCase().endsWith('.pdf')

  const getIcon = () => {
    if (isHandwritten) {
      return <PenTool className="w-4 h-4 text-amber-600 shrink-0" />
    }
    if (isPptx) {
      return <Presentation className="w-4 h-4 text-orange-600 shrink-0" />
    }
    if (isMarkdown) {
      return <FileCode className="w-4 h-4 text-slate-600 shrink-0" />
    }
    return <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
  }

  const getSourceTypeLabel = () => {
    if (isHandwritten) return 'Handwritten Note'
    if (isPptx) return 'Slide Deck'
    if (isMarkdown) return 'Text / Markdown'
    return 'Lecture PDF'
  }

  // Resolve stored filename from documents library
  const matchedDoc = documents.find(
    (d) =>
      (citation.documentId && d.id === citation.documentId) ||
      d.original_filename === citation.docTitle
  )
  const storedFilename = citation.storedFilename || matchedDoc?.stored_filename

  // Extract numeric page number if available (e.g. from citation.pageNumber or "Page 18")
  const pageNum =
    citation.pageNumber != null
      ? citation.pageNumber
      : citation.pageOrSlide?.match(/Page\s+(\d+)/i)?.[1] || null

  // Construct direct source URL using existing backend endpoint
  let directSourceUrl = null
  if (isPdf && storedFilename) {
    directSourceUrl = `${BACKEND_URL}/api/documents/uploads/${storedFilename}${
      pageNum ? `#page=${pageNum}` : ''
    }`
  } else if (isHandwritten) {
    if (citation.imagePreviewPath) {
      directSourceUrl = citation.imagePreviewPath.startsWith('http')
        ? citation.imagePreviewPath
        : `${BACKEND_URL}${citation.imagePreviewPath.startsWith('/') ? '' : '/'}${citation.imagePreviewPath}`
    } else if (storedFilename) {
      directSourceUrl = `${BACKEND_URL}/api/documents/uploads/${storedFilename}`
    }
  }

  const handleViewSource = (e) => {
    e.stopPropagation()
    if (directSourceUrl) {
      window.open(directSourceUrl, '_blank', 'noopener,noreferrer')
    } else {
      setFileNotice('Original document is currently unavailable.')
      setTimeout(() => setFileNotice(null), 3500)
    }
  }

  // Inline pill mode (e.g. within text reference)
  if (layout === 'inline') {
    return (
      <button
        type="button"
        onClick={() => onSelect && onSelect(citation)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all cursor-pointer select-none ${
          active
            ? 'bg-indigo-50 border-indigo-300 text-indigo-900 ring-2 ring-indigo-500/20 shadow-xs'
            : isHandwritten
            ? 'bg-amber-50/80 hover:bg-amber-100 border-amber-200 text-amber-900'
            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-2xs'
        }`}
        title={`Inspect ${citation.docTitle}`}
      >
        {getIcon()}
        <span className="font-semibold truncate max-w-[140px]">{citation.docTitle}</span>
        <span className="text-slate-400">·</span>
        <span className="font-mono text-[11px] text-slate-700 font-semibold">{citation.pageOrSlide}</span>
      </button>
    )
  }

  // Academic Citation Index Card mode
  return (
    <div
      onClick={() => onSelect && onSelect(citation)}
      className={`group relative rounded-xl border p-3 transition-all cursor-pointer select-none flex flex-col justify-between gap-2.5 text-left ${
        active
          ? 'bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-500/20 shadow-xs'
          : isHandwritten
          ? 'bg-amber-50/40 hover:bg-amber-50/80 border-amber-200/80 hover:border-amber-300 shadow-2xs'
          : 'bg-white hover:bg-slate-50/90 border-slate-200 hover:border-slate-300 shadow-2xs'
      }`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          if (onSelect) onSelect(citation)
        }
      }}
      title={`Inspect ${citation.docTitle} (${citation.pageOrSlide})`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
              isHandwritten
                ? 'bg-amber-100/70 border-amber-200 text-amber-800'
                : isPptx
                ? 'bg-orange-100/70 border-orange-200 text-orange-800'
                : isMarkdown
                ? 'bg-slate-100 border-slate-200 text-slate-800'
                : 'bg-indigo-100/70 border-indigo-200 text-indigo-800'
            }`}
          >
            {getIcon()}
          </div>

          <div className="min-w-0 space-y-0.5">
            <h5
              className="text-xs font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors"
              title={citation.docTitle}
            >
              {citation.docTitle}
            </h5>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-800 font-mono bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200/70">
                {citation.pageOrSlide}
              </span>
              <span>·</span>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">
                {getSourceTypeLabel()}
              </span>
            </div>
          </div>
        </div>

        {isHandwritten && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
            Handwritten
          </span>
        )}
      </div>

      {citation.excerpt && (
        <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed bg-slate-50/80 p-2 rounded-lg border border-slate-100 group-hover:bg-white transition-colors">
          &ldquo;{citation.excerpt}&rdquo;
        </p>
      )}

      {/* Card Action Strip */}
      <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px]">
        <div className="min-w-0 flex items-center">
          {fileNotice ? (
            <span className="text-[10px] text-amber-800 font-medium truncate">{fileNotice}</span>
          ) : (
            <span className="text-[10px] font-mono text-slate-400 truncate">
              {citation.confidence ? `${citation.confidence}% match` : 'Verified citation'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Explicit "View Source" button for PDF & Handwritten scans */}
          {(isPdf || isHandwritten) && (
            <button
              type="button"
              onClick={handleViewSource}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/90 transition-colors shadow-2xs cursor-pointer"
              title={
                isPdf && pageNum
                  ? `Open original PDF at Page ${pageNum} in a new tab`
                  : 'Open original document in a new tab'
              }
            >
              <ExternalLink className="w-3 h-3" />
              <span>View Source</span>
            </button>
          )}

          <span className="inline-flex items-center gap-1 font-medium text-xs text-slate-400 group-hover:text-slate-700 transition-colors">
            Inspect
            <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </div>
  )
}
