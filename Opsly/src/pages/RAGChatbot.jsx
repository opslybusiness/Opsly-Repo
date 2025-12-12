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
    <DashboardLayout>
      <div className="flex flex-col h-full min-w-0 max-w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6 min-w-0">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-1 sm:mb-2">Chatbot Management</h1>
            <p className="text-sm sm:text-base text-gray-400">Manage documents and view customer chat history</p>
          </div>
          <div className="flex gap-2 sm:gap-4 flex-shrink-0">
            <button
              onClick={() => setShowDocumentList(!showDocumentList)}
              className="px-3 sm:px-4 py-2 bg-opsly-purple text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-1 sm:gap-2 text-sm sm:text-base"
            >
              <HiPaperClip className="text-lg sm:text-xl flex-shrink-0" />
              <span className="hidden sm:inline">Documents</span>
              <span className="sm:hidden">Docs</span>
              <span>({documents.length})</span>
            </button>
            <button
              onClick={handleRefreshSessions}
              className="px-3 sm:px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition flex items-center gap-1 sm:gap-2 text-sm sm:text-base"
            >
              <HiRefresh className="text-lg sm:text-xl flex-shrink-0" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 min-h-0">
          {/* Document Upload Section */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            <div className="bg-opsly-card rounded-lg p-4 sm:p-6 flex-1">
              <h2 className="text-lg sm:text-xl font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
                <HiUpload className="text-opsly-purple text-lg sm:text-xl flex-shrink-0" />
                <span>Upload Documents</span>
              </h2>
              
              {/* File Upload Area */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-gray-600 rounded-lg p-4 sm:p-6 md:p-8 text-center hover:border-opsly-purple transition cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <HiPaperClip className="text-3xl sm:text-4xl text-gray-400 mx-auto mb-3 sm:mb-4 flex-shrink-0" />
                <p className="text-sm sm:text-base text-gray-400 mb-1 sm:mb-2">Drag & drop files here</p>
                <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4">or click to browse</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.txt,.doc,.docx,.md"
                />
                <button className="px-3 sm:px-4 py-2 bg-opsly-purple text-white rounded-lg hover:bg-purple-700 transition text-sm sm:text-base">
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
                <div className="mt-4 sm:mt-6">
                  <h3 className="text-base sm:text-lg font-semibold text-white mb-2 sm:mb-3">Uploaded Documents</h3>
                  <div className="space-y-2 max-h-48 sm:max-h-64 overflow-y-auto hide-scrollbar">
                    {documents.length === 0 ? (
                      <p className="text-gray-400 text-xs sm:text-sm">No documents uploaded yet</p>
                    ) : (
                      documents.map((doc) => (
                        <div
                          key={doc.id || doc.file_id}
                          className="flex items-center justify-between bg-opsly-dark rounded-lg p-2 sm:p-3 hover:bg-gray-800 transition"
                        >
                          <span className="text-gray-300 text-xs sm:text-sm truncate flex-1 min-w-0">
                            {doc.filename || doc.name || 'Untitled'}
                          </span>
                          <button
                            onClick={() => handleDeleteDocument(doc.id || doc.file_id, doc.filename || doc.name)}
                            className="ml-2 text-red-400 hover:text-red-500 transition flex-shrink-0"
                          >
                            <HiTrash className="text-base sm:text-lg" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Chat Sessions List */}
              <div className="mt-4 sm:mt-6">
                <h3 className="text-base sm:text-lg font-semibold text-white mb-2 sm:mb-3 flex items-center gap-2">
                  <HiChat className="text-opsly-purple text-lg sm:text-xl flex-shrink-0" />
                  <span>Customer Chats</span>
                </h3>
                <div className="space-y-2 max-h-80 sm:max-h-96 overflow-y-auto hide-scrollbar">
                  {isLoadingSessions ? (
                    <div className="text-center py-4">
                      <div className="inline-flex gap-1">
                        <div className="w-2 h-2 bg-opsly-purple rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-opsly-purple rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-opsly-purple rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  ) : chatSessions.length === 0 ? (
                    <p className="text-gray-400 text-xs sm:text-sm text-center py-4">No chat sessions yet</p>
                  ) : (
                    chatSessions.map((session) => (
                      <button
                        key={session.session_id || session.id}
                        onClick={() => setSelectedSession(session)}
                        className={`w-full text-left bg-opsly-dark rounded-lg p-2 sm:p-3 hover:bg-gray-800 transition ${
                          selectedSession?.session_id === session.session_id || selectedSession?.id === session.id
                            ? 'ring-2 ring-opsly-purple bg-gray-800'
                            : ''
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-gray-300 text-xs sm:text-sm font-medium truncate min-w-0">
                            Session {session.session_id?.substring(0, 8) || session.id?.substring(0, 8) || 'Unknown'}
                          </span>
                          <HiClock className="text-gray-500 text-xs flex-shrink-0 ml-2" />
                        </div>
                        <p className="text-gray-500 text-xs truncate">
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
          <div className="lg:col-span-2 flex flex-col bg-opsly-card rounded-lg p-4 sm:p-6">
            {!selectedSession ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <HiChat className="text-4xl sm:text-5xl md:text-6xl text-opsly-purple mb-3 sm:mb-4" />
                <h3 className="text-xl sm:text-2xl font-semibold text-white mb-2">Select a Chat Session</h3>
                <p className="text-sm sm:text-base text-gray-400 max-w-md">
                  Choose a customer chat session from the list to view the conversation history.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3 sm:mb-4 pb-3 sm:pb-4 border-b border-gray-700 gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg sm:text-xl font-semibold text-white truncate">
                      Session {selectedSession.session_id?.substring(0, 8) || selectedSession.id?.substring(0, 8) || 'Unknown'}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-400 mt-1 truncate">
                      {formatDate(selectedSession.created_at || selectedSession.timestamp || selectedSession.date)}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedSession(null)}
                    className="text-gray-400 hover:text-white transition flex-shrink-0 p-1"
                  >
                    <HiX className="text-lg sm:text-xl" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto mb-3 sm:mb-4 space-y-3 sm:space-y-4 min-h-0 hide-scrollbar">
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
                        className={`flex gap-2 sm:gap-3 ${
                          message.role === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {message.role === 'assistant' && (
                          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-opsly-purple rounded-full flex items-center justify-center flex-shrink-0">
                            <FaRobot className="text-white text-sm sm:text-base" />
                          </div>
                        )}
                        <div
                          className={`max-w-[85%] sm:max-w-[80%] rounded-lg p-3 sm:p-4 ${
                            message.role === 'user'
                              ? 'bg-opsly-purple text-white'
                              : 'bg-opsly-dark text-gray-100'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words text-sm sm:text-base">{message.content}</p>
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
                          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <FaUser className="text-white text-sm sm:text-base" />
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
