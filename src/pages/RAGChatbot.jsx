import { useState, useEffect, useRef } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { 
  createChatSession, 
  sendChatMessage, 
  uploadDocument, 
  uploadMultipleDocuments,
  listDocuments, 
  deleteDocument,
  clearChatSession 
} from '../services/chatbotService'
import { HiPaperClip, HiX, HiTrash, HiUpload, HiChat } from 'react-icons/hi'
import { FaRobot, FaUser } from 'react-icons/fa'

function RAGChatbot() {
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [documents, setDocuments] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({})
  const [showDocumentList, setShowDocumentList] = useState(false)
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)

  // Initialize session on mount
  useEffect(() => {
    initializeSession()
    loadDocuments()
  }, [])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const initializeSession = async () => {
    try {
      const response = await createChatSession()
      console.log('Session created - Full response:', response)
      console.log('Session ID received from backend:', response.session_id)
      setSessionId(response.session_id)
    } catch (error) {
      console.error('Failed to create session:', error)
      alert('Failed to initialize chat session. Please check if the backend is running.')
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

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!inputMessage.trim() || isLoading || !sessionId) return

    const userMessage = inputMessage.trim()
    setInputMessage('')
    
    // Add user message to chat
    const newUserMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, newUserMessage])
    setIsLoading(true)

    try {
      const response = await sendChatMessage(sessionId, userMessage, true)
      console.log("Session ID:",sessionId)
      // Add bot response to chat
      const botMessage = {
        role: 'assistant',
        content: response.message,
        sources: response.sources || [],
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, botMessage])
    } catch (error) {
      console.error('Failed to send message:', error)
      const errorMessage = {
        role: 'assistant',
        content: `Error: ${error.message}. Please make sure the backend is running and documents are uploaded.`,
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
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

  const handleClearChat = async () => {
    if (!window.confirm('Are you sure you want to clear the chat history?')) return

    try {
      if (sessionId) {
        await clearChatSession(sessionId)
      }
      setMessages([])
      await initializeSession()
    } catch (error) {
      console.error('Failed to clear chat:', error)
    }
  }

  return (
    <DashboardLayout userName="User">
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">RAG Chatbot</h1>
            <p className="text-gray-400">Ask questions about your uploaded documents</p>
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
              onClick={handleClearChat}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
            >
              Clear Chat
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
                  <div className="space-y-2 max-h-64 overflow-y-auto">
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
            </div>
          </div>

          {/* Chat Section */}
          <div className="lg:col-span-2 flex flex-col bg-opsly-card rounded-lg p-6">
            <div className="flex-1 overflow-y-auto mb-4 space-y-4 min-h-0">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <FaRobot className="text-6xl text-opsly-purple mb-4" />
                  <h3 className="text-2xl font-semibold text-white mb-2">Start a conversation</h3>
                  <p className="text-gray-400 max-w-md">
                    Upload documents and ask questions about them. The chatbot will use RAG to provide accurate answers based on your documents.
                  </p>
                </div>
              ) : (
                messages.map((message, index) => (
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
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                    {message.role === 'user' && (
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <FaUser className="text-white" />
                      </div>
                    )}
                  </div>
                ))
              )}
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 bg-opsly-purple rounded-full flex items-center justify-center">
                    <FaRobot className="text-white" />
                  </div>
                  <div className="bg-opsly-dark rounded-lg p-4">
                    <div className="flex gap-2">
                      <div className="w-2 h-2 bg-opsly-purple rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-opsly-purple rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-opsly-purple rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask a question about your documents..."
                className="flex-1 bg-opsly-dark text-white rounded-lg px-4 py-3 border border-gray-700 focus:outline-none focus:border-opsly-purple"
                disabled={isLoading || !sessionId}
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isLoading || !sessionId}
                className="px-6 py-3 bg-opsly-purple text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <HiChat className="text-xl" />
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default RAGChatbot;

