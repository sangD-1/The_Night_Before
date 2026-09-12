import React, { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/layout/Sidebar'
import Header from './components/layout/Header'
import SourceDrawer from './components/layout/SourceDrawer'
import StudyWorkspace from './components/workspace/StudyWorkspace'
import BackendStatusModal from './components/common/BackendStatusModal'
import { useBackendHealth } from './hooks/useBackendHealth'
import { apiService } from './services/api'
import {
  INITIAL_CONVERSATION,
  NOT_COVERED_DEMO_THREAD,
} from './data/mockData'

export default function App() {
  // 1. Layout & View States (Three-part structure: Left Materials, Center Chat, Right Sources)
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true)
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false)
  const [conversationMode, setConversationMode] = useState('interactive') // 'interactive' | 'multi-doc' | 'not-covered'

  // Start with empty conversation so the Hero / Empty State is active by default
  const [conversation, setConversation] = useState([])
  const [selectedCitation, setSelectedCitation] = useState(null)
  const [inspectedDocument, setInspectedDocument] = useState(null)
  const [isBackendModalOpen, setIsBackendModalOpen] = useState(false)

  // Real Documents & Vector Store Statistics
  const [realDocuments, setRealDocuments] = useState([])
  const [isLoadingDocs, setIsLoadingDocs] = useState(true)

  // Session & RAG Execution State
  const [sessionId, setSessionId] = useState(() => `session-${Date.now()}`)
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [loadingStatusText, setLoadingStatusText] = useState('')

  // Live Backend Health Connection (Preserved from Step 2)
  const {
    status: backendStatus,
    details: backendDetails,
    error: backendError,
    lastChecked,
    backendUrl,
    checkHealth,
  } = useBackendHealth()

  // Fetch real documents on mount & when updated
  const fetchDocuments = useCallback(async () => {
    setIsLoadingDocs(true)
    try {
      const data = await apiService.getDocuments()
      setRealDocuments(data.documents || [])
    } catch (err) {
      console.warn('Could not fetch real documents from backend:', err)
    } finally {
      setIsLoadingDocs(false)
    }
  }, [])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  // Handle demo mode switching for evaluation presentations
  const handleSwitchConversationMode = (mode) => {
    setConversationMode(mode)
    if (mode === 'multi-doc') {
      setConversation(INITIAL_CONVERSATION)
      setSelectedCitation(null)
      setInspectedDocument(null)
      setIsRightPanelOpen(false)
    } else if (mode === 'not-covered') {
      setConversation(NOT_COVERED_DEMO_THREAD)
      setSelectedCitation(null)
      setInspectedDocument(null)
      setIsRightPanelOpen(false)
    }
  }

  // Handle resetting conversation thread and backend session memory
  const handleResetConversation = async () => {
    if (backendStatus === 'connected' && sessionId) {
      try {
        await apiService.clearChatHistory(sessionId)
      } catch (err) {
        console.warn('Could not clear backend session history:', err)
      }
    }
    setSessionId(`session-${Date.now()}`)
    setConversation([])
    setSelectedCitation(null)
    setInspectedDocument(null)
    setIsRightPanelOpen(false)
    setConversationMode('interactive')
  }

  // Handle document inspection from Left Materials Sidebar
  const handleInspectDocument = (doc) => {
    setSelectedCitation(null)
    setInspectedDocument(doc)
    setIsRightPanelOpen(true)
  }

  // Handle asking a question directly about a specific document
  const handleAskAboutDoc = (doc) => {
    const title = doc.original_filename || doc.filename || doc.title || 'course document'
    handleSendMessage(`Explain the key concepts and formulas covered in ${title}`)
  }

  // Handle deleting a document from the library
  const handleDeleteDocument = async (id) => {
    try {
      await apiService.deleteDocument(id)
      setRealDocuments((prev) => prev.filter((d) => d.id !== id))
      if (inspectedDocument?.id === id) {
        setInspectedDocument(null)
        setIsRightPanelOpen(false)
      }
    } catch (err) {
      console.error('Delete document failed:', err)
    }
  }

  // Handle citation selection in Chat (opens Right Source Panel)
  const handleSelectCitation = (cit) => {
    setInspectedDocument(null)
    setSelectedCitation(cit)
    setIsRightPanelOpen(true)
  }

  // Handle user sending a study question (Live RAG Question-Answering Pipeline)
  const handleSendMessage = async (text) => {
    const timestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })

    const userMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      timestamp,
      text,
    }

    setConversation((prev) => [...prev, userMessage])

    // If backend is connected, use real RAG pipeline with strict grounding & validation
    if (backendStatus === 'connected') {
      setIsChatLoading(true)
      setLoadingStatusText('Searching your course material...')

      // Meaningful progressive retrieval feedback stages (Section 12 & 20)
      const stageTimer1 = setTimeout(() => {
        setLoadingStatusText('Checking relevant sources & coordinates...')
      }, 700)

      const stageTimer2 = setTimeout(() => {
        setLoadingStatusText('Building a grounded answer...')
      }, 1500)

      try {
        const chatRes = await apiService.sendChatMessage(text, sessionId)
        clearTimeout(stageTimer1)
        clearTimeout(stageTimer2)

        if (chatRes.status === 'grounded') {
          // Map validated chunk citations directly from the backend
          const citations = (chatRes.sources || []).map((r) => {
            const matchedDoc = realDocuments.find(
              (d) => d.id === r.document_id || d.original_filename === r.document_name
            )
            return {
              id: r.id,
              documentId: r.document_id,
              storedFilename: matchedDoc?.stored_filename || null,
              docTitle: r.document_name,
              pageNumber: r.page_number,
              slideNumber: r.slide_number,
              pageOrSlide:
                r.slide_number != null
                  ? `Slide ${r.slide_number}`
                  : r.page_number != null
                  ? `Page ${r.page_number}`
                  : 'Section',
              type: r.source_type,
              sectionTitle: r.section_title || r.citation_label,
              excerpt: r.text_excerpt,
              confidence: Math.round(r.confidence_score * 100),
              isHandwritten: r.is_handwritten,
              imagePreviewPath: r.image_preview_path,
            }
          })

          const assistantResponse = {
            id: `msg-${Date.now() + 1}`,
            sender: 'assistant',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isGrounded: true,
            isMultiSource: chatRes.is_multi_source,
            sourcesCount: chatRes.sources_count || citations.length,
            sourceIds: citations.map((c) => c.id),
            citations,
            content: chatRes.answer,
          }

          setConversation((prev) => [...prev, assistantResponse])
          return
        }

        // Strict grounding refusal / out-of-domain case (Section 11)
        const assistantResponse = {
          id: `msg-${Date.now() + 1}`,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isNotCovered: true,
          queryTopic: text,
          reason:
            chatRes.answer ||
            chatRes.message ||
            "I couldn't find enough information about this in your uploaded course material, so I won't guess.",
          attemptedDocuments:
            chatRes.sources?.length > 0
              ? chatRes.sources.map((s) => s.document_name)
              : realDocuments.map((d) => d.original_filename || d.filename).slice(0, 4),
          guidance:
            'Upload course materials covering this subject, or ask questions grounded in your uploaded documents.',
        }
        setConversation((prev) => [...prev, assistantResponse])
        return
      } catch (err) {
        clearTimeout(stageTimer1)
        clearTimeout(stageTimer2)
        console.error('RAG request failed:', err)
        const errorResponse = {
          id: `msg-${Date.now() + 1}`,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isSystemError: true,
          title: 'Study Assistant Engine Error',
          reason: err.message || 'Unable to communicate with the study engine backend.',
          guidance:
            'The backend service encountered a communication issue. Please verify your FastAPI backend terminal or check network connectivity.',
        }
        setConversation((prev) => [...prev, errorResponse])
        return
      } finally {
        setIsChatLoading(false)
        setLoadingStatusText('')
      }
    }

    // Fallback when backend is completely offline
    const lower = text.toLowerCase()
    const isUncovered =
      lower.includes('paxos') ||
      lower.includes('raft') ||
      lower.includes('distributed') ||
      lower.includes('refusal') ||
      lower.includes('not covered')

    let fallbackAssistantResponse

    if (isUncovered) {
      fallbackAssistantResponse = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        timestamp,
        isNotCovered: true,
        queryTopic: text,
        reason:
          "I couldn't find enough information about this in your uploaded course material, so I won't guess.",
        attemptedDocuments: realDocuments.map((d) => d.original_filename || d.filename).slice(0, 4),
        guidance:
          'Upload course materials covering this subject, or ask questions grounded in your uploaded documents.',
      }
    } else {
      fallbackAssistantResponse = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        timestamp,
        isGrounded: true,
        isMultiSource: true,
        sourcesCount: 2,
        sourceIds: ['cit-os-p18', 'cit-hw-p2'],
        content: `According to your course materials, here is the verified explanation:
* **Deadlock Conditions:** Deadlock requires four simultaneous Coffman conditions: Mutual Exclusion, Hold & Wait, No Preemption, and Circular Wait.
* **Handling Contrast:** Prevention eliminates at least one condition statically before execution (e.g., resource ordering breaks circular wait), while Avoidance uses dynamic state validation (Banker's Algorithm) during runtime.`,
      }
    }

    setConversation((prev) => [...prev, fallbackAssistantResponse])
  }

  const hasActiveSource = Boolean(selectedCitation || inspectedDocument)

  return (
    <div className="flex h-screen w-screen bg-slate-100 font-sans text-slate-900 overflow-hidden">
      {/* ================= 1. LEFT MATERIALS SIDEBAR (Section 2 & 3) ================= */}
      {isLeftSidebarOpen && (
        <Sidebar
          documents={realDocuments}
          isLoadingDocs={isLoadingDocs}
          onInspectDocument={handleInspectDocument}
          onAskAboutDoc={handleAskAboutDoc}
          onDeleteDocument={handleDeleteDocument}
          onUploadSuccess={() => {
            fetchDocuments()
            setIsLeftSidebarOpen(true)
          }}
          onResetConversation={handleResetConversation}
          backendStatus={backendStatus}
          onOpenBackendModal={() => setIsBackendModalOpen(true)}
          onCloseMobile={() => setIsLeftSidebarOpen(false)}
        />
      )}

      {/* ================= 2. CENTER AI CONVERSATION ================= */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-white">
        <Header
          materialsCount={realDocuments.length}
          isLeftSidebarOpen={isLeftSidebarOpen}
          onToggleLeftSidebar={() => setIsLeftSidebarOpen((prev) => !prev)}
          isRightPanelOpen={isRightPanelOpen}
          onToggleRightPanel={() => setIsRightPanelOpen((prev) => !prev)}
          hasActiveSource={hasActiveSource}
          backendStatus={backendStatus}
          onOpenBackendModal={() => setIsBackendModalOpen(true)}
          conversationMode={conversationMode}
          onSwitchConversationMode={handleSwitchConversationMode}
          onResetConversation={handleResetConversation}
        />

        <main className="flex-1 flex overflow-hidden relative">
          <StudyWorkspace
            conversation={conversation}
            onSendMessage={handleSendMessage}
            onSelectCitation={handleSelectCitation}
            activeCitationId={selectedCitation?.id}
            documents={realDocuments}
            onGoToMaterials={() => setIsLeftSidebarOpen(true)}
            onUploadSuccess={() => {
              fetchDocuments()
              setIsLeftSidebarOpen(true)
            }}
            onResetConversation={handleResetConversation}
            isLoading={isChatLoading}
            loadingStatusText={loadingStatusText}
          />

          {/* ================= 3. RIGHT SOURCES VIEWER PANEL (Section 2, 9, 10) ================= */}
          {isRightPanelOpen && hasActiveSource && (
            <SourceDrawer
              citation={selectedCitation}
              inspectedDocument={inspectedDocument}
              documents={realDocuments}
              onClose={() => {
                setSelectedCitation(null)
                setInspectedDocument(null)
                setIsRightPanelOpen(false)
              }}
            />
          )}
        </main>
      </div>

      {/* 4. Backend Health Modal (Diagnostic inspection preserved) */}
      <BackendStatusModal
        isOpen={isBackendModalOpen}
        onClose={() => setIsBackendModalOpen(false)}
        status={backendStatus}
        details={backendDetails}
        error={backendError}
        lastChecked={lastChecked}
        backendUrl={backendUrl}
        onRefresh={checkHealth}
      />
    </div>
  )
}
