import React from 'react'
import {
  Sparkles,
  ArrowRight,
  PenTool,
  Presentation,
  FileText,
  Layers,
} from 'lucide-react'

export default function EmptyState({ onSelectQuestion }) {
  const examplePrompts = [
    {
      title: 'Difference between BFS and DFS',
      query: 'What is the actual difference between BFS and DFS?',
      tag: 'Slides Citation',
      icon: Presentation,
      color: 'text-orange-600 bg-orange-50 border-orange-200',
    },
    {
      title: 'Deadlock conditions from lectures',
      query: 'Explain the deadlock conditions from my lectures.',
      tag: 'Lecture PDF',
      icon: FileText,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    },
    {
      title: 'Compare lecture with handwritten notes',
      query: 'Compare what the lecture says with my handwritten notes.',
      tag: 'Multi-Doc Synthesis',
      icon: Layers,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    },
    {
      title: 'Professor emphasis in notes',
      query: 'What did the professor emphasize about this topic?',
      tag: 'Handwritten Scan',
      icon: PenTool,
      color: 'text-amber-600 bg-amber-50 border-amber-200',
    },
  ]

  const pipelineSteps = [
    { label: 'Upload', desc: 'PDF, PPTX, Scans' },
    { label: 'Understand', desc: 'OCR & Page-aware' },
    { label: 'Retrieve', desc: 'ChromaDB vectors' },
    { label: 'Answer', desc: 'Strictly grounded' },
    { label: 'Cite', desc: 'Exact page & slide' },
  ]

  return (
    <div className="max-w-3xl mx-auto py-8 sm:py-12 px-4 space-y-10 animate-in fade-in duration-300">
      {/* 1. Hero Brand Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 text-xs font-semibold shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>The Night Before · Grounded Study Workspace</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
          Your course material.
          <br />
          <span className="text-indigo-900 font-bold">
            One place to understand it.
          </span>
        </h1>

        <p className="text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
          Ask questions across lectures, slides, and handwritten notes. Every answer is
          grounded in what you uploaded—with verifiable page and slide citations.
        </p>
      </div>

      {/* 2. Visual AI Pipeline Strip (Upload -> Understand -> Retrieve -> Answer -> Cite) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center mb-4">
          How The Night Before Studies Your Material
        </div>

        <div className="grid grid-cols-5 gap-2 relative">
          {pipelineSteps.map((step, idx) => (
            <div key={idx} className="flex flex-col items-center text-center space-y-1 relative">
              <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 shadow-2xs">
                {idx + 1}
              </div>
              <span className="text-xs font-bold text-slate-800">{step.label}</span>
              <span className="text-[10px] text-slate-500 hidden sm:inline-block leading-tight">
                {step.desc}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Clickable Example Prompts (Section 5) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Click an example question to start
          </span>
          <span className="text-[11px] text-indigo-600 font-medium">
            Populates real study query
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {examplePrompts.map((item, idx) => {
            const Icon = item.icon
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectQuestion(item.query)}
                className="group p-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/20 text-left transition-all shadow-2xs hover:shadow-xs cursor-pointer flex flex-col justify-between space-y-3"
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border ${item.color}`}
                  >
                    <Icon className="w-3 h-3" />
                    {item.tag}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                </div>

                <p className="text-xs sm:text-sm font-semibold text-slate-800 group-hover:text-indigo-950 transition-colors leading-snug">
                  &ldquo;{item.query}&rdquo;
                </p>

                <div className="text-[10px] text-slate-400 font-mono">
                  Grounded question test
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
