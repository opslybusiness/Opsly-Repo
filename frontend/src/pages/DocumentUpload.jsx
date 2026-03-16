import { useState, useEffect, useRef } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { 
  uploadDocument, 
  uploadMultipleDocuments,
  listDocuments, 
  deleteDocument,
} from '../services/chatbotService'
import { HiPaperClip, HiUpload, HiTrash } from 'react-icons/hi'

function DocumentUpload() {
  const [documents, setDocuments] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({})
  const fileInputRef = useRef(null)

  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    try {
      const docs = await listDocuments()
      setDocuments(docs || [])
    } catch (error) {
      console.error('Failed to load documents:', error)
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
      
      await loadDocuments()
      
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

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-1">
              Document Library
            </h1>
            <p className="text-sm sm:text-base text-gray-400 max-w-xl">
              Upload documents once and reuse them across AI tools and chat experiences.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Card */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            <div className="bg-opsly-card rounded-2xl p-5 sm:p-6 border border-gray-800 shadow-lg">
              <h2 className="text-lg sm:text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <span className="inline-flex rounded-xl bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-400 p-[2px]">
                  <span className="flex items-center justify-center bg-opsly-card rounded-[0.65rem] w-9 h-9">
                    <HiPaperClip className="text-opsly-purple text-lg" />
                  </span>
                </span>
                <span>Upload Documents</span>
              </h2>

              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-gray-600 rounded-xl p-5 sm:p-6 text-center hover:border-opsly-purple transition cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <HiUpload className="text-3xl sm:text-4xl text-gray-400 mx-auto mb-3" />
                <p className="text-sm sm:text-base text-gray-300 mb-1">
                  Drag & drop files here
                </p>
                <p className="text-xs sm:text-sm text-gray-500 mb-4">
                  or click to browse from your device
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.txt,.doc,.docx,.md"
                />
                <button
                  className="px-4 py-2 bg-opsly-purple text-white rounded-lg hover:bg-purple-700 transition text-sm sm:text-base"
                  disabled={isUploading}
                >
                  {isUploading ? 'Uploading…' : 'Select Files'}
                </button>
              </div>

              {Object.keys(uploadProgress).length > 0 && (
                <div className="mt-4 space-y-2">
                  {Object.entries(uploadProgress).map(([filename, status]) => (
                    <div key={filename} className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-gray-400 truncate max-w-[60%]">{filename}</span>
                      <span
                        className={`${
                          status === 'success'
                            ? 'text-green-500'
                            : status === 'error'
                            ? 'text-red-500'
                            : 'text-yellow-400'
                        }`}
                      >
                        {status === 'success' && 'Uploaded'}
                        {status === 'error' && 'Failed'}
                        {status === 'uploading' && 'Uploading…'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Documents List */}
          <div className="lg:col-span-2">
            <div className="bg-opsly-card rounded-2xl p-5 sm:p-6 border border-gray-800 shadow-lg h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold text-white">
                    Uploaded Documents
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-400">
                    {documents.length === 0
                      ? 'No documents uploaded yet.'
                      : `${documents.length} document${documents.length > 1 ? 's' : ''} available for AI tools.`}
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2">
                {documents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-gray-500 text-sm">
                    <HiPaperClip className="text-2xl mb-2" />
                    <p>Upload your first document to get started.</p>
                  </div>
                ) : (
                  documents.map((doc) => (
                    <div
                      key={doc.id || doc.file_id}
                      className="flex items-center justify-between bg-opsly-dark/60 rounded-xl px-3 sm:px-4 py-2.5"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-opsly-card flex items-center justify-center flex-shrink-0">
                          <HiPaperClip className="text-opsly-purple text-base" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm sm:text-base text-white truncate">
                            {doc.filename || doc.name || 'Untitled'}
                          </p>
                          {doc.created_at && (
                            <p className="text-xs text-gray-500">
                              {(doc.created_at || '').slice(0, 10)}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          handleDeleteDocument(doc.id || doc.file_id, doc.filename || doc.name)
                        }
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 hover:text-red-300 transition flex-shrink-0"
                      >
                        <HiTrash className="text-base" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default DocumentUpload

