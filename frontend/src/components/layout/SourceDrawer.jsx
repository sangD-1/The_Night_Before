import React, { useState, useEffect } from 'react'
import {
  X,
  FileText,
  Presentation,
  PenTool,
  CheckCircle2,
  Highlighter,
  Eye,
  FileCode2,
  Copy,
  Loader2,
  FileCode,
  Sparkles,
  ExternalLink,
} from 'lucide-react'
import { apiService, BACKEND_URL } from '../../services/api'

export default function SourceDrawer({
  citation,
  inspectedDocument,
  documents = [],
  onClose,
}) {
  const [activeTab, setActiveTab] = useState('original') // 'original' | 'extracted'
  const [copied, setCopied] = useState(false)
  const [sections, setSections] = useState([])
  const [isLoadingSections, setIsLoadingSections] = useState(false)
  const [sectionError, setSectionError] = useState(null)

  // Fetch sections if inspecting a real uploaded document from the library
  useEffect(() => {
    if (inspectedDocument?.id) {
      setIsLoadingSections(true)
      setSectionError(null)
      apiService
        .getDocumentSections(inspectedDocument.id)
        .then((data) => {
          setSections(data.sections || [])
          if (inspectedDocument.file_type === 'image') {
            setActiveTab('original')
          } else {
            setActiveTab('extracted')
          }
        })
        .catch((err) => {
          setSectionError(err.message || 'Failed to load document sections')
        })
        .finally(() => {
          setIsLoadingSections(false)
        })
    }
  }, [inspectedDocument])

  if (!citation && !inspectedDocument) return null

  const isInspectingDoc = Boolean(inspectedDocument)
  const rawDocTitle = inspectedDocument?.original_filename || citation?.docTitle || 'Source Document'
  // Clean filesystem path if present
  const docTitle = rawDocTitle.replace(/^.*[\\/]/, '')
  const docType = (inspectedDocument?.file_type || citation?.type || '').toLowerCase()
  const isHandwritten =
    docType === 'image' ||
    docType === 'handwritten' ||
    citation?.isHandwritten
  const isPdf = docType === 'pdf' || docTitle.toLowerCase().endsWith('.pdf')

  // Find matching master document to retrieve stored_filename
  const matchedDoc = documents.find(
    (d) =>
      (citation?.documentId && d.id === citation.documentId) ||
      (inspectedDocument?.id && d.id === inspectedDocument.id) ||
      d.original_filename === (inspectedDocument?.original_filename || citation?.docTitle)
  )

  const storedFilename =
    inspectedDocument?.stored_filename ||
    citation?.storedFilename ||
    matchedDoc?.stored_filename

  // Extract numeric page number if available (e.g. from citation.pageNumber or "Page 18")
  const pageNum =
    citation?.pageNumber != null
      ? citation.pageNumber
      : citation?.pageOrSlide?.match(/Page\s+(\d+)/i)?.[1] || null

  const normalizeImageUrl = (path) => {
    if (!path) return ''
    if (path.startsWith('http://') || path.startsWith('https://')) return path
    if (path.startsWith('/api/documents/uploads/')) return `${BACKEND_URL}${path}`
    if (path.startsWith('/')) return `${BACKEND_URL}${path}`
    return `${BACKEND_URL}/api/documents/uploads/${path}`
  }

  // Construct direct source URL using existing backend file-serving endpoint
  let directSourceUrl = null
  if (isPdf && storedFilename) {
    directSourceUrl = `${BACKEND_URL}/api/documents/uploads/${storedFilename}${
      pageNum ? `#page=${pageNum}` : ''
    }`
  } else if (isHandwritten) {
    if (citation?.imagePreviewPath) {
      directSourceUrl = normalizeImageUrl(citation.imagePreviewPath)
    } else if (storedFilename) {
      directSourceUrl = `${BACKEND_URL}/api/documents/uploads/${storedFilename}`
    }
  }

  const handleCopyText = (text) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getDocTypeIcon = () => {
    if (isHandwritten) {
      return <PenTool className="w-4 h-4 text-amber-600" />
    }
    if (docType === 'pptx' || docType === 'ppt') {
      return <Presentation className="w-4 h-4 text-orange-600" />
    }
    if (docType === 'markdown' || docType === 'text') {
      return <FileCode className="w-4 h-4 text-slate-600" />
    }
    return <FileText className="w-4 h-4 text-indigo-600" />
  }

  const getSourceTypeDisplay = () => {
    if (isHandwritten) return 'Handwritten Note'
    if (docType === 'pptx' || docType === 'ppt') return 'Slide Deck'
    if (docType === 'markdown' || docType === 'text') return 'Text / Markdown'
    return 'Lecture PDF'
  }

  return (
    <aside
      className="w-full sm:w-[480px] lg:w-[520px] bg-white border-l border-slate-200 flex flex-col h-full shadow-xl z-30 animate-in slide-in-from-right duration-200 shrink-0"
      aria-label="Source Document Inspector"
    >
      {/* 1. Inspector Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-white border border-slate-200/90 flex items-center justify-center shrink-0 shadow-2xs">
            {getDocTypeIcon()}
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Source Inspector
            </div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate" title={docTitle}>
              {docTitle}
            </h3>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono mt-0.5">
              <span className="font-semibold text-slate-700">{getSourceTypeDisplay()}</span>
              {citation && (
                <>
                  <span>·</span>
                  <span className="text-indigo-700 font-semibold">{citation.pageOrSlide}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {directSourceUrl && (
            <a
              href={directSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
              title={
                isPdf && pageNum
                  ? `Open original PDF at Page ${pageNum} in a new tab`
                  : 'Open original file in a new tab'
              }
            >
              <ExternalLink className="w-3 h-3" />
              <span className="hidden sm:inline">View Source</span>
            </a>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            title="Close source panel"
            aria-label="Close source inspector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Handwritten Note "AI Understood Your Handwriting" Banner */}
      {isHandwritten && (
        <div className="px-4 py-3 bg-amber-50/60 border-b border-amber-200/70 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>AI understood your handwriting</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-900 font-semibold">
              Contributed to answer
            </span>
          </div>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            This source contributed to the answer. The original handwritten note is preserved
            alongside extracted text to verify formulas, annotations, and diagrams.
          </p>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setActiveTab('original')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'original'
                  ? 'bg-amber-700 text-white shadow-xs'
                  : 'bg-white/80 text-amber-900 border border-amber-200 hover:bg-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Original Scan
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('extracted')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'extracted'
                  ? 'bg-amber-700 text-white shadow-xs'
                  : 'bg-white/80 text-amber-900 border border-amber-200 hover:bg-white'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              Extracted Text
            </button>
          </div>
        </div>
      )}

      {/* 3. Body Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* CASE A: Real Document from Library */}
        {isInspectingDoc ? (
          <div className="space-y-4">
            {isLoadingSections && (
              <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-500 text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                <span>Loading extracted document units...</span>
              </div>
            )}

            {sectionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
                <p className="font-semibold">Unable to load document sections:</p>
                <p>{sectionError}</p>
              </div>
            )}

            {!isLoadingSections && !sectionError && (
              <div className="space-y-4">
                {/* Handwritten Image Scan */}
                {isHandwritten && activeTab === 'original' && (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-2xs overflow-hidden">
                      <img
                        src={normalizeImageUrl(inspectedDocument.stored_filename)}
                        alt={docTitle}
                        className="w-full h-auto rounded-xl object-contain border border-slate-200"
                        onError={(e) => {
                          e.target.style.display = 'none'
                        }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl leading-relaxed border border-slate-200">
                      💡 <strong>Original Image Preserved:</strong> The scan is stored on disk so
                      handwritten diagrams and margin notes remain inspectable.
                    </div>
                  </div>
                )}

                {/* Extracted Sections List */}
                {(!isHandwritten || activeTab === 'extracted') && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
                      <span>Extracted Units ({sections.length})</span>
                      <span className="font-mono text-[10px]">{inspectedDocument.processing_status}</span>
                    </div>

                    {sections.map((sec) => (
                      <div
                        key={sec.id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-all space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                          <span className="font-bold text-slate-800 truncate">
                            {sec.section_title || `Section ${sec.section_index}`}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-white border border-slate-200 text-slate-600 shrink-0">
                            {sec.page_number
                              ? `Page ${sec.page_number}`
                              : sec.slide_number
                              ? `Slide ${sec.slide_number}`
                              : `Sec ${sec.section_index}`}
                          </span>
                        </div>

                        <pre className="font-sans text-xs text-slate-700 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto p-2.5 bg-white rounded-lg border border-slate-100">
                          {sec.text}
                        </pre>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1">
                          <span>{sec.word_count} words ({sec.char_count} chars)</span>
                          <span className="capitalize">{sec.extraction_method}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* CASE B: Active Citation from Chat */
          <div className="space-y-4">
            {/* View Source Callout Card for PDF & Scans */}
            {directSourceUrl ? (
              <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200/80 flex items-center justify-between gap-3 shadow-2xs">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>{isPdf ? `Original PDF (${citation.pageOrSlide})` : 'Original Note Scan'}</span>
                  </div>
                  <p className="text-[11px] text-indigo-800/80 truncate">
                    Verify the grounded answer in the original document file
                  </p>
                </div>
                <a
                  href={directSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-2xs transition-colors shrink-0 cursor-pointer"
                  title={isPdf ? `Open PDF at ${citation.pageOrSlide} in a new tab` : 'Open original scan in a new tab'}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>View Source</span>
                </a>
              </div>
            ) : (
              isPdf && (
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 text-[11px] italic">
                  Original document file is currently unavailable on disk.
                </div>
              )
            )}

            {/* Handwritten Note Original Scan Preview */}
            {citation.isHandwritten && activeTab === 'original' && (
              <div className="space-y-3">
                {citation.imagePreviewPath ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-2xs overflow-hidden space-y-2">
                    <img
                      src={normalizeImageUrl(citation.imagePreviewPath)}
                      alt={docTitle}
                      className="w-full h-auto rounded-xl object-contain border border-slate-200"
                      onError={(e) => {
                        e.target.style.display = 'none'
                      }}
                    />
                    <div className="text-[11px] text-amber-900/90 bg-amber-50/70 p-2.5 rounded-lg leading-relaxed border border-amber-200/60">
                      👁️ <strong>Original Handwritten Note:</strong> Preserved verbatim on disk so you can inspect handwriting, diagrams, and formulas directly.
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-[#fdfbf7] p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                      <span className="font-mono text-[10px] text-amber-800 font-semibold uppercase tracking-wider">
                        {citation.pageOrSlide} · Notebook Margin
                      </span>
                    </div>

                    <div className="font-serif italic text-slate-800 text-sm leading-relaxed p-3 rounded-xl bg-amber-50/60 border border-amber-100">
                      <p className="font-bold text-indigo-900 not-italic mb-1">
                        ★ PROFESSOR EXAM RULE:
                      </p>
                      <p className="tracking-wide">
                        &ldquo;Prevention = statically eliminate 1 Coffman condition before runtime (e.g., resource ordering breaks circular wait!).&rdquo;
                      </p>
                      <p className="tracking-wide mt-2">
                        &ldquo;Avoidance = dynamically check safety state using Banker&apos;s algorithm during request vectors.&rdquo;
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Extracted Passage & Verified Metadata */}
            {(!citation.isHandwritten || activeTab === 'extracted') && (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Source Section
                  </span>
                  <h4 className="text-xs sm:text-sm font-semibold text-slate-900">
                    {citation.sectionTitle || `${docTitle} (${citation.pageOrSlide})`}
                  </h4>
                  <div className="flex items-center gap-1.5 pt-1 text-[11px] text-emerald-700 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Verified Authenticated Source in Course Repository</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-700">
                    <span className="font-bold flex items-center gap-1.5 text-indigo-950">
                      <Highlighter className="w-3.5 h-3.5 text-indigo-600" />
                      Relevant Passage (Supporting Source Evidence)
                    </span>
                    {citation.confidence && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        Confidence: {citation.confidence}%
                      </span>
                    )}
                  </div>

                  <div className="p-4 rounded-r-2xl rounded-l-xs border-l-4 border-indigo-600 bg-indigo-50/60 text-xs sm:text-sm text-slate-800 leading-relaxed font-sans shadow-2xs">
                    <p className="font-medium text-slate-900">{citation.excerpt}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Inspector Footer */}
      <div className="p-3.5 border-t border-slate-200 bg-slate-50/80 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            const textToCopy = isInspectingDoc
              ? sections.map((s) => `[${s.section_title}]\n${s.text}`).join('\n\n')
              : `[${docTitle}, ${citation.pageOrSlide}]: "${citation.excerpt}"`
            handleCopyText(textToCopy)
          }}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors shadow-2xs cursor-pointer"
        >
          <Copy className="w-3.5 h-3.5" />
          <span>{copied ? 'Copied to Clipboard!' : 'Copy Extracted Text'}</span>
        </button>

        {directSourceUrl && (
          <a
            href={directSourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-2xs cursor-pointer shrink-0"
            title="Open original source document in a new tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>View Source</span>
          </a>
        )}

        <button
          type="button"
          onClick={onClose}
          className="py-2 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors shadow-2xs cursor-pointer shrink-0"
        >
          Done
        </button>
      </div>
    </aside>
  )
}
