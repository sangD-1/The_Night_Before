import React, { useRef, useEffect } from 'react'
import EmptyState from './EmptyState'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'
import { Sparkles, RotateCcw, Loader2 } from 'lucide-react'

export default function StudyWorkspace({
  conversation = [],
  onSendMessage,
  onSelectCitation,
  activeCitationId,
  documents = [],
  onGoToMaterials,
  onUploadSuccess,
  onResetConversation,
  isLoading = false,
  loadingStatusText = '',
}) {
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation, isLoading])

  const isEmpty = conversation.length === 0

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/60">
      {/* 1. Scrollable Conversation Canvas */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {isEmpty ? (
            <EmptyState onSelectQuestion={onSendMessage} />
          ) : (
            <>
              {/* Active Conversation Context Header */}
              <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
                  <span className="font-semibold text-slate-800">
                    Active Grounded Session
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500 font-medium">
                    Strict Course Grounding
                  </span>
                </div>

                <button
                  type="button"
                  onClick={onResetConversation}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                  title="Clear conversation and start over"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear Thread</span>
                </button>
              </div>

              {/* Messages Stream */}
              {conversation.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  onSelectCitation={onSelectCitation}
                  activeCitationId={activeCitationId}
                  documents={documents}
                  onGoToMaterials={onGoToMaterials}
                  onUploadSuccess={onUploadSuccess}
                />
              ))}

              {/* Real-time RAG Retrieval Progress Indicator */}
              {isLoading && (
                <div className="flex gap-3 max-w-xl mr-auto animate-in fade-in duration-200">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs mt-1">
                    <Sparkles className="w-4 h-4 text-indigo-100" />
                  </div>
                  <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl rounded-tl-xs px-4 py-3 shadow-2xs text-xs text-slate-700">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
                    <span className="font-medium">
                      {loadingStatusText || 'Searching your course material...'}
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      {/* 2. Chat Composer */}
      <div className="border-t border-slate-200/80 bg-white/95 backdrop-blur-xs shrink-0">
        <ChatInput onSendMessage={onSendMessage} disabled={isLoading} />
      </div>
    </div>
  )
}
