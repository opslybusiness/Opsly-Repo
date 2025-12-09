import { useState, useEffect, useRef } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { 
  uploadDocument, 
  uploadMultipleDocuments,
  listDocuments, 
  deleteDocument,
  listChatSessions,
  getChatSession
} from '../services/chatbotService'
import { HiPaperClip, HiX, HiTrash, HiUpload, HiChat, HiClock, HiRefresh } from 'react-icons/hi'
import { FaRobot, FaUser } from 'react-icons/fa'

function RAGChatbot() {
  const [chatSessions, setChatSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [sessionMessages, setSessionMessages] = useState([])
  const [documents, setDocuments] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({})
  const [showDocumentList, setShowDocumentList] = useState(false)
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)

  // Load sessions and documents on mount
  useEffect(() => {
    loadChatSessions()
    loadDocuments()
  }, [])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [sessionMessages])

  // Load chat sessions when a session is selected
  useEffect(() => {
    if (selectedSession) {
      loadSessionMessages(selectedSession)
    }
  }, [selectedSession])

  const loadChatSessions = async () => {
    setIsLoadingSessions(true)
    try {
      // Try to get sessions from API, fallback to empty array if not available
      try {
        const sessions = await listChatSessions()
        setChatSessions(sessions || [])
      } catch (error) {
        console.error('Failed to load chat sessions:', error)
        // If API doesn't exist yet, use empty array
        setChatSessions([])
      }
    } catch (error) {
      console.error('Failed to load chat sessions:', error)
      setChatSessions([])
    } finally {
      setIsLoadingSessions(false)
    }
  }

  const loadSessionMessages = async (session) => {
    setIsLoadingMessages(true)
    try {
      const sessionData = await getChatSession(session.session_id || session.id)
      // Convert session messages to our format
      const messages = sessionData.messages || sessionData.history || []
      setSessionMessages(messages.map(msg => ({
        role: msg.role || (msg.type === 'user' ? 'user' : 'assistant'),
        content: msg.content || msg.message || '',
        timestamp: msg.timestamp || new Date().toISOString(),
        sources: msg.sources || []
      })))
    } catch (error) {
      console.error('Failed to load session messages:', error)
      setSessionMessages([{
        role: 'assistant',
        content: 'Unable to load chat history. The session may not exist or the backend may be unavailable.',
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setIsLoadingMessages(false)
    }
  }

  const loadDocuments = async () => {
    try {
      const docs = await listDocuments()
      setDocuments(docs || [])
    } catch (error) {
      console.error('Failed to load documents:', error)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date'
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffTime = Math.abs(now - date)
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays === 1) return 'Today'
      if (diffDays === 2) return 'Yesterday'
      if (diffDays < 7) return `${diffDays - 1} days ago`
      
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
      })
    } catch {
      return 'Unknown date'
    }
  }

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return

    const fileArray = Array.from(files)
    setIsUploading(true)
    
    try {
      if (fileArray.length === 1) {
        setUploadProgress({ [fileArray[0].name]: 'uploading' })
        await uploadDocument(fileArray[0])
        setUploadProgress({ [fileArray[0].name]: 'success' })
      } else {
        fileArray.forEach(file => {
          setUploadProgress(prev => ({ ...prev, [file.name]: 'uploading' }))
        })
        await uploadMultipleDocuments(fileArray)
        fileArray.forEach(file => {
          setUploadProgress(prev => ({ ...prev, [file.name]: 'success' }))
        })
      }
      
      // Reload documents list
      await loadDocuments()
      
      // Clear progress after a delay
      setTimeout(() => {
        setUploadProgress({})
      }, 2000)
    } catch (error) {
      console.error('Failed to upload documents:', error)
      fileArray.forEach(file => {
        setUploadProgress(prev => ({ ...prev, [file.name]: 'error' }))
      })
      alert(`Failed to upload documents: ${error.message}`)
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileSelect = (e) => {
    handleFileUpload(e.target.files)
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    handleFileUpload(e.dataTransfer.files)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDeleteDocument = async (documentId, filename) => {
    if (!window.confirm(`Are you sure you want to delete ${filename}?`)) return

    try {
      await deleteDocument(documentId)
      await loadDocuments()
    } catch (error) {
      console.error('Failed to delete document:', error)
      alert(`Failed to delete document: ${error.message}`)
    }
  }

  const handleRefreshSessions = () => {
    loadChatSessions()
  }

  return (
    <DashboardLayout userName="User">
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Chatbot Management</h1>
            <p className="text-gray-400">Manage documents and view customer chat history</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setShowDocumentList(!showDocumentList)}
              className="px-4 py-2 bg-opsly-purple text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
            >
              <HiPaperClip className="text-xl" />
              Documents ({documents.length})
            </button>
            <button
              onClick={handleRefreshSessions}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition flex items-center gap-2"
            >
              <HiRefresh className="text-xl" />
              Refresh
            </button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
          {/* Document Upload Section */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            <div className="bg-opsly-card rounded-lg p-6 flex-1">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <HiUpload className="text-opsly-purple" />
                Upload Documents
              </h2>
              
              {/* File Upload Area */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-opsly-purple transition cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <HiPaperClip className="text-4xl text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400 mb-2">Drag & drop files here</p>
                <p className="text-sm text-gray-500 mb-4">or click to browse</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.txt,.doc,.docx,.md"
                />
                <button className="px-4 py-2 bg-opsly-purple text-white rounded-lg hover:bg-purple-700 transition">
                  Select Files
                </button>
              </div>

              {/* Upload Progress */}
              {Object.keys(uploadProgress).length > 0 && (
                <div className="mt-4 space-y-2">
                  {Object.entries(uploadProgress).map(([filename, status]) => (
                    <div key={filename} className="flex items-center justify-between text-sm">
                      <span className="text-gray-400 truncate">{filename}</span>
                      <span className={`${
                        status === 'success' ? 'text-green-500' : 
                        status === 'error' ? 'text-red-500' : 
                        'text-yellow-500'
                      }`}>
                        {status === 'success' ? '✓' : status === 'error' ? '✗' : '...'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Document List */}
              {showDocumentList && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-white mb-3">Uploaded Documents</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto hide-scrollbar">
                    {documents.length === 0 ? (
                      <p className="text-gray-400 text-sm">No documents uploaded yet</p>
                    ) : (
                      documents.map((doc) => (
                        <div
                          key={doc.id || doc.file_id}
                          className="flex items-center justify-between bg-opsly-dark rounded-lg p-3 hover:bg-gray-800 transition"
                        >
                          <span className="text-gray-300 text-sm truncate flex-1">
                            {doc.filename || doc.name || 'Untitled'}
                          </span>
                          <button
                            onClick={() => handleDeleteDocument(doc.id || doc.file_id, doc.filename || doc.name)}
                            className="ml-2 text-red-400 hover:text-red-500 transition"
                          >
                            <HiTrash className="text-lg" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Chat Sessions List */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <HiChat className="text-opsly-purple" />
                  Customer Chats
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto hide-scrollbar">
                  {isLoadingSessions ? (
                    <div className="text-center py-4">
                      <div className="inline-flex gap-1">
                        <div className="w-2 h-2 bg-opsly-purple rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-opsly-purple rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-opsly-purple rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  ) : chatSessions.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-4">No chat sessions yet</p>
                  ) : (
                    chatSessions.map((session) => (
                      <button
                        key={session.session_id || session.id}
                        onClick={() => setSelectedSession(session)}
                        className={`w-full text-left bg-opsly-dark rounded-lg p-3 hover:bg-gray-800 transition ${
                          selectedSession?.session_id === session.session_id || selectedSession?.id === session.id
                            ? 'ring-2 ring-opsly-purple bg-gray-800'
                            : ''
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-gray-300 text-sm font-medium truncate">
                            Session {session.session_id?.substring(0, 8) || session.id?.substring(0, 8) || 'Unknown'}
                          </span>
                          <HiClock className="text-gray-500 text-xs flex-shrink-0 ml-2" />
                        </div>
                        <p className="text-gray-500 text-xs">
                          {formatDate(session.created_at || session.timestamp || session.date)}
                        </p>
                        {session.message_count !== undefined && (
                          <p className="text-gray-500 text-xs mt-1">
                            {session.message_count} messages
                          </p>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Chat History Viewer */}
          <div className="lg:col-span-2 flex flex-col bg-opsly-card rounded-lg p-6">
            {!selectedSession ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <HiChat className="text-6xl text-opsly-purple mb-4" />
                <h3 className="text-2xl font-semibold text-white mb-2">Select a Chat Session</h3>
                <p className="text-gray-400 max-w-md">
                  Choose a customer chat session from the list to view the conversation history.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-700">
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      Session {selectedSession.session_id?.substring(0, 8) || selectedSession.id?.substring(0, 8) || 'Unknown'}
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                      {formatDate(selectedSession.created_at || selectedSession.timestamp || selectedSession.date)}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedSession(null)}
                    className="text-gray-400 hover:text-white transition"
                  >
                    <HiX className="text-xl" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto mb-4 space-y-4 min-h-0 hide-scrollbar">
                  {isLoadingMessages ? (
                    <div className="flex justify-center items-center h-full">
                      <div className="flex gap-2">
                        <div className="w-2 h-2 bg-opsly-purple rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-opsly-purple rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-opsly-purple rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  ) : sessionMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <FaRobot className="text-4xl text-gray-600 mb-3" />
                      <p className="text-gray-400">No messages in this session</p>
                    </div>
                  ) : (
                    sessionMessages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex gap-3 ${
                          message.role === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {message.role === 'assistant' && (
                          <div className="w-8 h-8 bg-opsly-purple rounded-full flex items-center justify-center flex-shrink-0">
                            <FaRobot className="text-white" />
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] rounded-lg p-4 ${
                            message.role === 'user'
                              ? 'bg-opsly-purple text-white'
                              : 'bg-opsly-dark text-gray-100'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{message.content}</p>
                          {message.sources && message.sources.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-600">
                              <p className="text-xs text-gray-400 mb-1">Sources:</p>
                              <ul className="text-xs text-gray-500 space-y-1">
                                {message.sources.map((source, idx) => (
                                  <li key={idx}>• {source}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        {message.role === 'user' && (
                          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <FaUser className="text-white" />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default RAGChatbot;
