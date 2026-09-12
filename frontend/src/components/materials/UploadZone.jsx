import React, { useState } from 'react'
import {
  UploadCloud,
  FileText,
  Presentation,
  PenTool,
  FileCode,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
} from 'lucide-react'
import { apiService } from '../../services/api'

export default function UploadZone({ onUploadSuccess }) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploadQueue, setUploadQueue] = useState([]) // Array of { id, name, size, progress, status, error }
  const [generalError, setGeneralError] = useState(null)

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
      e.target.value = '' // Reset so same file can be re-selected if needed
    }
  }

  const processFiles = async (files) => {
    setGeneralError(null)

    const newItems = files.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      file,
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'pending', // 'pending' | 'uploading' | 'success' | 'error'
      error: null,
    }))

    setUploadQueue((prev) => [...newItems, ...prev])

    // Upload files sequentially or concurrently
    for (const item of newItems) {
      updateItem(item.id, { status: 'uploading', progress: 5 })

      try {
        const result = await apiService.uploadDocument(item.file, (percent) => {
          updateItem(item.id, { progress: percent })
        })

        updateItem(item.id, {
          status: 'success',
          progress: 100,
          docData: result,
        })

        if (onUploadSuccess) {
          onUploadSuccess(result)
        }
      } catch (err) {
        updateItem(item.id, {
          status: 'error',
          error: err.message || 'Upload failed',
        })
      }
    }
  }

  const updateItem = (id, fields) => {
    setUploadQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...fields } : item))
    )
  }

  const removeQueueItem = (id) => {
    setUploadQueue((prev) => prev.filter((item) => item.id !== id))
  }

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  return (
    <div className="space-y-4">
      {/* Drop Zone Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/70 ring-4 ring-indigo-500/10'
            : 'border-slate-300 hover:border-indigo-400 bg-white hover:bg-slate-50/50 shadow-2xs'
        }`}
      >
        <input
          type="file"
          id="course-file-upload"
          multiple
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          accept=".pdf,.pptx,.ppt,.md,.txt,.jpg,.jpeg,.png"
        />

        <div className="max-w-md mx-auto space-y-4 pointer-events-none">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
            <UploadCloud className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              {isDragging ? 'Drop course files to upload' : 'Bring your course material together'}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Drag &amp; drop lecture files, slides, or scanned notes here, or{' '}
              <span className="text-indigo-600 font-semibold underline underline-offset-2">
                browse files
              </span>
            </p>
          </div>

          {/* Supported Document Types Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-left">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200/70 text-slate-700">
              <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-slate-800">PDFs</p>
                <p className="text-[10px] text-slate-500">Lectures &amp; texts</p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200/70 text-slate-700">
              <Presentation className="w-4 h-4 text-orange-600 shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-slate-800">Slides</p>
                <p className="text-[10px] text-slate-500">PPT / PPTX decks</p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200/70 text-slate-700">
              <FileCode className="w-4 h-4 text-slate-600 shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-slate-800">Markdown</p>
                <p className="text-[10px] text-slate-500">MD / plain text</p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200/70 text-slate-700">
              <PenTool className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-slate-800">Notes / Scans</p>
                <p className="text-[10px] text-slate-500">JPG, JPEG, PNG</p>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 font-medium">
            Maximum file size: 25 MB per document
          </div>
        </div>
      </div>

      {/* General Error Banner */}
      {generalError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{generalError}</span>
          </div>
          <button
            type="button"
            onClick={() => setGeneralError(null)}
            className="text-rose-500 hover:text-rose-700 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Upload Queue / Progress Feedback */}
      {uploadQueue.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs text-slate-600 px-1 font-semibold">
            <span>Recent Uploads ({uploadQueue.length})</span>
            <button
              type="button"
              onClick={() => setUploadQueue([])}
              className="text-[11px] text-slate-400 hover:text-slate-600"
            >
              Clear Completed
            </button>
          </div>

          <div className="space-y-2">
            {uploadQueue.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2"
              >
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    {item.status === 'uploading' && (
                      <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
                    )}
                    {item.status === 'success' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                    {item.status === 'error' && (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    {item.status === 'pending' && (
                      <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />
                    )}

                    <span className="font-medium text-slate-800 truncate">
                      {item.name}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono shrink-0">
                      ({formatBytes(item.size)})
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[11px] font-medium ${
                        item.status === 'success'
                          ? 'text-emerald-700'
                          : item.status === 'error'
                          ? 'text-rose-700'
                          : 'text-indigo-700'
                      }`}
                    >
                      {item.status === 'uploading' && `Uploading (${item.progress}%)`}
                      {item.status === 'success' && 'Uploaded · Waiting for processing'}
                      {item.status === 'error' && 'Failed'}
                      {item.status === 'pending' && 'Queued'}
                    </span>

                    <button
                      type="button"
                      onClick={() => removeQueueItem(item.id)}
                      className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                {item.status === 'uploading' && (
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 transition-all duration-150 rounded-full"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}

                {/* Error message */}
                {item.status === 'error' && item.error && (
                  <p className="text-[11px] text-rose-600 font-medium pl-6">
                    {item.error}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
