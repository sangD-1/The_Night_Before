import React from 'react'
import { Server, CheckCircle2, AlertCircle, RefreshCw, X } from 'lucide-react'

export default function BackendStatusModal({
  isOpen,
  onClose,
  status,
  details,
  error,
  lastChecked,
  backendUrl,
  onRefresh,
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-900">Backend Connectivity</h3>
              <p className="text-xs text-slate-500">FastAPI Architecture Verification</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
            <div className="flex items-center gap-2">
              {status === 'connected' && (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              )}
              {status === 'checking' && (
                <RefreshCw className="w-5 h-5 text-amber-600 animate-spin" />
              )}
              {status === 'error' && (
                <AlertCircle className="w-5 h-5 text-rose-600" />
              )}
              {status === 'idle' && (
                <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              )}
              <span className="text-sm font-medium text-slate-800">
                {status === 'connected' && 'Backend Connected (200 OK)'}
                {status === 'checking' && 'Checking /api/health...'}
                {status === 'error' && 'Backend Disconnected'}
                {status === 'idle' && 'Not checked yet'}
              </span>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              {lastChecked ? lastChecked.toLocaleTimeString() : 'Never'}
            </span>
          </div>

          <div className="text-xs space-y-1.5">
            <div className="flex justify-between text-slate-500">
              <span>Target Endpoint:</span>
              <span className="font-mono text-slate-700">{backendUrl}/api/health</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>CORS Status:</span>
              <span className="text-emerald-700 font-medium">Permitted for local frontend</span>
            </div>
          </div>

          {status === 'connected' && details && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Raw FastAPI Health Payload:</label>
              <pre className="p-3 bg-slate-900 text-emerald-400 rounded-lg text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
                {JSON.stringify(details, null, 2)}
              </pre>
            </div>
          )}

          {status === 'error' && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 space-y-1">
              <p className="font-semibold text-rose-900">Failed to connect to backend:</p>
              <p className="font-mono">{error || 'Server not reachable at ' + backendUrl}</p>
              <p className="text-slate-600 text-[11px] pt-1">
                Make sure Uvicorn is running: <br />
                <code className="bg-rose-100 px-1 py-0.5 rounded text-rose-900">
                  uvicorn app.main:app --reload --port 8000
                </code>
              </p>
            </div>
          )}

          <div className="pt-1 flex gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={status === 'checking'}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${status === 'checking' ? 'animate-spin' : ''}`} />
              Check Backend Again
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
