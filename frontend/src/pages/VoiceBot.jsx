import { useEffect, useRef, useState } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import {
  createAssistant,
  getAssistant,
  updateAssistant,
  buyVoiceBotNumber,
  getVoiceBotNumber,
  getVoiceBotRecordings,
} from '../services/voiceBotService'
import {
  uploadDocument,
  listDocuments,
  deleteDocument,
} from '../services/chatbotService'
import {
  HiPhoneIncoming,
  HiUpload,
  HiPaperClip,
  HiTrash,
  HiRefresh,
  HiPlay,
  HiPencil,
  HiCheckCircle,
  HiSave,
} from 'react-icons/hi'
import { FaRobot } from 'react-icons/fa'

const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful AI assistant for this business. Answer customer questions accurately and politely based on the knowledge base provided. If you don\'t know the answer, say so honestly and offer to connect them with a human agent.'

function VoiceBot() {
  // ── Assistant state ──────────────────────────────────────────────────────
  const [assistant, setAssistant] = useState(null)        // { vapi_assistant_id, system_prompt, vapi_details }
  const [isLoadingAssistant, setIsLoadingAssistant] = useState(false)
  const [isSavingAssistant, setIsSavingAssistant] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState(false)
  const [businessName, setBusinessName] = useState('')
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT)
  const [assistantSaved, setAssistantSaved] = useState(false)

  // ── Phone number state ───────────────────────────────────────────────────
  const [voiceNumber, setVoiceNumber] = useState(null)
  const [isBuyingNumber, setIsBuyingNumber] = useState(false)

  // ── Documents state ──────────────────────────────────────────────────────
  const [documents, setDocuments] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({})
  const [showDocumentList, setShowDocumentList] = useState(false)
  const [isLoadingDocs, setIsLoadingDocs] = useState(false)

  // ── Recordings state ─────────────────────────────────────────────────────
  const [recordings, setRecordings] = useState([])
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(false)

  const fileInputRef = useRef(null)

  // ── Initial data load ────────────────────────────────────────────────────
  useEffect(() => {
    loadAssistant()
    loadVoiceNumber()
    loadDocuments()
    loadRecordings()
  }, [])

  // ── Assistant ─────────────────────────────────────────────────────────────
  const loadAssistant = async () => {
    setIsLoadingAssistant(true)
    try {
      const data = await getAssistant()
      setAssistant(data)
      setSystemPrompt(data.system_prompt || DEFAULT_SYSTEM_PROMPT)
      setBusinessName(data.vapi_details?.name || '')
    } catch {
      // 404 means user hasn't created an assistant yet – that's fine
    } finally {
      setIsLoadingAssistant(false)
    }
  }

  const handleSaveAssistant = async () => {
    setIsSavingAssistant(true)
    setAssistantSaved(false)
    try {
      let data
      if (assistant) {
        data = await updateAssistant({ businessName, systemPrompt })
      } else {
        data = await createAssistant(businessName || 'My Business', systemPrompt)
      }
      setAssistant(data)
      setSystemPrompt(data.system_prompt || systemPrompt)
      setEditingPrompt(false)
      setAssistantSaved(true)
      setTimeout(() => setAssistantSaved(false), 3000)
    } catch (err) {
      alert(err.message || 'Failed to save assistant')
    } finally {
      setIsSavingAssistant(false)
    }
  }

  // ── Phone number ──────────────────────────────────────────────────────────
  const loadVoiceNumber = async () => {
    try {
      const data = await getVoiceBotNumber()
      setVoiceNumber(data.voice_bot_number || data.number)
    } catch {
      // 404 = no number yet
    }
  }

  const handleBuyNumber = async () => {
    if (!assistant) {
      alert('Please set up your voice bot assistant first.')
      return
    }
    setIsBuyingNumber(true)
    try {
      const data = await buyVoiceBotNumber()
      setVoiceNumber(data.voice_bot_number || data.number)
    } catch (err) {
      alert(err.message || 'Failed to get voice bot number')
    } finally {
      setIsBuyingNumber(false)
    }
  }

  // ── Documents ─────────────────────────────────────────────────────────────
  const loadDocuments = async () => {
    setIsLoadingDocs(true)
    try {
      const docs = await listDocuments()
      setDocuments(docs || [])
    } catch {
      // ignore
    } finally {
      setIsLoadingDocs(false)
    }
  }

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return
    const fileArray = Array.from(files)
    setIsUploading(true)
    try {
      for (const file of fileArray) {
        setUploadProgress((prev) => ({ ...prev, [file.name]: 'uploading' }))
        try {
          await uploadDocument(file)
          setUploadProgress((prev) => ({ ...prev, [file.name]: 'success' }))
        } catch {
          setUploadProgress((prev) => ({ ...prev, [file.name]: 'error' }))
        }
      }
      await loadDocuments()
      setTimeout(() => setUploadProgress({}), 2000)
    } catch (err) {
      alert(err.message || 'Failed to upload documents')
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileSelect = (e) => {
    handleFileUpload(e.target.files)
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    handleFileUpload(e.dataTransfer.files)
  }

  const handleDragOver = (e) => e.preventDefault()

  const handleDeleteDocument = async (fileId, filename) => {
    if (!window.confirm(`Are you sure you want to delete ${filename}?`)) return
    try {
      await deleteDocument(fileId)
      await loadDocuments()
    } catch (err) {
      alert(err.message || 'Failed to delete document')
    }
  }

  // ── Recordings ────────────────────────────────────────────────────────────
  const loadRecordings = async () => {
    setIsLoadingRecordings(true)
    try {
      const data = await getVoiceBotRecordings()
      setRecordings(data.recordings || [])
    } catch {
      // ignore
    } finally {
      setIsLoadingRecordings(false)
    }
  }

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Unknown'
    try {
      return new Date(dateString).toLocaleString()
    } catch {
      return 'Unknown'
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout userName="User">
      <div className="flex flex-col min-w-0 max-w-full gap-4 sm:gap-6">

        {/* ── Page header + Buy Number button ── */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-1">
              Voice Bot
            </h1>
            <p className="text-sm sm:text-base text-gray-400">
              Configure your AI voice assistant, manage documents, and view call recordings
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 flex-shrink-0">
            {voiceNumber && (
              <div className="px-3 sm:px-4 py-2 bg-opsly-card rounded-lg border border-gray-700 text-xs sm:text-sm text-gray-200 flex items-center gap-2">
                <HiPhoneIncoming className="text-opsly-purple flex-shrink-0" />
                <span className="text-gray-400 whitespace-nowrap">Your bot number:</span>
                <span className="font-semibold text-white truncate">{voiceNumber}</span>
              </div>
            )}
            <button
              onClick={handleBuyNumber}
              disabled={isBuyingNumber}
              className="px-3 sm:px-4 py-2 bg-opsly-purple text-white rounded-lg hover:bg-purple-700 transition flex items-center justify-center gap-2 text-sm sm:text-base disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <HiPhoneIncoming className="text-lg sm:text-xl flex-shrink-0" />
              {isBuyingNumber
                ? 'Buying...'
                : voiceNumber
                ? 'Get New Number'
                : 'Get Voice Bot Number'}
            </button>
          </div>
        </div>

        {/* ── Assistant / System Prompt card ── */}
        <div className="bg-opsly-card rounded-lg p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <FaRobot className="text-opsly-purple text-xl sm:text-2xl flex-shrink-0" />
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-white">
                  Bot Assistant Settings
                </h2>
                <p className="text-xs sm:text-sm text-gray-400">
                  {assistant
                    ? `Assistant ID: ${assistant.vapi_assistant_id}`
                    : 'No assistant configured yet'}
                </p>
              </div>
            </div>

            <div className="flex gap-2 flex-shrink-0">
              {assistant && !editingPrompt && (
                <button
                  onClick={() => setEditingPrompt(true)}
                  className="px-3 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition text-xs sm:text-sm flex items-center gap-1.5"
                >
                  <HiPencil className="flex-shrink-0" />
                  <span>Edit</span>
                </button>
              )}
              {assistantSaved && (
                <span className="flex items-center gap-1 text-green-400 text-xs sm:text-sm">
                  <HiCheckCircle className="flex-shrink-0" /> Saved
                </span>
              )}
            </div>
          </div>

          {isLoadingAssistant ? (
            <div className="flex gap-2 py-4">
              {[0, 150, 300].map((d) => (
                <div
                  key={d}
                  className="w-2 h-2 bg-opsly-purple rounded-full animate-bounce"
                  style={{ animationDelay: `${d}ms` }}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Business name */}
              <div>
                <label className="block text-xs sm:text-sm text-gray-400 mb-1.5 font-medium">
                  Business Name
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  disabled={assistant && !editingPrompt}
                  placeholder="e.g. Acme Support"
                  className="w-full px-3 py-2 bg-opsly-dark text-white rounded-lg border border-gray-700 focus:border-opsly-purple focus:outline-none text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Assistant status badge */}
              <div className="flex items-end">
                <div
                  className={`w-full px-3 py-2 rounded-lg border text-xs sm:text-sm ${
                    assistant
                      ? 'bg-green-900/30 border-green-700 text-green-400'
                      : 'bg-gray-800 border-gray-700 text-gray-400'
                  }`}
                >
                  {assistant
                    ? '✓ Assistant active on Vapi'
                    : 'No assistant yet — fill in the fields and save'}
                </div>
              </div>

              {/* System prompt – full width */}
              <div className="md:col-span-2">
                <label className="block text-xs sm:text-sm text-gray-400 mb-1.5 font-medium">
                  System Prompt
                  <span className="ml-2 text-gray-500 font-normal">
                    (defines how your voice bot behaves)
                  </span>
                </label>
                <textarea
                  rows={5}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  disabled={assistant && !editingPrompt}
                  placeholder="Describe your bot's behaviour, tone, and scope..."
                  className="w-full px-3 py-2 bg-opsly-dark text-white rounded-lg border border-gray-700 focus:border-opsly-purple focus:outline-none text-sm resize-y disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          )}

          {/* Save / Cancel */}
          {(!assistant || editingPrompt) && !isLoadingAssistant && (
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <button
                onClick={handleSaveAssistant}
                disabled={isSavingAssistant}
                className="px-4 py-2 bg-opsly-purple text-white rounded-lg hover:bg-purple-700 transition flex items-center justify-center gap-2 text-sm sm:text-base disabled:opacity-60"
              >
                <HiSave className="flex-shrink-0" />
                {isSavingAssistant
                  ? 'Saving...'
                  : assistant
                  ? 'Update Assistant'
                  : 'Create Assistant'}
              </button>
              {editingPrompt && (
                <button
                  onClick={() => {
                    setEditingPrompt(false)
                    setSystemPrompt(assistant?.system_prompt || DEFAULT_SYSTEM_PROMPT)
                    setBusinessName(assistant?.vapi_details?.name || '')
                  }}
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition text-sm sm:text-base"
                >
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Bottom grid: Documents | Recordings ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">

          {/* Documents panel */}
          <div className="xl:col-span-1 flex flex-col">
            <div className="bg-opsly-card rounded-lg p-4 sm:p-6 flex-1 flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <HiUpload className="text-opsly-purple text-xl sm:text-2xl flex-shrink-0" />
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold text-white">
                      Knowledge Documents
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-400">
                      Files the bot uses to answer questions
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDocumentList((p) => !p)}
                  className="px-3 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition text-xs sm:text-sm flex items-center gap-2 flex-shrink-0"
                >
                  <HiPaperClip className="flex-shrink-0" />
                  <span>Docs ({documents.length})</span>
                </button>
              </div>

              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-600 rounded-lg p-4 sm:p-6 text-center hover:border-opsly-purple transition cursor-pointer"
              >
                <HiPaperClip className="text-3xl sm:text-4xl text-gray-400 mx-auto mb-3 flex-shrink-0" />
                <p className="text-sm sm:text-base text-gray-400 mb-1">Drag &amp; drop files here</p>
                <p className="text-xs sm:text-sm text-gray-500 mb-3">or click to browse</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.txt,.doc,.docx,.md"
                />
                <button className="px-3 sm:px-4 py-2 bg-opsly-purple text-white rounded-lg hover:bg-purple-700 transition text-sm">
                  {isUploading ? 'Uploading...' : 'Select Files'}
                </button>
              </div>

              {/* Upload progress */}
              {Object.keys(uploadProgress).length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {Object.entries(uploadProgress).map(([filename, status]) => (
                    <div key={filename} className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-gray-400 truncate max-w-[65%]">{filename}</span>
                      <span
                        className={
                          status === 'success'
                            ? 'text-green-500'
                            : status === 'error'
                            ? 'text-red-500'
                            : 'text-yellow-500'
                        }
                      >
                        {status === 'success' ? '✓' : status === 'error' ? '✗' : '...'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Document list */}
              {showDocumentList && (
                <div className="mt-4 flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm sm:text-base font-semibold text-white">
                      Uploaded Files
                    </h3>
                    <button
                      onClick={loadDocuments}
                      disabled={isLoadingDocs}
                      className="text-xs text-gray-300 hover:text-white flex items-center gap-1 disabled:opacity-60"
                    >
                      <HiRefresh className="flex-shrink-0" /> Refresh
                    </button>
                  </div>
                  <div className="space-y-2 max-h-52 overflow-y-auto hide-scrollbar">
                    {isLoadingDocs ? (
                      <p className="text-xs text-gray-400">Loading...</p>
                    ) : documents.length === 0 ? (
                      <p className="text-xs text-gray-400">No documents uploaded yet.</p>
                    ) : (
                      documents.map((doc) => (
                        <div
                          key={doc.file_id}
                          className="flex items-center justify-between bg-opsly-dark rounded-lg px-3 py-2 hover:bg-gray-800 transition"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="text-gray-300 text-xs sm:text-sm truncate block">
                              {doc.filename}
                            </span>
                            <span className="text-gray-500 text-[11px]">
                              {doc.chunk_count} chunk{doc.chunk_count !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <button
                            onClick={() => handleDeleteDocument(doc.file_id, doc.filename)}
                            className="ml-2 text-red-400 hover:text-red-500 transition flex-shrink-0"
                          >
                            <HiTrash className="text-base" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recordings panel */}
          <div className="xl:col-span-2 flex flex-col bg-opsly-card rounded-lg p-4 sm:p-6 min-h-[260px]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-white">Call Recordings</h2>
                <p className="text-xs sm:text-sm text-gray-400">
                  Conversations handled by your voice bot
                </p>
              </div>
              <button
                onClick={loadRecordings}
                disabled={isLoadingRecordings}
                className="px-3 sm:px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition flex items-center gap-2 text-xs sm:text-sm disabled:opacity-60 flex-shrink-0"
              >
                <HiRefresh className="flex-shrink-0" />
                <span>Refresh</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 sm:space-y-4 min-h-[150px]">
              {isLoadingRecordings ? (
                <div className="flex justify-center items-center h-full py-8">
                  <div className="flex gap-2">
                    {[0, 150, 300].map((d) => (
                      <div
                        key={d}
                        className="w-2 h-2 bg-opsly-purple rounded-full animate-bounce"
                        style={{ animationDelay: `${d}ms` }}
                      />
                    ))}
                  </div>
                </div>
              ) : recordings.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-8 text-center px-4">
                  <HiPhoneIncoming className="text-4xl sm:text-5xl text-gray-600 mb-3" />
                  <p className="text-sm sm:text-base text-gray-400 max-w-md">
                    No recordings yet. Once customers call your voice bot number, recordings
                    will appear here.
                  </p>
                </div>
              ) : (
                recordings.map((rec) => (
                  <div
                    key={rec.id || rec.url}
                    className="flex items-center justify-between bg-opsly-dark rounded-lg p-3 sm:p-4 gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-gray-300 truncate">
                        {rec.id || 'Call Recording'}
                      </p>
                      <p className="text-[11px] sm:text-xs text-gray-500 mt-1">
                        {formatDateTime(rec.createdAt || rec.created_at)}
                      </p>
                    </div>
                    <a
                      href={rec.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 bg-opsly-purple text-white rounded-lg hover:bg-purple-700 transition text-xs sm:text-sm flex-shrink-0"
                    >
                      <HiPlay className="flex-shrink-0" />
                      <span>Play</span>
                    </a>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  )
}

export default VoiceBot

