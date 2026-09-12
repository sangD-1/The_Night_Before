import React, { useState, useRef } from 'react'
import {
  ShieldAlert,
  SearchX,
  FileQuestion,
  Upload,
  Info,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { apiService } from '../../services/api'

export default function NotCoveredNotice({
  message,
  onGoToMaterials,
  onUploadSuccess,
}) {
  const queryTopic = message.queryTopic || 'this topic'
  const fileInputRef = useRef(null)

  const [isDragging, setIsDragging] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('idle') // 'idle' | 'uploading' | 'success' | 'error'
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadingFileName, setUploadingFileName] = useState('')
  const [uploadError, setUploadError] = useState(null)

  const triggerFilePicker = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files))
      e.target.value = '' // Reset so same file can be chosen again
    }
  }

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

  const processFiles = async (files) => {
    setUploadError(null)

    for (const file of files) {
      setUploadingFileName(file.name)
      setUploadStatus('uploading')
      setUploadProgress(15)

      try {
        const result = await apiService.uploadDocument(file, (percent) => {
          setUploadProgress(percent)
        })

        setUploadStatus('success')
        setUploadProgress(100)

        if (onUploadSuccess) {
          onUploadSuccess(result)
        }
        if (onGoToMaterials) {
          onGoToMaterials()
        }

        setTimeout(() => {
          setUploadStatus('idle')
          setUploadingFileName('')
        }, 5000)
      } catch (err) {
        setUploadStatus('error')
        setUploadError(err.message || 'Upload failed')
      }
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`rounded-2xl border p-5 space-y-4 transition-all ${
        isDragging
          ? 'border-amber-400 bg-amber-100/60 ring-2 ring-amber-400/30'
          : 'border-amber-200/90 bg-amber-50/40 shadow-2xs'
      }`}
    >
      {/* Hidden native file input covering all supported course formats */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf,.pptx,.ppt,.md,.txt,.jpg,.jpeg,.png"
        aria-label="Upload course material"
      />

      {/* 1. Header with Calm Academic Refusal */}
      <div className="flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-800 shrink-0 shadow-2xs">
          <ShieldAlert className="w-5 h-5" />
        </div>

        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-200/80 text-amber-900 border border-amber-300/60">
              Not Covered
            </span>
            <span className="text-[11px] text-amber-800/80 font-medium">
              Strict Grounding Active
            </span>
          </div>

          <h4 className="text-sm sm:text-base font-bold text-amber-950 leading-snug">
            I couldn&apos;t find enough information about this in your uploaded course material, so I won&apos;t guess.
          </h4>

          <p className="text-xs text-amber-900/80 leading-relaxed pt-0.5">
            {message.reason ||
              `The search evaluated your uploaded documents, but found no verified evidence addressing "${queryTopic}".`}
          </p>
        </div>
      </div>

      {/* 2. Evaluated Documents Checklist */}
      <div className="rounded-xl bg-white/95 border border-amber-200/70 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <SearchX className="w-3.5 h-3.5 text-amber-600" />
            Evaluated Course Documents
          </span>
          <span className="font-mono text-slate-400">0 verified matches</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
          {(message.attemptedDocuments || [
            'Operating Systems - Unit 1',
            "Professor's Handwritten Notes - Concurrency",
            'Graph Algorithms & Traversal Slides',
            'DBMS Lecture Notes - Normalization',
          ]).map((doc, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-50/40 border border-amber-100 text-xs text-slate-700"
            >
              <FileQuestion className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="truncate">{doc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Honest Grounding Philosophy Notice */}
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-100/50 border border-amber-200/60 text-xs text-amber-950 leading-relaxed">
        <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Why we refuse to guess: </span>
          Generic AI chatbots often fabricate plausible-sounding answers when materials are missing. The Night Before strictly refuses out-of-domain queries so you never study misleading exam information.
        </div>
      </div>

      {/* 4. Active Upload Feedback Banner (if user uploaded via this card) */}
      {uploadStatus === 'uploading' && (
        <div className="p-3 rounded-xl bg-white border border-indigo-200 shadow-2xs space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between text-xs text-indigo-950">
            <div className="flex items-center gap-2 font-medium truncate">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
              <span className="truncate">Uploading &amp; indexing &ldquo;{uploadingFileName}&rdquo;...</span>
            </div>
            <span className="font-mono text-[11px] text-indigo-600 shrink-0">{uploadProgress}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-200 rounded-full"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {uploadStatus === 'success' && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2 shadow-2xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <strong>&ldquo;{uploadingFileName}&rdquo;</strong> uploaded and indexed into ChromaDB! It is now searchable in your materials.
          </span>
        </div>
      )}

      {uploadStatus === 'error' && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-center justify-between shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Upload failed: {uploadError}</span>
          </div>
          <button
            type="button"
            onClick={() => setUploadStatus('idle')}
            className="text-rose-600 font-semibold underline text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 5. Working "Add course material" Action Control */}
      <div className="pt-1 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={triggerFilePicker}
          disabled={uploadStatus === 'uploading'}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
          title="Upload course PDF, PPT/PPTX slide deck, or handwritten note"
        >
          {uploadStatus === 'uploading' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Upload className="w-3.5 h-3.5" />
          )}
          <span>Add course material</span>
        </button>

        <span className="text-xs text-amber-900/80">
          Try uploading another lecture, slide set, or note.
        </span>
      </div>
    </div>
  )
}
