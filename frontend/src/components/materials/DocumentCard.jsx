import React from 'react'
import {
  FileText,
  Presentation,
  PenTool,
  FileCode,
  Clock,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Loader2,
  Sparkles,
} from 'lucide-react'

export default function DocumentCard({
  doc,
  isDemo = false,
  isProcessing = false,
  isIndexing = false,
  onDelete,
  onProcess,
  onIndex,
  onInspectDoc,
  onAskAboutDoc,
}) {
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  const getIcon = () => {
    const type = (doc.file_type || doc.type || '').toLowerCase()

    if (type === 'image' || type === 'handwritten') {
      return (
        <div className="w-10 h-10 rounded-xl bg-amber-100/80 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0 shadow-2xs">
          <PenTool className="w-5 h-5" />
        </div>
      )
    }
    if (type === 'pptx' || type === 'ppt') {
      return (
        <div className="w-10 h-10 rounded-xl bg-orange-100/80 border border-orange-200 text-orange-700 flex items-center justify-center shrink-0 shadow-2xs">
          <Presentation className="w-5 h-5" />
        </div>
      )
    }
    if (type === 'markdown' || type === 'text' || type === 'md' || type === 'txt') {
      return (
        <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0 shadow-2xs">
          <FileCode className="w-5 h-5" />
        </div>
      )
    }
    return (
      <div className="w-10 h-10 rounded-xl bg-indigo-100/80 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0 shadow-2xs">
        <FileText className="w-5 h-5" />
      </div>
    )
  }

  const filename = doc.original_filename || doc.filename || doc.title || 'Untitled Document'
  const size = doc.file_size ? formatBytes(doc.file_size) : doc.size || 'Unknown size'
  const fileType = (doc.file_type || doc.type || 'file').toUpperCase()
  const isImage = (doc.file_type || doc.type || '').toLowerCase() === 'image'

  const formattedDate = doc.created_at
    ? new Date(doc.created_at).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : doc.uploadedAt || 'Recently'

  const processingStatus = doc.processing_status || doc.status || 'uploaded'
  const isIndexed = processingStatus === 'indexed' || doc.upload_status === 'indexed'
  const isReady =
    processingStatus === 'ready_for_indexing' ||
    processingStatus === 'Ready' ||
    doc.upload_status === 'ready_for_indexing'

  const totalUnits = doc.page_count || doc.pageCount

  return (
    <div className="rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs transition-all p-4 space-y-3 flex flex-col justify-between">
      <div className="flex items-start gap-3">
        {getIcon()}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4
              className="text-xs sm:text-sm font-semibold text-slate-900 truncate"
              title={filename}
            >
              {filename}
            </h4>

            {isDemo ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                Demo Item
              </span>
            ) : isIndexing ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                Indexing...
              </span>
            ) : isProcessing ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                Processing...
              </span>
            ) : isIndexed ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 shrink-0 shadow-2xs">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Indexed (ChromaDB)
              </span>
            ) : isReady ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-200 shrink-0">
                <CheckCircle2 className="w-3 h-3 text-blue-600" />
                Ready to index
              </span>
            ) : processingStatus === 'processing_failed' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-50 text-rose-800 border border-rose-200 shrink-0">
                <AlertCircle className="w-3 h-3 text-rose-600" />
                Processing failed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                <Clock className="w-3 h-3 text-amber-600" />
                Waiting for processing
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-1">
            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">
              {fileType}
            </span>
            <span>·</span>
            <span>{size}</span>
            {totalUnits != null && (
              <>
                <span>·</span>
                <span className="text-indigo-700 font-sans font-semibold">
                  {fileType === 'PPTX'
                    ? `${totalUnits} slides`
                    : fileType === 'IMAGE'
                    ? '1 scan'
                    : `${totalUnits} pages`}
                </span>
              </>
            )}
            <span>·</span>
            <span>{formattedDate}</span>
          </div>

          {isImage && (
            <div className="text-[11px] text-amber-800 bg-amber-50/80 border border-amber-100 rounded-md p-1.5 mt-2 leading-tight flex items-center justify-between">
              <span>Scanned note · Original image preserved for inspection</span>
              {doc.ocr_status === 'ocr_unavailable' && (
                <span className="font-mono text-[9px] bg-amber-200/60 px-1 py-0.5 rounded text-amber-900 font-bold">
                  OCR Pending
                </span>
              )}
            </div>
          )}

          {doc.summary && (
            <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">
              {doc.summary}
            </p>
          )}
        </div>
      </div>

      {/* Action Bar */}
      <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-xs">
        <div className="flex items-center gap-2">
          {/* Inspect Extracted Content Button */}
          {!isDemo && onInspectDoc && (
            <button
              type="button"
              onClick={() => onInspectDoc(doc)}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
              title="Inspect extracted pages, slides, or note scan"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Inspect Content</span>
            </button>
          )}

          {/* Index into ChromaDB Button */}
          {!isDemo && onIndex && (isReady || isIndexed) && (
            <button
              type="button"
              onClick={() => onIndex(doc.id)}
              disabled={isIndexing || isProcessing}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer disabled:opacity-50"
              title="Generate vectors and index into ChromaDB"
            >
              <Sparkles className="w-3 h-3 text-indigo-500" />
              <span>{isIndexed ? 'Re-index' : 'Index to Chroma'}</span>
            </button>
          )}

          {/* Manual Process Button if not ready or re-processing */}
          {!isDemo && onProcess && (
            <button
              type="button"
              onClick={() => onProcess(doc.id)}
              disabled={isProcessing || isIndexing}
              className="text-[11px] font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              title="Re-run text extraction pipeline"
            >
              {isReady || isIndexed ? 'Re-extract' : 'Process Now'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isDemo && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(doc.id)}
              className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              title="Delete uploaded file"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {onAskAboutDoc && (
            <button
              type="button"
              onClick={() => onAskAboutDoc(doc)}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
            >
              Ask Question
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
