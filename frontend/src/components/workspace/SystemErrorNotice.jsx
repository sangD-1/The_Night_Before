import React from 'react'
import { AlertOctagon, RefreshCw, ServerOff } from 'lucide-react'

export default function SystemErrorNotice({ message, onRetry }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-5 space-y-4 shadow-2xs">
      {/* Header with Distinct Technical Error Badge */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-700 shrink-0 shadow-2xs">
          <AlertOctagon className="w-5 h-5" />
        </div>

        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-rose-950">
              {message.title || 'System Execution Error'}
            </h4>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-200/80 text-rose-900">
              System Error (Not Refusal)
            </span>
          </div>
          <p className="text-xs text-rose-900/80 leading-relaxed">
            {message.reason || 'The study assistant encountered an unexpected technical problem while processing your request.'}
          </p>
        </div>
      </div>

      {/* Technical Diagnostics Box */}
      <div className="rounded-lg bg-white/90 border border-rose-200/70 p-3.5 space-y-2 text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-rose-900">
          <ServerOff className="w-3.5 h-3.5 text-rose-600" />
          <span>Diagnostic Context</span>
        </div>
        <p className="text-slate-600 leading-relaxed">
          {message.guidance ||
            'This issue is caused by backend server unavailability, LLM API rate limits, or network timeout. It is not an absence of course material.'}
        </p>
      </div>

      {/* Recovery Actions */}
      <div className="pt-1 flex items-center gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-medium transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Question</span>
          </button>
        )}
        <span className="text-xs text-rose-800/80 font-mono text-[11px]">
          Target: http://127.0.0.1:8000/api/chat
        </span>
      </div>
    </div>
  )
}
