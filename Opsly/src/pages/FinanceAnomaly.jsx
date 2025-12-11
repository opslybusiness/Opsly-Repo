import { useState, useEffect } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { Link } from 'react-router-dom'
import { HiExclamation, HiPlus, HiDocumentText, HiX, HiRefresh } from 'react-icons/hi'
import { getFraudDetectionHistory, checkTransactionFraud, checkTransactionsBatch } from '../services/fraudService'

function FinanceAnomaly() {
  const [detections, setDetections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCheckModal, setShowCheckModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [newTransaction, setNewTransaction] = useState({
    amount: '',
    transaction_date: '',
    merchant_name: '',
    merchant_state: '',
    transaction_id: ''
  })
  const [uploadFile, setUploadFile] = useState(null)
  const [checking, setChecking] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [summary, setSummary] = useState({
    total_count: 0,
    fraud_count: 0,
    legitimate_count: 0
  })

  // Calculate risk statistics
  const highRiskCount = detections.filter(d => d.fraud_probability > 0.7).length
  const mediumRiskCount = detections.filter(d => d.fraud_probability > 0.3 && d.fraud_probability <= 0.7).length
  const totalAmountAtRisk = detections
    .filter(d => d.is_fraud === 1)
    .reduce((sum, d) => sum + parseFloat(d.amount || 0), 0)

  useEffect(() => {
    fetchFraudHistory()
  }, [])

  const fetchFraudHistory = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await getFraudDetectionHistory({ limit: 100 })
      setDetections(response.data || [])
      setSummary({
        total_count: response.total_count || 0,
        fraud_count: response.fraud_count || 0,
        legitimate_count: response.legitimate_count || 0
      })
    } catch (err) {
      console.error('Error fetching fraud detection history:', err)
      setError(err.message || 'Failed to load fraud detection history')
    } finally {
      setLoading(false)
    }
  }

  const handleCheckTransaction = async (e) => {
    e.preventDefault()
    if (!newTransaction.amount || !newTransaction.transaction_date) {
      setError('Please fill in amount and transaction date')
      return
    }

    try {
      setChecking(true)
      setError('')
      const response = await checkTransactionFraud(newTransaction)
      
      // Refresh the history to show the new detection
      await fetchFraudHistory()
      
      // Close modal and reset form
      setShowCheckModal(false)
      setNewTransaction({
        amount: '',
        transaction_date: '',
        merchant_name: '',
        merchant_state: '',
        transaction_id: ''
      })
      
      // Show success message
      alert(`Transaction checked!\nFraud: ${response.is_fraud === 1 ? 'Yes' : 'No'}\nRisk: ${response.fraud_risk}\nProbability: ${(response.fraud_probability * 100).toFixed(2)}%`)
    } catch (err) {
      console.error('Error checking transaction:', err)
      setError(err.message || 'Failed to check transaction')
    } finally {
      setChecking(false)
    }
  }

  const handleUploadCSV = async (e) => {
    e.preventDefault()
    if (!uploadFile) {
      setError('Please select a CSV file')
      return
    }

    try {
      setUploading(true)
      setError('')
      const response = await checkTransactionsBatch(uploadFile)
      
      // Refresh the history
      await fetchFraudHistory()
      
      // Close modal and reset
      setShowUploadModal(false)
      setUploadFile(null)
      
      // Show success message
      alert(`Batch check complete!\nProcessed: ${response.total_processed}\nFraud detected: ${response.fraud_detected}\nLegitimate: ${response.legitimate}`)
    } catch (err) {
      console.error('Error uploading CSV:', err)
      setError(err.message || 'Failed to upload CSV')
    } finally {
      setUploading(false)
    }
  }

  const getRiskColor = (probability) => {
    if (probability > 0.7) return 'text-red-500'
    if (probability > 0.3) return 'text-orange-500'
    return 'text-green-500'
  }

  const getRiskBadge = (risk) => {
    if (risk === 'high') return 'bg-red-500/20 text-red-400 border-red-500/50'
    if (risk === 'medium') return 'bg-orange-500/20 text-orange-400 border-orange-500/50'
    return 'bg-green-500/20 text-green-400 border-green-500/50'
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  return (
    <DashboardLayout userName="Amanda">
      <div className="min-w-0 max-w-full">
        <Link to="/finance" className="text-sm sm:text-base text-opsly-purple mb-3 sm:mb-4 inline-block hover:underline">← Back</Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 sm:mb-2">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-1 sm:mb-2">Anomaly Detection</h1>
            <p className="text-sm sm:text-base text-gray-400 mb-4 sm:mb-8">AI-powered fraud detection for transactions</p>
          </div>
          <button
            onClick={fetchFraudHistory}
            className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-opsly-purple text-white rounded-lg hover:bg-opacity-90 transition flex items-center justify-center gap-2 self-start sm:self-auto"
          >
            <HiRefresh className="text-lg sm:text-xl flex-shrink-0" />
            Refresh
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 sm:p-4 text-sm sm:text-base bg-red-500/20 border border-red-500/50 text-red-200 rounded-lg">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 sm:gap-4 mb-6 sm:mb-8">
          <button
            onClick={() => setShowCheckModal(true)}
            className="px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base bg-orange-500 text-white rounded-lg hover:bg-opacity-90 transition flex items-center gap-1.5 sm:gap-2"
          >
            <HiPlus className="text-lg sm:text-xl flex-shrink-0" />
            <span className="hidden sm:inline">Check Transaction</span>
            <span className="sm:hidden">Check</span>
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base bg-blue-500 text-white rounded-lg hover:bg-opacity-90 transition flex items-center gap-1.5 sm:gap-2"
          >
            <HiDocumentText className="text-lg sm:text-xl flex-shrink-0" />
            <span className="hidden sm:inline">Batch Check CSV</span>
            <span className="sm:hidden">CSV</span>
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-red-900 rounded-lg p-4 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3 mb-2">
              <HiExclamation className="text-xl sm:text-2xl text-red-500 flex-shrink-0" />
              <p className="text-xs sm:text-sm text-gray-300">High Risk</p>
            </div>
            <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">{highRiskCount}</p>
          </div>
          <div className="bg-orange-900 rounded-lg p-4 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3 mb-2">
              <HiExclamation className="text-xl sm:text-2xl text-orange-500 flex-shrink-0" />
              <p className="text-xs sm:text-sm text-gray-300">Medium Risk</p>
            </div>
            <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">{mediumRiskCount}</p>
          </div>
          <div className="bg-opsly-card rounded-lg p-4 sm:p-6">
            <p className="text-xs sm:text-sm text-gray-400 mb-2">Fraudulent</p>
            <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">{summary.fraud_count}</p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">out of {summary.total_count} total</p>
          </div>
          <div className="bg-opsly-card rounded-lg p-4 sm:p-6">
            <p className="text-xs sm:text-sm text-gray-400 mb-2">Amount at Risk</p>
            <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">{formatCurrency(totalAmountAtRisk)}</p>
          </div>
        </div>

        {/* Detected Anomalies Table */}
        <div className="bg-opsly-card rounded-lg p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-white mb-1 sm:mb-2">Fraud Detection History</h2>
          <p className="text-sm sm:text-base text-gray-400 mb-4 sm:mb-6">All transactions analyzed by AI fraud detection</p>

          {loading ? (
            <div className="text-center py-8 text-sm sm:text-base text-gray-400">Loading...</div>
          ) : detections.length === 0 ? (
            <div className="text-center py-8 text-sm sm:text-base text-gray-400">No fraud detections found. Check a transaction to get started.</div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0 max-w-full">
              <div className="inline-block min-w-full align-middle px-4 sm:px-0 max-w-full">
                <table className="min-w-full max-w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 font-semibold">Date</th>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 font-semibold hidden md:table-cell">Transaction ID</th>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 font-semibold">Amount</th>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 font-semibold hidden lg:table-cell">Merchant</th>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 font-semibold hidden xl:table-cell">State</th>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 font-semibold">Status</th>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 font-semibold">Risk</th>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 font-semibold">Prob.</th>
                  </tr>
                </thead>
                <tbody>
                  {detections.map((detection) => (
                    <tr key={detection.id} className="border-b border-gray-800 hover:bg-opsly-dark transition">
                      <td className="py-3 sm:py-4 px-2 sm:px-4 text-xs sm:text-sm text-gray-300">{formatDate(detection.transaction_date)}</td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4 text-xs sm:text-sm text-white font-mono hidden md:table-cell truncate max-w-[120px]">{detection.transaction_id || 'N/A'}</td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4 text-xs sm:text-sm text-white">{formatCurrency(detection.amount)}</td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4 text-xs sm:text-sm text-gray-300 hidden lg:table-cell truncate max-w-[100px]">{detection.merchant_name || 'N/A'}</td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4 text-xs sm:text-sm text-gray-300 hidden xl:table-cell">{detection.merchant_state || 'N/A'}</td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${
                          detection.is_fraud === 1 
                            ? 'bg-red-500/20 text-red-400 border border-red-500/50' 
                            : 'bg-green-500/20 text-green-400 border border-green-500/50'
                        }`}>
                          {detection.is_fraud === 1 ? 'Fraud' : 'Legitimate'}
                        </span>
                      </td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold border whitespace-nowrap ${getRiskBadge(detection.fraud_risk)}`}>
                          {detection.fraud_risk.toUpperCase()}
                        </span>
                      </td>
                      <td className={`py-3 sm:py-4 px-2 sm:px-4 text-xs sm:text-sm font-semibold ${getRiskColor(detection.fraud_probability)}`}>
                        {(detection.fraud_probability * 100).toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Check Transaction Modal */}
      {showCheckModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-opsly-card rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl sm:text-2xl font-bold text-white">Check Transaction</h3>
              <button
                onClick={() => {
                  setShowCheckModal(false)
                  setNewTransaction({
                    amount: '',
                    transaction_date: '',
                    merchant_name: '',
                    merchant_state: '',
                    transaction_id: ''
                  })
                  setError('')
                }}
                className="text-gray-400 hover:text-white"
              >
                <HiX className="text-2xl" />
              </button>
            </div>
            <form onSubmit={handleCheckTransaction}>
              <div className="mb-4">
                <label className="block text-gray-400 mb-2">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                  className="w-full px-4 py-2 bg-opsly-dark text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-opsly-purple"
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-400 mb-2">Transaction Date *</label>
                <input
                  type="datetime-local"
                  value={newTransaction.transaction_date}
                  onChange={(e) => setNewTransaction({ ...newTransaction, transaction_date: e.target.value })}
                  className="w-full px-4 py-2 bg-opsly-dark text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-opsly-purple"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-400 mb-2">Merchant Name</label>
                <input
                  type="text"
                  value={newTransaction.merchant_name}
                  onChange={(e) => setNewTransaction({ ...newTransaction, merchant_name: e.target.value })}
                  className="w-full px-4 py-2 bg-opsly-dark text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-opsly-purple"
                  placeholder="Optional"
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-400 mb-2">Merchant State</label>
                <input
                  type="text"
                  value={newTransaction.merchant_state}
                  onChange={(e) => setNewTransaction({ ...newTransaction, merchant_state: e.target.value })}
                  className="w-full px-4 py-2 bg-opsly-dark text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-opsly-purple"
                  placeholder="Optional (e.g., NY, CA)"
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-400 mb-2">Transaction ID</label>
                <input
                  type="text"
                  value={newTransaction.transaction_id}
                  onChange={(e) => setNewTransaction({ ...newTransaction, transaction_id: e.target.value })}
                  className="w-full px-4 py-2 bg-opsly-dark text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-opsly-purple"
                  placeholder="Optional"
                />
              </div>
              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={checking}
                  className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-opacity-90 disabled:opacity-50"
                >
                  {checking ? 'Checking...' : 'Check Transaction'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCheckModal(false)
                    setNewTransaction({
                      amount: '',
                      transaction_date: '',
                      merchant_name: '',
                      merchant_state: '',
                      transaction_id: ''
                    })
                    setError('')
                  }}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-opacity-90"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload CSV Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-opsly-card rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl sm:text-2xl font-bold text-white">Batch Check CSV</h3>
              <button
                onClick={() => {
                  setShowUploadModal(false)
                  setUploadFile(null)
                  setError('')
                }}
                className="text-gray-400 hover:text-white"
              >
                <HiX className="text-2xl" />
              </button>
            </div>
            <form onSubmit={handleUploadCSV}>
              <div className="mb-4">
                <label className="block text-gray-400 mb-2">CSV File</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  className="w-full px-4 py-2 bg-opsly-dark text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-opsly-purple"
                  required
                />
                <p className="text-gray-500 text-sm mt-2">
                  CSV must have 'amount' and 'date' (or 'transaction_date') columns.<br />
                  Optional: 'merchant_name', 'merchant_state', 'transaction_id'
                </p>
              </div>
              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-opacity-90 disabled:opacity-50"
                >
                  {uploading ? 'Processing...' : 'Upload & Check'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false)
                    setUploadFile(null)
                    setError('')
                  }}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-opacity-90"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}

export default FinanceAnomaly
