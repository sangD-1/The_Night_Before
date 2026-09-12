import React from 'react'
import { Sparkles, User, Clock, ShieldCheck } from 'lucide-react'
import GroundedAnswer from './GroundedAnswer'
import NotCoveredNotice from './NotCoveredNotice'
import SystemErrorNotice from './SystemErrorNotice'

export default function ChatMessage({
  message,
  onSelectCitation,
  activeCitationId,
  documents = [],
  onGoToMaterials,
  onUploadSuccess,
}) {
  const isUser = message.sender === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end gap-3 max-w-2xl ml-auto animate-in fade-in duration-150">
        <div className="bg-slate-900 text-white rounded-2xl rounded-tr-xs px-4 py-3 shadow-xs space-y-1">
          <p className="text-xs sm:text-sm font-medium leading-relaxed">
            {message.text}
          </p>
          <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 font-mono">
            <Clock className="w-2.5 h-2.5" />
            <span>{message.timestamp}</span>
          </div>
        </div>

        <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0 text-xs font-semibold shadow-2xs mt-0.5">
          <User className="w-4 h-4" />
        </div>
      </div>
    )
  }

  // Assistant Study Response Canvas
  return (
    <div className="flex gap-3 max-w-3xl mr-auto animate-in fade-in duration-200">
      <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs mt-1">
        <Sparkles className="w-4 h-4 text-indigo-100" />
      </div>

      <div className="flex-1 min-w-0 bg-white border border-slate-200/90 rounded-2xl rounded-tl-xs p-5 sm:p-6 shadow-xs space-y-4">
        {message.isSystemError ? (
          <SystemErrorNotice message={message} />
        ) : message.isNotCovered ? (
          <NotCoveredNotice
            message={message}
            onGoToMaterials={onGoToMaterials}
            onUploadSuccess={onUploadSuccess}
          />
        ) : (
          <GroundedAnswer
            message={message}
            onSelectCitation={onSelectCitation}
            activeCitationId={activeCitationId}
            documents={documents}
          />
        )}

        <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-[10px] text-slate-400 font-mono">
          <span className="flex items-center gap-1.5 text-slate-500 font-sans">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Grounded Course Study Engine
          </span>
          <span>{message.timestamp}</span>
        </div>
      </div>
    </div>
  )
}
