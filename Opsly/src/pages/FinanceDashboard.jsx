import { useState, useEffect } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { Link } from 'react-router-dom'
import { HiPlus, HiDocumentText, HiChartBar, HiExclamation, HiX, HiDocumentReport } from 'react-icons/hi'
import { getFinancialData, addFinancialData, uploadFinancialDataCSV, getCategories } from '../services/financeService'

function FinanceDashboard() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [newTransaction, setNewTransaction] = useState({ date: '', amount: '', category: '', use_chip: '' })
  const [uploadFile, setUploadFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [selectedYear, setSelectedYear] = useState(null)
  const [categories, setCategories] = useState([])

  // Calculate summary statistics
  const totalTransactions = transactions.length
  const totalExpense = transactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
  const avgTransaction = totalTransactions > 0 ? totalExpense / totalTransactions : 0

  // Fetch financial data on component mount and when filters change
  useEffect(() => {
    fetchFinancialData()
    fetchCategories()
  }, [selectedMonth, selectedYear])

  const fetchCategories = async () => {
    try {
      const response = await getCategories()
      setCategories(response.categories || [])
    } catch (err) {
      console.error('Error fetching categories:', err)
    }
  }

  const fetchFinancialData = async () => {
    try {
      setLoading(true)
      setError('')
      const params = { limit: 100 }
      if (selectedMonth && selectedYear) {
        params.month = selectedMonth
        params.year = selectedYear
      }
      const response = await getFinancialData(params)
      setTransactions(response.data || [])
    } catch (err) {
      console.error('Error fetching financial data:', err)
      setError(err.message || 'Failed to load financial data')
    } finally {
      setLoading(false)
    }
  }

  const handleAddTransaction = async (e) => {
    e.preventDefault()
    if (!newTransaction.date || !newTransaction.amount || !newTransaction.category || !newTransaction.use_chip) {
      setError('Please fill in all required fields (date, amount, category, payment method)')
      return
    }

    try {
      setError('')
      await addFinancialData({
        date: newTransaction.date,
        amount: parseFloat(newTransaction.amount),
        category: newTransaction.category,
        use_chip: newTransaction.use_chip,
      })
      setShowAddModal(false)
      setNewTransaction({ date: '', amount: '', category: '', use_chip: '' })
      // Refresh data
      await fetchFinancialData()
    } catch (err) {
      console.error('Error adding transaction:', err)
      setError(err.message || 'Failed to add transaction')
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
      const response = await uploadFinancialDataCSV(uploadFile)
      setShowUploadModal(false)
      setUploadFile(null)
      // Refresh data
      await fetchFinancialData()
      alert(`Successfully uploaded ${response.added_count} transactions!`)
    } catch (err) {
      console.error('Error uploading CSV:', err)
      setError(err.message || 'Failed to upload CSV file')
    } finally {
      setUploading(false)
    }
  }

  const formatDate = (dateString, showTime = false) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' }
    if (showTime) {
      options.hour = '2-digit'
      options.minute = '2-digit'
    }
    return date.toLocaleDateString('en-US', options)
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  return (
    <DashboardLayout>
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Expense Analytics</h1>
        <p className="text-gray-400 mb-8">Monitor and analyze expense transactions</p>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 sm:p-4 text-sm sm:text-base bg-red-500/20 border border-red-500/50 text-red-200 rounded-lg">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 sm:gap-4 mb-6 sm:mb-8">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base bg-green-500 text-white rounded-lg hover:bg-opacity-90 transition flex items-center gap-1.5 sm:gap-2"
          >
            <HiPlus className="text-lg sm:text-xl flex-shrink-0" />
            <span className="hidden sm:inline">Add Transaction</span>
            <span className="sm:hidden">Add</span>
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base bg-blue-500 text-white rounded-lg hover:bg-opacity-90 transition flex items-center gap-1.5 sm:gap-2"
          >
            <HiDocumentText className="text-lg sm:text-xl flex-shrink-0" />
            <span className="hidden sm:inline">Upload CSV</span>
            <span className="sm:hidden">CSV</span>
          </button>
          <Link to="/finance/forecast" className="px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base bg-opsly-purple text-white rounded-lg hover:bg-opacity-90 transition flex items-center gap-1.5 sm:gap-2">
            <HiChartBar className="text-lg sm:text-xl flex-shrink-0" />
            <span className="hidden sm:inline">Forecasting</span>
            <span className="sm:hidden">Forecast</span>
          </Link>
          <Link to="/finance/anomaly" className="px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base bg-orange-500 text-white rounded-lg hover:bg-opacity-90 transition flex items-center gap-1.5 sm:gap-2">
            <HiExclamation className="text-lg sm:text-xl flex-shrink-0" />
            <span className="hidden md:inline">Anomaly Detector</span>
            <span className="hidden sm:inline md:hidden">Anomaly</span>
            <span className="sm:hidden">Anomaly</span>
          </Link>
          <Link to="/finance/reports" className="px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base bg-teal-500 text-white rounded-lg hover:bg-opacity-90 transition flex items-center gap-1.5 sm:gap-2">
            <HiDocumentReport className="text-lg sm:text-xl flex-shrink-0" />
            <span className="hidden sm:inline">Reports</span>
            <span className="sm:hidden">Reports</span>
          </Link>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-opsly-card rounded-lg p-6">
            <p className="text-gray-400 mb-2">Total Transactions</p>
            <p className="text-4xl font-bold text-white">{loading ? '...' : totalTransactions}</p>
          </div>
          <div className="bg-opsly-card rounded-lg p-6">
            <p className="text-gray-400 mb-2">Total Expenses</p>
            <p className="text-4xl font-bold text-red-500">
              {loading ? '...' : formatCurrency(totalExpense)}
            </p>
          </div>
          <div className="bg-opsly-card rounded-lg p-6">
            <p className="text-gray-400 mb-2">Average Expense</p>
            <p className="text-4xl font-bold text-white">
              {loading ? '...' : formatCurrency(avgTransaction)}
            </p>
          </div>
        </div>

        {/* Transaction History */}
        <div className="bg-opsly-card rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-white mb-2">Expense History</h2>
              <p className="text-gray-400">Recent expense transactions</p>
            </div>
            <div className="flex items-center gap-4">
              <select
                value={selectedYear || ''}
                onChange={(e) => {
                  const year = e.target.value ? parseInt(e.target.value) : null
                  setSelectedYear(year)
                  if (!year) setSelectedMonth(null)
                }}
                className="px-4 py-2 bg-opsly-dark text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-opsly-purple"
              >
                <option value="">All Years</option>
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <select
                value={selectedMonth || ''}
                onChange={(e) => {
                  const month = e.target.value ? parseInt(e.target.value) : null
                  setSelectedMonth(month)
                }}
                disabled={!selectedYear}
                className="px-4 py-2 bg-opsly-dark text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-opsly-purple disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">All Months</option>
                {[
                  'January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'
                ].map((month, index) => (
                  <option key={index + 1} value={index + 1}>{month}</option>
                ))}
              </select>
              {(selectedMonth || selectedYear) && (
                <button
                  onClick={() => {
                    setSelectedMonth(null)
                    setSelectedYear(null)
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-opacity-90 transition"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-sm sm:text-base text-gray-400">Loading transactions...</div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-sm sm:text-base text-gray-400">
              No transactions found. Add your first transaction to get started!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">Date</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">Amount</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">Category</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">Payment Method</th>
                  {/* Removed Created At column */}
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction, idx) => (
                  <tr key={transaction.id || idx} className="border-b border-gray-800 hover:bg-opsly-dark transition">
                    <td className="py-4 px-4 text-gray-300">{formatDate(transaction.date, true)}</td>
                    <td className="py-4 px-4 font-semibold text-red-500">
                      {formatCurrency(parseFloat(transaction.amount || 0))}
                    </td>
                    <td className="py-4 px-4 text-gray-300">
                      {transaction.category || '-'}
                    </td>
                    <td className="py-4 px-4 text-gray-300">
                      {transaction.use_chip || '-'}
                    </td>
                    {/* Removed Created At cell */}
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-opsly-card rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-white">Add Expense</h3>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setNewTransaction({ date: '', amount: '', category: '', use_chip: '' })
                  setError('')
                }}
                className="text-gray-400 hover:text-white"
              >
                <HiX className="text-2xl" />
              </button>
            </div>
            <form onSubmit={handleAddTransaction}>
              {/* Info about fraud detection */}
              <div className="mb-4 p-3 bg-blue-900/30 border border-blue-500/30 rounded-lg">
                <p className="text-xs text-blue-200">
                  <strong>Note:</strong> Transactions are automatically analyzed for fraud detection. 
                  Please fill in all fields for accurate detection.
                </p>
              </div>
              <div className="mb-4">
                <label className="block text-gray-400 mb-2">Date & Time *</label>
                <input
                  type="datetime-local"
                  value={newTransaction.date}
                  onChange={(e) => setNewTransaction({ ...newTransaction, date: e.target.value })}
                  className="w-full px-4 py-2 bg-opsly-dark text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-opsly-purple"
                  required
                />
                <p className="text-gray-500 text-xs mt-1">Include time for accurate fraud detection</p>
              </div>
              <div className="mb-4">
                <label className="block text-gray-400 mb-2">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                  className="w-full px-4 py-2 bg-opsly-dark text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-opsly-purple"
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-400 mb-2">Category *</label>
                <select
                  value={newTransaction.category}
                  onChange={(e) => setNewTransaction({ ...newTransaction, category: e.target.value })}
                  className="w-full px-4 py-2 bg-opsly-dark text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-opsly-purple"
                  required
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name} {cat.mcc_code ? `(MCC: ${cat.mcc_code})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-gray-500 text-xs mt-1">Category determines MCC code for fraud detection</p>
              </div>
              <div className="mb-4">
                <label className="block text-gray-400 mb-2">Payment Method *</label>
                <select
                  value={newTransaction.use_chip}
                  onChange={(e) => setNewTransaction({ ...newTransaction, use_chip: e.target.value })}
                  className="w-full px-4 py-2 bg-opsly-dark text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-opsly-purple"
                  required
                >
                  <option value="">Select payment method</option>
                  <option value="Swipe Transaction">Swipe Transaction</option>
                  <option value="Chip Transaction">Chip Transaction</option>
                  <option value="Online Transaction">Online Transaction</option>
                </select>
                <p className="text-gray-500 text-xs mt-1">Payment method is used for fraud analysis</p>
              </div>
              <div className="flex gap-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-opacity-90"
                >
                  Add Expense
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setNewTransaction({ date: '', amount: '', category: '', use_chip: '' })
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
              <h3 className="text-xl sm:text-2xl font-bold text-white">Upload CSV File</h3>
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
                  <strong>Required columns:</strong> 'date', 'amount'<br />
                  <strong>Recommended columns for fraud detection:</strong><br />
                  - 'category': Expense category (maps to MCC code)<br />
                  - 'use_chip': Payment method (Swipe Transaction, Chip Transaction, or Online Transaction)<br />
                  <strong>Note:</strong> Include time in date (e.g., 2024-01-15 14:30:00) for accurate fraud detection.
                </p>
              </div>
              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-opacity-90 disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Upload'}
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

export default FinanceDashboard

