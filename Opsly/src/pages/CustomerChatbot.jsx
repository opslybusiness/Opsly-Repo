import { useState, useEffect, useRef } from 'react'
import { 
  createChatSession, 
  sendChatMessage
} from '../services/chatbotService'
import { HiChat } from 'react-icons/hi'
import { FaRobot, FaUser } from 'react-icons/fa'

function CustomerChatbot() {
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  // Initialize session on mount
  useEffect(() => {
    initializeSession()
  }, [])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const initializeSession = async () => {
    try {
      const response = await createChatSession()
      setSessionId(response.session_id)
    } catch (error) {
      console.error('Failed to create session:', error)
      const errorMessage = {
        role: 'assistant',
        content: 'Unable to connect to the chatbot service. Please try again later.',
        timestamp: new Date().toISOString(),
      }
      setMessages([errorMessage])
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
        content: `Sorry, I encountered an error. Please try again.`,
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-opsly-dark relative">
      {/* Vertical Lines Background Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'repeating-linear-gradient(to right, rgba(255, 255, 255, 0.1) 0px, rgba(255, 255, 255, 0.1) 1px, transparent 1px, transparent 100px)',
          backgroundSize: '100px 100%'
        }}
      ></div>

      {/* Header */}
      <header className="relative z-10 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-800">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4 min-w-0 w-full px-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-opsly-purple rounded-full flex items-center justify-center flex-shrink-0">
              <FaRobot className="text-white text-lg sm:text-xl" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white truncate">Chat Support</h1>
              <p className="text-xs sm:text-sm text-gray-400 truncate">How can we help you today?</p>
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold flex-shrink-0">
            <span className="text-opsly-purple">Öps</span><span className="text-white">ly</span>
          </div>
        </div>
      </header>

      {/* Chat Container */}
      <div className="relative z-10 max-w-4xl mx-auto h-[calc(100vh-80px)] sm:h-[calc(100vh-100px)] flex flex-col p-4 sm:p-6 min-w-0 w-full">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto mb-3 sm:mb-4 space-y-3 sm:space-y-4 hide-scrollbar">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-opsly-purple rounded-full flex items-center justify-center mb-4 sm:mb-6 flex-shrink-0">
                <FaRobot className="text-white text-3xl sm:text-4xl" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-semibold text-white mb-2 sm:mb-3">Welcome!</h3>
              <p className="text-gray-400 max-w-md text-base sm:text-lg px-4">
                I'm here to help answer your questions. Ask me anything about our services, products, or how we can assist you.
              </p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-2 sm:gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-opsly-purple rounded-full flex items-center justify-center flex-shrink-0">
                    <FaRobot className="text-white text-sm sm:text-base" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-lg p-3 sm:p-4 ${
                    message.role === 'user'
                      ? 'bg-opsly-purple text-white'
                      : 'bg-opsly-card text-gray-100 border border-gray-700'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words text-sm sm:text-base">{message.content}</p>
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <FaUser className="text-white text-sm sm:text-base" />
                  </div>
                )}
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex gap-2 sm:gap-3 justify-start">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-opsly-purple rounded-full flex items-center justify-center flex-shrink-0">
                <FaRobot className="text-white text-sm sm:text-base" />
              </div>
              <div className="bg-opsly-card rounded-lg p-3 sm:p-4 border border-gray-700">
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
        <form onSubmit={handleSendMessage} className="flex gap-2 sm:gap-3">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type your message here..."
            className="flex-1 bg-opsly-card text-white rounded-lg px-3 sm:px-5 py-3 sm:py-4 border border-gray-700 focus:outline-none focus:border-opsly-purple text-sm sm:text-base"
            disabled={isLoading || !sessionId}
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || isLoading || !sessionId}
            className="px-4 sm:px-6 md:px-8 py-3 sm:py-4 bg-opsly-purple text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 sm:gap-2 font-medium text-sm sm:text-base flex-shrink-0"
          >
            <HiChat className="text-lg sm:text-xl flex-shrink-0" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  )
}

export default CustomerChatbot

