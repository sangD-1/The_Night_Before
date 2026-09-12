import React, { useState } from 'react'
import {
  Layers,
  ShieldCheck,
  Copy,
  Check,
  BookOpen,
} from 'lucide-react'
import CitationBadge from '../common/CitationBadge'
import StudyAnswerRenderer from './StudyAnswerRenderer'

export default function GroundedAnswer({ message, onSelectCitation, activeCitationId, documents = [] }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    // Copy plain text content without raw markdown symbols if possible
    const cleanContent = message.content
      ? message.content.replace(/\[(?:SOURCE|CHUNK)\s*\d+\]:?/gi, '')
      : ''
    navigator.clipboard.writeText(cleanContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const citations = message.citations || []
  const sourcesCount =
    message.sourcesCount ||
    (citations.length > 0 ? citations.length : message.sourceIds?.length || 1)

  return (
    <div className="space-y-4">
      {/* 1. Grounding / Trust Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          {message.isMultiSource ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
              <Layers className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              Grounded in {sourcesCount} course sources
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              Based on your course material
            </span>
          )}
          <span className="hidden sm:inline-block text-[11px] text-slate-400 font-medium">
            Strict verification
          </span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Copy study answer to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-700">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* 2. Structured Study Answer */}
      <div className="pt-0.5">
        <StudyAnswerRenderer content={message.content} />
      </div>

      {/* 3. SOURCES USED Section (Academic Index Cards) */}
      {(citations.length > 0 || (message.sourceIds && message.sourceIds.length > 0)) && (
        <div className="pt-4 border-t border-slate-100 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                Sources Used
              </span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-600">
                {citations.length > 0 ? citations.length : message.sourceIds.length}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              Click to view exact source &amp; coordinates
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {citations.length > 0
              ? citations.map((cit, idx) => (
                  <CitationBadge
                    key={cit.id || idx}
                    citationId={cit.id}
                    citation={cit}
                    documents={documents}
                    active={activeCitationId === cit.id}
                    onSelect={onSelectCitation}
                    layout="card"
                  />
                ))
              : message.sourceIds.map((cid, idx) => (
                  <CitationBadge
                    key={cid || idx}
                    citationId={cid}
                    documents={documents}
                    active={activeCitationId === cid}
                    onSelect={onSelectCitation}
                    layout="card"
                  />
                ))}
          </div>
        </div>
      )}
    </div>
  )
}
