import React from 'react'
import {
  History,
  BookOpen,
  Clock,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react'

export default function StudyHistory({ onResumeSession }) {
  const sessions = [
    {
      id: 'sess-1',
      title: 'Operating Systems — Concurrency & Deadlocks',
      course: 'CS-301 Operating Systems',
      date: 'Today, 8:42 AM',
      questionsCount: 4,
      citationsVerified: 6,
      documentsUsed: ['Operating Systems - Unit 1', "Professor's Handwritten Notes"],
      isActive: true,
    },
    {
      id: 'sess-2',
      title: 'Graph Traversal & Shortest Path Complexities',
      course: 'CS-204 Data Structures & Algorithms',
      date: 'Yesterday, 3:15 PM',
      questionsCount: 7,
      citationsVerified: 12,
      documentsUsed: ['Graph Algorithms & Traversal Slides'],
      isActive: false,
    },
    {
      id: 'sess-3',
      title: 'Relational Database Normalization (3NF & BCNF)',
      course: 'CS-310 Database Management Systems',
      date: '3 days ago',
      questionsCount: 5,
      citationsVerified: 9,
      documentsUsed: ['DBMS Lecture Notes - Normalization'],
      isActive: false,
    },
  ]

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" />
              Study Session History
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Review your past study dialogues, cited sources, and exam revision topics.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
            3 Past Sessions
          </span>
        </div>

        <div className="space-y-3">
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`p-4 rounded-xl border bg-white transition-all space-y-3 ${
                s.isActive
                  ? 'border-indigo-300 ring-1 ring-indigo-500/20 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {s.title}
                    </h3>
                    {s.isActive && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                        Current Session
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium">{s.course}</p>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{s.date}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                <div className="flex items-center gap-4 text-slate-600">
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                    <strong>{s.questionsCount}</strong> questions
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <strong>{s.citationsVerified}</strong> citations verified
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onResumeSession && onResumeSession(s)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                >
                  <span>{s.isActive ? 'Continue Session' : 'Review Dialogue'}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
