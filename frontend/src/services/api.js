// Centralized API service layer for communicating with the FastAPI backend.
// Configured via environment variable with fallback to local development URL.

export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

export const apiService = {
  /**
   * Health check endpoint to verify backend connectivity.
   */
  async checkHealth() {
    const res = await fetch(`${BACKEND_URL}/api/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    }
    return res.json()
  },

  /**
   * Retrieve all persistently uploaded course materials.
   */
  async getDocuments() {
    const res = await fetch(`${BACKEND_URL}/api/documents`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      throw new Error(`Failed to fetch documents (HTTP ${res.status})`)
    }
    return res.json()
  },

  /**
   * Upload a single file with progress tracking via XMLHttpRequest.
   * @param {File} file
   * @param {function(number):void} onProgress - Progress callback percentage (0-100)
   * @returns {Promise<Object>}
   */
  uploadDocument(file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const formData = new FormData()
      formData.append('file', file)

      xhr.open('POST', `${BACKEND_URL}/api/documents/upload`)

      if (onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100)
            onProgress(percent)
          }
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText)
            resolve(response)
          } catch (e) {
            resolve({ success: true, text: xhr.responseText })
          }
        } else {
          try {
            const errorJson = JSON.parse(xhr.responseText)
            reject(new Error(errorJson.detail || `Upload failed with status ${xhr.status}`))
          } catch (e) {
            reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`))
          }
        }
      }

      xhr.onerror = () => {
        reject(new Error('Network error during upload. Ensure the backend server is running.'))
      }

      xhr.send(formData)
    })
  },

  /**
   * Triggers structured text extraction (pages, slides, sections, OCR).
   * @param {string} documentId
   */
  async processDocument(documentId) {
    const res = await fetch(`${BACKEND_URL}/api/documents/${documentId}/process`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || `Processing failed (HTTP ${res.status})`)
    }
    return res.json()
  },

  /**
   * Retrieves extracted pages, slides, or sections for inspection.
   * @param {string} documentId
   */
  async getDocumentSections(documentId) {
    const res = await fetch(`${BACKEND_URL}/api/documents/${documentId}/sections`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      throw new Error(`Failed to fetch extracted sections (HTTP ${res.status})`)
    }
    return res.json()
  },

  /**
   * Delete an uploaded document.
   * @param {string} documentId
   */
  async deleteDocument(documentId) {
    const res = await fetch(`${BACKEND_URL}/api/documents/${documentId}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      throw new Error(`Failed to delete document (HTTP ${res.status})`)
    }
    return res.json()
  },

  /**
   * Index or re-index a document's extracted chunks into ChromaDB vector store.
   * @param {string} documentId
   */
  async indexDocument(documentId) {
    const res = await fetch(`${BACKEND_URL}/api/retrieval/index/${documentId}`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || `Indexing failed (HTTP ${res.status})`)
    }
    return res.json()
  },

  /**
   * Batch index all processed documents into ChromaDB.
   */
  async indexAllDocuments() {
    const res = await fetch(`${BACKEND_URL}/api/retrieval/index-all`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || `Batch indexing failed (HTTP ${res.status})`)
    }
    return res.json()
  },

  /**
   * Execute semantic search over indexed course material vectors.
   * @param {string} query
   * @param {number} [topK=5]
   * @param {number} [threshold=null]
   * @param {string[]} [documentIds=null]
   */
  async semanticSearch(query, topK = 5, threshold = null, documentIds = null) {
    const payload = {
      query,
      top_k: topK,
    }
    if (threshold !== null && threshold !== undefined) {
      payload.similarity_threshold = threshold
    }
    if (documentIds && documentIds.length > 0) {
      payload.document_ids = documentIds
    }

    const res = await fetch(`${BACKEND_URL}/api/retrieval/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || `Semantic search failed (HTTP ${res.status})`)
    }
    return res.json()
  },

  /**
   * Fetch vector store statistics (total vectors, persistence directory, collection name).
   */
  async getRetrievalStatus() {
    const res = await fetch(`${BACKEND_URL}/api/retrieval/status`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      throw new Error(`Failed to fetch retrieval status (HTTP ${res.status})`)
    }
    return res.json()
  },

  /**
   * Send question to RAG pipeline for grounded answering.
   * @param {string} question
   * @param {string} [sessionId=null]
   * @param {string[]} [documentIds=null]
   */
  async sendChatMessage(question, sessionId = null, documentIds = null) {
    const payload = {
      question,
    }
    if (sessionId) {
      payload.session_id = sessionId
    }
    if (documentIds && documentIds.length > 0) {
      payload.document_ids = documentIds
    }

    const res = await fetch(`${BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || `Chat request failed (HTTP ${res.status})`)
    }
    return res.json()
  },

  /**
   * Fetch session conversation history.
   * @param {string} sessionId
   */
  async getChatHistory(sessionId) {
    const res = await fetch(`${BACKEND_URL}/api/chat/history/${sessionId}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      throw new Error(`Failed to fetch chat history (HTTP ${res.status})`)
    }
    return res.json()
  },

  /**
   * Clear session conversation history.
   * @param {string} sessionId
   */
  async clearChatHistory(sessionId) {
    const res = await fetch(`${BACKEND_URL}/api/chat/history/${sessionId}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      throw new Error(`Failed to clear chat history (HTTP ${res.status})`)
    }
    return res.json()
  },
}
