import React from 'react'
import {
  RotateCcw,
  PanelLeft,
  PanelRight,
} from 'lucide-react'

export default function Header({
  materialsCount = 0,
  isLeftSidebarOpen = true,
  onToggleLeftSidebar,
  isRightPanelOpen = false,
  onToggleRightPanel,
  hasActiveSource = false,
  backendStatus = 'connected',
  onOpenBackendModal,
  conversationMode = 'multi-doc',
  onSwitchConversationMode,
  onResetConversation,
}) {
  return (
    <header className="h-16 px-4 sm:px-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 select-none z-10">
      {/* 1. Left: Sidebar Toggle & Product Brand/Context */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleLeftSidebar}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          title={isLeftSidebarOpen ? 'Collapse Materials Sidebar' : 'Open Materials Sidebar'}
          aria-label="Toggle Materials Sidebar"
        >
          <PanelLeft className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-none truncate">
              The Night Before
            </h1>
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {materialsCount > 0
                ? `${materialsCount} materials indexed`
                : 'Study workspace'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">
            Your grounded study assistant
          </p>
        </div>
      </div>

      {/* 2. Right: Action Controls */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Quick Demo Mode Selector */}
        <div className="hidden sm:flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
          <button
            type="button"
            onClick={() => onSwitchConversationMode('multi-doc')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-xs font-semibold ${
              conversationMode === 'multi-doc'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Demonstrate multi-document synthesized answer"
          >
            Multi-Doc Demo
          </button>
          <button
            type="button"
            onClick={() => onSwitchConversationMode('not-covered')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-xs font-semibold ${
              conversationMode === 'not-covered'
                ? 'bg-white text-amber-800 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Demonstrate strict refusal for out-of-domain query"
          >
            Refusal Demo
          </button>
        </div>

        {/* Reset / New Question Button */}
        <button
          type="button"
          onClick={onResetConversation}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Reset conversation and start a new question"
          aria-label="Reset conversation"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Toggle Source Panel if active citation exists */}
        {hasActiveSource && (
          <button
            type="button"
            onClick={onToggleRightPanel}
            className={`p-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              isRightPanelOpen
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            title="Toggle Source Inspector"
            aria-label="Toggle Source Inspector"
          >
            <PanelRight className="w-4 h-4 text-indigo-600" />
            <span className="hidden md:inline">Sources</span>
          </button>
        )}

        {/* Backend Status Pill */}
        <button
          type="button"
          onClick={onOpenBackendModal}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
            backendStatus === 'connected'
              ? 'border-emerald-200 bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100'
              : 'border-rose-200 bg-rose-50/80 text-rose-800 hover:bg-rose-100'
          }`}
          title="FastAPI backend status check"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              backendStatus === 'connected' ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
          />
          <span className="hidden sm:inline">
            {backendStatus === 'connected' ? 'Backend Live' : 'Backend Offline'}
          </span>
        </button>
      </div>
    </header>
  )
}
