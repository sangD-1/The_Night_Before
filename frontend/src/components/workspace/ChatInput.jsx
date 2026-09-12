import React, { useState, useRef, useEffect } from 'react'
import { ArrowUp, ShieldCheck } from 'lucide-react'

export default function ChatInput({ onSendMessage, disabled = false }) {
  const [input, setInput] = useState('')
  const textareaRef = useRef(null)

  // Auto-resize textarea dynamically
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        180
      )}px`
    }
  }, [input])

  const handleSubmit = (e) => {
    e?.preventDefault()
    if (!input.trim() || disabled) return
    onSendMessage(input.trim())
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-4 pt-2">
      <form
        onSubmit={handleSubmit}
        className="relative rounded-2xl border border-slate-300/90 bg-white focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 shadow-xs transition-all"
      >
        <div className="flex items-end gap-2 p-3">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Ask anything about your course material..."
            className="w-full resize-none border-0 bg-transparent p-1 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-0 leading-relaxed max-h-44 font-sans"
          />

          <button
            type="submit"
            disabled={!input.trim() || disabled}
            className={`p-2.5 rounded-xl text-white transition-all shrink-0 cursor-pointer flex items-center justify-center ${
              input.trim() && !disabled
                ? 'bg-indigo-600 hover:bg-indigo-700 shadow-xs'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
            }`}
            title="Send question (Enter)"
            aria-label="Send question"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>

        {/* Composer Footer Bar */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">
              Grounded exclusively in your uploaded course materials.
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono text-slate-400 shrink-0">
            <span>Enter to send</span>
            <span>·</span>
            <span>Shift + Enter for new line</span>
          </div>
        </div>
      </form>
    </div>
  )
}
