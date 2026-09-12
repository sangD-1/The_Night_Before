import React, { useState } from 'react'
import {
  Sparkles,
  Files,
  Plus,
  FileText,
  Presentation,
  PenTool,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Eye,
  MessageSquare,
  Server,
  UploadCloud,
  ChevronLeft,
  X,
} from 'lucide-react'
import { apiService } from '../../services/api'

export default function Sidebar({
  documents = [],
  isLoadingDocs = false,
  onInspectDocument,
  onAskAboutDoc,
  onDeleteDocument,
  onUploadSuccess,
  onResetConversation,
  backendStatus = 'connected',
  onOpenBackendModal,
  onCloseMobile,
}) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploadQueue, setUploadQueue] = useState([]) // Array of { id, name, size, progress, status, error }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer?.files?.length) {
      processFiles(Array.from(e.dataTransfer.files))
    }
  }

  const handleFileInput = (e) => {
    if (e.target.files?.length) {
      processFiles(Array.from(e.target.files))
      e.target.value = ''
    }
  }

  const processFiles = async (files) => {
    const newItems = files.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      file,
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'uploading', // 'uploading' -> 'processing' -> 'understanding' -> 'ready' -> 'failed'
      error: null,
    }))

    setUploadQueue((prev) => [...newItems, ...prev])

    for (const item of newItems) {
      try {
        updateQueueItem(item.id, { status: 'uploading', progress: 15 })

        const result = await apiService.uploadDocument(item.file, (percent) => {
          updateQueueItem(item.id, { progress: Math.min(percent, 70) })
        })

        updateQueueItem(item.id, { status: 'processing', progress: 80 })

        // Let the backend process and index
        if (result?.id) {
          updateQueueItem(item.id, { status: 'understanding', progress: 95 })
        }

        setTimeout(() => {
          updateQueueItem(item.id, { status: 'ready', progress: 100 })
          if (onUploadSuccess) onUploadSuccess(result)
        }, 600)
      } catch (err) {
        updateQueueItem(item.id, {
          status: 'failed',
          error: err.message || 'Upload failed',
        })
      }
    }
  }

  const updateQueueItem = (id, fields) => {
    setUploadQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...fields } : item))
    )
  }

  const removeQueueItem = (id) => {
    setUploadQueue((prev) => prev.filter((item) => item.id !== id))
  }

  const getDocIcon = (doc) => {
    const type = (doc.file_type || doc.type || '').toLowerCase()
    if (type === 'image' || type === 'handwritten') {
      return <PenTool className="w-3.5 h-3.5 text-amber-600" />
    }
    if (type === 'pptx' || type === 'ppt') {
      return <Presentation className="w-3.5 h-3.5 text-orange-600" />
    }
    if (type === 'markdown' || type === 'text' || type === 'md' || type === 'txt') {
      return <FileCode className="w-3.5 h-3.5 text-slate-600" />
    }
    return <FileText className="w-3.5 h-3.5 text-indigo-600" />
  }

  const getDocTypeBadge = (doc) => {
    const type = (doc.file_type || doc.type || 'file').toLowerCase()
    if (type === 'image' || type === 'handwritten') return 'NOTES'
    if (type === 'pptx' || type === 'ppt') return 'SLIDES'
    if (type === 'markdown' || type === 'text' || type === 'md' || type === 'txt') return 'TEXT'
    return 'PDF'
  }

  const getDocUnitCount = (doc) => {
    const units = doc.page_count || doc.pageCount
    if (!units) return null
    const type = (doc.file_type || doc.type || '').toLowerCase()
    if (type === 'image' || type === 'handwritten') return '1 scan'
    if (type === 'pptx' || type === 'ppt') return `${units} slides`
    return `${units} pages`
  }

  return (
    <aside className="w-80 bg-slate-900 text-slate-200 flex flex-col h-full border-r border-slate-800 select-none shrink-0 z-20">
      {/* 1. Brand Header & New Chat Action */}
      <div className="p-4 border-b border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-4 h-4 text-indigo-100" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-white leading-none">
                The Night Before
              </h1>
              <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                Your grounded study assistant
              </p>
            </div>
          </div>

          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="lg:hidden p-1 rounded-md text-slate-400 hover:text-white"
              aria-label="Close sidebar"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onResetConversation}
          className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Question</span>
        </button>
      </div>

      {/* 2. "Your Materials" Header & Upload Section (Sections 3 & 4) */}
      <div className="p-4 space-y-3 border-b border-slate-800">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Files className="w-3.5 h-3.5 text-indigo-400" />
              Your Materials
            </h2>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-slate-800 text-slate-400 border border-slate-700">
              {documents.length}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            &ldquo;Everything The Night Before can study from.&rdquo;
          </p>
        </div>

        {/* Premium Compact Upload Dropzone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative rounded-xl border border-dashed p-3 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-indigo-400 bg-indigo-950/50 ring-2 ring-indigo-500/20'
              : 'border-slate-700 hover:border-slate-600 bg-slate-800/40 hover:bg-slate-800/80'
          }`}
        >
          <input
            type="file"
            multiple
            onChange={handleFileInput}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            accept=".pdf,.pptx,.ppt,.md,.txt,.jpg,.jpeg,.png"
            aria-label="Upload course material"
          />

          <div className="pointer-events-none space-y-1">
            <div className="w-7 h-7 mx-auto rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div className="text-xs font-semibold text-slate-200">
              {isDragging ? 'Drop course file here' : 'Add course material'}
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              PDF, PPT/PPTX, Markdown, text, or notes
            </p>
            <div className="pt-0.5">
              <span className="text-[10px] font-semibold text-indigo-400 underline underline-offset-2">
                Browse files
              </span>
            </div>
          </div>
        </div>

        {/* Upload Queue Progression */}
        {uploadQueue.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {uploadQueue.map((item) => (
              <div
                key={item.id}
                className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/80 text-[11px] space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-200 truncate">{item.name}</span>
                  <button
                    type="button"
                    onClick={() => removeQueueItem(item.id)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="flex items-center gap-1 text-indigo-300 capitalize font-medium">
                    {item.status === 'uploading' && <Loader2 className="w-3 h-3 animate-spin" />}
                    {item.status === 'processing' && <Loader2 className="w-3 h-3 animate-spin text-amber-300" />}
                    {item.status === 'understanding' && <Sparkles className="w-3 h-3 animate-pulse text-indigo-300" />}
                    {item.status === 'ready' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                    {item.status === 'failed' && <AlertCircle className="w-3 h-3 text-rose-400" />}
                    {item.status === 'uploading' && 'Uploading'}
                    {item.status === 'processing' && 'Processing'}
                    {item.status === 'understanding' && 'Understanding'}
                    {item.status === 'ready' && 'Ready to search'}
                    {item.status === 'failed' && 'Failed'}
                  </span>
                  <span className="font-mono">{item.progress}%</span>
                </div>

                <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-150 ${
                      item.status === 'ready'
                        ? 'bg-emerald-400'
                        : item.status === 'failed'
                        ? 'bg-rose-400'
                        : 'bg-indigo-500'
                    }`}
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Real Uploaded Materials List (Section 3) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {isLoadingDocs && documents.length === 0 && (
          <div className="py-8 text-center text-xs text-slate-500 space-y-2">
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-400" />
            <span>Loading course materials...</span>
          </div>
        )}

        {!isLoadingDocs && documents.length === 0 && (
          <div className="py-8 px-4 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/40 space-y-2">
            <p className="text-xs font-semibold text-slate-300">No course material yet</p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Upload lecture PDFs, slides, or handwritten notes to begin studying.
            </p>
          </div>
        )}

        {documents.map((doc) => {
          const filename = doc.original_filename || doc.filename || doc.title || 'Course Document'
          const units = getDocUnitCount(doc)
          const typeBadge = getDocTypeBadge(doc)
          const status = doc.processing_status || doc.status || 'uploaded'
          const isReady =
            status === 'indexed' ||
            status === 'ready_for_indexing' ||
            status === 'PROCESSED' ||
            status === 'Ready'

          return (
            <div
              key={doc.id}
              className="group p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all space-y-2 text-xs select-none"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                  {getDocIcon(doc)}
                </div>

                <div className="flex-1 min-w-0">
                  <h4
                    className="font-semibold text-slate-200 truncate cursor-pointer hover:text-indigo-300 transition-colors"
                    title={filename}
                    onClick={() => onInspectDocument && onInspectDocument(doc)}
                  >
                    {filename}
                  </h4>

                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-0.5">
                    <span className="px-1 py-0.2 rounded bg-slate-800 text-slate-300 font-bold">
                      {typeBadge}
                    </span>
                    {units && (
                      <>
                        <span>·</span>
                        <span className="text-indigo-300">{units}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status Indicator (Searchable / Processing) */}
                <div className="shrink-0 flex items-center gap-1">
                  {isReady ? (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/70"
                      title="Searchable in course knowledge base"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Ready
                    </span>
                  ) : status === 'processing' ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-800">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      Processing
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-800">
                      Uploaded
                    </span>
                  )}
                </div>
              </div>

              {/* Hover Quick Action Toolbar */}
              <div className="pt-1 flex items-center justify-between border-t border-slate-800/70 text-[11px] opacity-80 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => onInspectDocument && onInspectDocument(doc)}
                  className="inline-flex items-center gap-1 text-slate-400 hover:text-indigo-300 transition-colors cursor-pointer"
                  title="Inspect document pages/slides and OCR text"
                >
                  <Eye className="w-3 h-3" />
                  <span>Inspect</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onAskAboutDoc && onAskAboutDoc(doc)}
                    className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer font-medium"
                    title="Ask question about this document"
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>Ask</span>
                  </button>

                  {onDeleteDocument && (
                    <button
                      type="button"
                      onClick={() => onDeleteDocument(doc.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Delete document"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 4. Sidebar Footer & Backend Status */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/50 space-y-2">
        <button
          type="button"
          onClick={onOpenBackendModal}
          className="w-full px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800/80 border border-slate-800 text-[11px] flex items-center justify-between text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          title="Inspect FastAPI backend connection"
        >
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                backendStatus === 'connected'
                  ? 'bg-emerald-400 ring-2 ring-emerald-400/20'
                  : 'bg-rose-400'
              }`}
            />
            <span className="font-mono text-[10px]">
              {backendStatus === 'connected' ? 'Backend: 200 OK' : 'Backend Offline'}
            </span>
          </div>
          <Server className="w-3 h-3 text-slate-500" />
        </button>
      </div>
    </aside>
  )
}
