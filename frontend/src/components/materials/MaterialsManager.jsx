import React, { useState, useEffect, useCallback } from 'react'
import UploadZone from './UploadZone'
import DocumentCard from './DocumentCard'
import { SAMPLE_MATERIALS } from '../../data/mockData'
import { apiService } from '../../services/api'
import {
  Files,
  Search,
  RefreshCw,
  FolderDown,
  Sparkles,
  Layers,
  AlertCircle,
  FileCheck2,
} from 'lucide-react'

export default function MaterialsManager({
  onAskAboutDoc,
  onInspectDocument,
  onDocumentsUpdated,
}) {
  const [realDocuments, setRealDocuments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [activeTab, setActiveTab] = useState('uploaded') // 'uploaded' | 'demo'
  const [filterType, setFilterType] = useState('all') // 'all' | 'pdf' | 'pptx' | 'image' | 'markdown'
  const [searchQuery, setSearchQuery] = useState('')
  const [notification, setNotification] = useState(null)
  const [processingDocIds, setProcessingDocIds] = useState(new Set())
  const [indexingDocIds, setIndexingDocIds] = useState(new Set())
  const [isIndexingAll, setIsIndexingAll] = useState(false)
  const [retrievalStats, setRetrievalStats] = useState(null)

  const fetchRealDocuments = useCallback(async () => {
    setIsLoading(true)
    setFetchError(null)
    try {
      const data = await apiService.getDocuments()
      setRealDocuments(data.documents || [])
      if (onDocumentsUpdated) {
        onDocumentsUpdated(data.documents || [])
      }
    } catch (err) {
      setFetchError(err.message || 'Failed to fetch uploaded documents')
    } finally {
      setIsLoading(false)
    }
  }, [onDocumentsUpdated])

  const fetchRetrievalStats = useCallback(async () => {
    try {
      const stats = await apiService.getRetrievalStatus()
      setRetrievalStats(stats)
    } catch (e) {
      // Non-blocking if vector store is starting up
    }
  }, [])

  useEffect(() => {
    fetchRealDocuments()
    fetchRetrievalStats()
  }, [fetchRealDocuments, fetchRetrievalStats])

  const handleUploadSuccess = (newDoc) => {
    fetchRealDocuments()
    fetchRetrievalStats()
    setNotification({
      type: 'success',
      message: `"${newDoc.original_filename}" uploaded, extracted, and indexed into ChromaDB!`,
    })
    setTimeout(() => setNotification(null), 5000)
  }

  const handleProcessDocument = async (docId) => {
    setProcessingDocIds((prev) => new Set(prev).add(docId))
    try {
      const res = await apiService.processDocument(docId)
      fetchRealDocuments()
      setNotification({
        type: 'success',
        message: `Extracted ${res.total_units_extracted} section(s) from "${res.original_filename}".`,
      })
      setTimeout(() => setNotification(null), 5000)
    } catch (err) {
      setNotification({
        type: 'error',
        message: err.message || 'Extraction failed',
      })
    } finally {
      setProcessingDocIds((prev) => {
        const next = new Set(prev)
        next.delete(docId)
        return next
      })
    }
  }

  const handleIndexDocument = async (docId) => {
    setIndexingDocIds((prev) => new Set(prev).add(docId))
    try {
      const res = await apiService.indexDocument(docId)
      fetchRealDocuments()
      fetchRetrievalStats()
      setNotification({
        type: 'success',
        message: `Indexed ${res.total_chunks_indexed} chunk(s) from "${res.original_filename}" into ChromaDB!`,
      })
      setTimeout(() => setNotification(null), 5000)
    } catch (err) {
      setNotification({
        type: 'error',
        message: err.message || 'Indexing failed',
      })
    } finally {
      setIndexingDocIds((prev) => {
        const next = new Set(prev)
        next.delete(docId)
        return next
      })
    }
  }

  const handleIndexAll = async () => {
    setIsIndexingAll(true)
    try {
      const res = await apiService.indexAllDocuments()
      fetchRealDocuments()
      fetchRetrievalStats()
      setNotification({
        type: 'success',
        message: `Batch indexed ${res.indexed_documents_count} document(s) (${res.total_chunks_indexed} total chunks) into ChromaDB!`,
      })
      setTimeout(() => setNotification(null), 6000)
    } catch (err) {
      setNotification({
        type: 'error',
        message: err.message || 'Batch indexing failed',
      })
    } finally {
      setIsIndexingAll(false)
    }
  }

  const handleDeleteDocument = async (id) => {
    try {
      await apiService.deleteDocument(id)
      setRealDocuments((prev) => prev.filter((d) => d.id !== id))
      fetchRetrievalStats()
      setNotification({
        type: 'info',
        message: 'Document and vectors removed from ChromaDB.',
      })
      setTimeout(() => setNotification(null), 4000)
    } catch (err) {
      setNotification({
        type: 'error',
        message: err.message || 'Failed to delete document',
      })
    }
  }

  const displayedList = activeTab === 'uploaded' ? realDocuments : SAMPLE_MATERIALS

  const filteredDocuments = displayedList.filter((doc) => {
    const docType = (doc.file_type || doc.type || '').toLowerCase()
    const matchesFilter =
      filterType === 'all' ||
      docType === filterType ||
      (filterType === 'image' && (docType === 'image' || docType === 'handwritten')) ||
      (filterType === 'markdown' && (docType === 'markdown' || docType === 'text'))

    const searchTarget = (
      (doc.original_filename || doc.filename || doc.title || '') +
      ' ' +
      (doc.summary || '') +
      ' ' +
      (doc.tags ? doc.tags.join(' ') : '')
    ).toLowerCase()

    const matchesSearch = searchTarget.includes(searchQuery.toLowerCase())

    return matchesFilter && matchesSearch
  })

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header & Stats Overview */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Files className="w-5 h-5 text-indigo-600" />
              Course Study Materials
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Upload course PDFs, slides, readings, and handwritten scans.
              Text is extracted page-by-page and slide-by-slide, then embedded into ChromaDB for semantic retrieval.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 font-medium text-slate-700 shadow-2xs">
              <strong>{realDocuments.length}</strong> real uploads
            </span>
            {retrievalStats && (
              <span className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 font-semibold text-emerald-800 shadow-2xs">
                <strong>{retrievalStats.total_chunks_in_vector_store}</strong> Chroma vectors
              </span>
            )}
            <button
              type="button"
              onClick={handleIndexAll}
              disabled={isIndexingAll || realDocuments.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              title="Batch index all extracted documents into ChromaDB"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isIndexingAll ? 'animate-spin' : ''}`} />
              <span>{isIndexingAll ? 'Indexing...' : 'Index All'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                fetchRealDocuments()
                fetchRetrievalStats()
              }}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
              title="Refresh document repository and vector stats"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Inline Notification Banner */}
        {notification && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center justify-between animate-in fade-in ${
              notification.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : notification.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-indigo-50 border-indigo-200 text-indigo-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{notification.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>
        )}

        {/* Real Document Upload Dropzone */}
        <UploadZone onUploadSuccess={handleUploadSuccess} />

        {/* Retrieval State Explanation Alert */}
        <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100 flex items-start gap-2.5 text-xs text-indigo-900 leading-relaxed">
          <Layers className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Step 6 Semantic Retrieval Foundation Active: </span>
            Documents are chunked with page and slide boundary preservation and embedded with local ONNX <code className="font-mono text-indigo-800 bg-indigo-100/60 px-1 py-0.5 rounded">all-MiniLM-L6-v2</code> (384-dim).
            Vectors are stored persistently in ChromaDB at <code className="font-mono text-indigo-800 bg-indigo-100/60 px-1 py-0.5 rounded">backend/data/chroma_db</code> with strict cosine similarity thresholding.
          </div>
        </div>

        {/* Repository Tab Switcher & Filters */}
        <div className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            {/* View Tabs */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('uploaded')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'uploaded'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>My Uploaded Materials</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                    activeTab === 'uploaded'
                      ? 'bg-indigo-700 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {realDocuments.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('demo')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'demo'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>Sample Demo Materials</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                    activeTab === 'demo'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {SAMPLE_MATERIALS.length}
                </span>
              </button>
            </div>

            {/* Search & Type Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter materials..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 w-40 sm:w-48"
                />
              </div>

              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'pdf', label: 'PDF' },
                  { id: 'pptx', label: 'Slides' },
                  { id: 'image', label: 'Images/Scans' },
                  { id: 'markdown', label: 'Text/MD' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilterType(f.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                      filterType === f.id
                        ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Error notice if fetch failed */}
          {fetchError && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Backend offline or unreachable. Displaying demo items.</span>
              </div>
              <button
                type="button"
                onClick={fetchRealDocuments}
                className="underline font-semibold"
              >
                Retry
              </button>
            </div>
          )}

          {/* Cards Grid */}
          <div className="grid sm:grid-cols-2 gap-4">
            {filteredDocuments.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                isDemo={activeTab === 'demo'}
                isProcessing={processingDocIds.has(doc.id)}
                isIndexing={indexingDocIds.has(doc.id)}
                onDelete={handleDeleteDocument}
                onProcess={handleProcessDocument}
                onIndex={handleIndexDocument}
                onInspectDoc={onInspectDocument}
                onAskAboutDoc={onAskAboutDoc}
              />
            ))}
          </div>

          {/* Empty State when no uploads exist */}
          {filteredDocuments.length === 0 && (
            <div className="text-center py-12 rounded-xl border border-dashed border-slate-300 bg-white/60 p-8 space-y-3">
              <div className="w-10 h-10 mx-auto rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                <FolderDown className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {activeTab === 'uploaded'
                    ? 'No course documents uploaded yet'
                    : 'No demo documents match your filter'}
                </p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                  {activeTab === 'uploaded'
                    ? 'Use the upload zone above to add your lecture PDFs, slides, or scanned notes.'
                    : 'Try clearing your search query or selecting "All".'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
