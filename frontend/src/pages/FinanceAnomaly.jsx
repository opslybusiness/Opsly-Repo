import { useState, useEffect } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { Link } from 'react-router-dom'
import { HiExclamation, HiRefresh } from 'react-icons/hi'
import { getFraudDetectionHistory } from '../services/fraudService'

// Payment code labels
const PAYMENT_CODE_LABELS = {
  1: 'Swipe',
  2: 'Chip',
  3: 'Online'
}

function FinanceAnomaly() {
  const [detections, setDetections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
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

  const getPaymentLabel = (code) => {
    return PAYMENT_CODE_LABELS[code] || 'Unknown'
  }

  return (
    <DashboardLayout>
      <div className="min-w-0 max-w-full">
        <Link to="/finance" className="text-sm sm:text-base text-opsly-purple mb-3 sm:mb-4 inline-block hover:underline">← Back</Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 sm:mb-2">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-1 sm:mb-2">Anomaly Detection</h1>
            <p className="text-sm sm:text-base text-gray-400 mb-4 sm:mb-8">AI-powered fraud detection for your transactions</p>
          </div>
          <button
            onClick={fetchFraudHistory}
            className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-opsly-purple text-white rounded-lg hover:bg-opacity-90 transition flex items-center justify-center gap-2 self-start sm:self-auto"
          >
            <HiRefresh className="text-lg sm:text-xl flex-shrink-0" />
            Refresh
          </button>
        </div>

        {/* Info Banner */}
        <div className="mb-6 p-4 bg-blue-900/30 border border-blue-500/30 rounded-lg">
          <p className="text-sm text-blue-200">
            <strong>Note:</strong> Transactions are automatically analyzed for fraud when added via the Finance page. 
            This page shows the fraud detection results for all your transactions.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 sm:p-4 text-sm sm:text-base bg-red-500/20 border border-red-500/50 text-red-200 rounded-lg">
            {error}
          </div>
        )}

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
            <p className="text-xs sm:text-sm text-gray-500 mt-1">out of {summary.total_count} analyzed</p>
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
            <div className="text-center py-8 text-sm sm:text-base text-gray-400">
              No transactions have been analyzed yet. Add transactions in the Finance page to see fraud detection results.
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0 max-w-full">
              <div className="inline-block min-w-full align-middle px-4 sm:px-0 max-w-full">
                <table className="min-w-full max-w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 font-semibold">Date</th>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 font-semibold">Amount</th>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 font-semibold hidden md:table-cell">Category</th>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 font-semibold hidden lg:table-cell">Payment</th>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 font-semibold">Status</th>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 font-semibold">Risk</th>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 font-semibold">Prob.</th>
                  </tr>
                </thead>
                <tbody>
                  {detections.map((detection) => (
                    <tr key={detection.id} className="border-b border-gray-800 hover:bg-opsly-dark transition">
                      <td className="py-3 sm:py-4 px-2 sm:px-4 text-xs sm:text-sm text-gray-300">{formatDate(detection.transaction_date)}</td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4 text-xs sm:text-sm text-white">{formatCurrency(detection.amount)}</td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4 text-xs sm:text-sm text-gray-300 hidden md:table-cell truncate max-w-[150px]">{detection.category || 'N/A'}</td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4 text-xs sm:text-sm text-gray-300 hidden lg:table-cell">{detection.use_chip ? getPaymentLabel(detection.payment_code) : 'N/A'}</td>
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
                          {detection.fraud_risk ? detection.fraud_risk.toUpperCase() : 'LOW'}
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
    </DashboardLayout>
  )
}

export default FinanceAnomaly
