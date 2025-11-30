// src/services/chatbotService.js
// RAG Chatbot API service
// Configure the backend URL - update this to match your FastAPI backend
const RAG_API_BASE_URL = import.meta.env.VITE_RAG_API_BASE_URL || 'http://localhost:8000'

const ragApiClient = async (endpoint, options = {}) => {
  const url = `${RAG_API_BASE_URL}${endpoint}`
  
  const defaultHeaders = {}
  
  // For file uploads, don't set Content-Type - let browser set it with boundary
  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json'
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  }

  try {
    const response = await fetch(url, config)
    
    const contentType = response.headers.get('content-type')
    const data = contentType?.includes('application/json') 
      ? await response.json() 
      : await response.text()
    
    if (!response.ok) {
      throw new Error(data.detail || data.message || data || `HTTP error! status: ${response.status}`)
    }
    
    return data
  } catch (error) {
    console.error('RAG API Error:', error)
    throw error
  }
}

// Chat endpoints
export const createChatSession = async (sessionId = null) => {
  const body = sessionId ? { session_id: sessionId } : {}
  return ragApiClient('/chat/session', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export const getChatSession = async (sessionId) => {
  return ragApiClient(`/chat/session/${sessionId}`)
}

export const sendChatMessage = async (sessionId, message, useRag = true) => {
  return ragApiClient('/chat/message', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      message,
      use_rag: useRag,
    }),
  })
}

export const clearChatSession = async (sessionId) => {
  return ragApiClient(`/chat/session/${sessionId}`, {
    method: 'DELETE',
  })
}

// Document endpoints
export const uploadDocument = async (file, metadata = null) => {
  const formData = new FormData()
  formData.append('file', file)
  if (metadata) {
    formData.append('metadata', metadata)
  }
  
  return ragApiClient('/documents/upload', {
    method: 'POST',
    body: formData,
  })
}

export const uploadMultipleDocuments = async (files) => {
  const formData = new FormData()
  files.forEach(file => {
    formData.append('files', file)
  })
  
  return ragApiClient('/documents/upload-multiple', {
    method: 'POST',
    body: formData,
  })
}

export const listDocuments = async () => {
  return ragApiClient('/documents/list')
}

export const deleteDocument = async (documentId) => {
  return ragApiClient(`/documents/${documentId}`, {
    method: 'DELETE',
  })
}

export const searchDocuments = async (query, topK = 5) => {
  return ragApiClient(`/documents/search?query=${encodeURIComponent(query)}&top_k=${topK}`)
}

// Health check
export const checkHealth = async () => {
  return ragApiClient('/health')
}

