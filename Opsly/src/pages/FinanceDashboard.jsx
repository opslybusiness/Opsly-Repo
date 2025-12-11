import { useState, useEffect } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { Link } from 'react-router-dom'
import { HiPlus, HiDocumentText, HiChartBar, HiExclamation, HiX } from 'react-icons/hi'
import { getFinancialData, addFinancialData, uploadFinancialDataCSV } from '../services/financeService'

function FinanceDashboard() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [newTransaction, setNewTransaction] = useState({ date: '', amount: '', transaction_type: 'expense' })
  const [uploadFile, setUploadFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  // Calculate summary statistics
  const totalTransactions = transactions.length
  const totalIncome = transactions
    .filter(t => t.transaction_type === 'income')
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
  const totalExpense = transactions
    .filter(t => t.transaction_type === 'expense')
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
  const netCashFlow = totalIncome - totalExpense
  const avgTransaction = totalTransactions > 0 ? (totalIncome + totalExpense) / totalTransactions : 0

  // Fetch financial data on component mount
  useEffect(() => {
    fetchFinancialData()
  }, [])

  const fetchFinancialData = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await getFinancialData({ limit: 100 })
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
    if (!newTransaction.date || !newTransaction.amount) {
      setError('Please fill in all fields')
      return
    }

    try {
      setError('')
      await addFinancialData({
        date: newTransaction.date,
        amount: parseFloat(newTransaction.amount),
        transaction_type: newTransaction.transaction_type,
      })
      setShowAddModal(false)
      setNewTransaction({ date: '', amount: '', transaction_type: 'expense' })
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

  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
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
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-1 sm:mb-2">Finance Analytics</h1>
        <p className="text-sm sm:text-base text-gray-400 mb-6 sm:mb-8">Monitor and analyze financial transactions</p>

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
            <span className="hidden sm:inline">Modify Forecast</span>
            <span className="sm:hidden">Forecast</span>
          </Link>
          <Link to="/finance/anomaly" className="px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base bg-orange-500 text-white rounded-lg hover:bg-opacity-90 transition flex items-center gap-1.5 sm:gap-2">
            <HiExclamation className="text-lg sm:text-xl flex-shrink-0" />
            <span className="hidden md:inline">Anomaly Detection</span>
            <span className="hidden sm:inline md:hidden">Anomaly</span>
            <span className="sm:hidden">Anomaly</span>
          </Link>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-opsly-card rounded-lg p-4 sm:p-6">
            <p className="text-xs sm:text-sm text-gray-400 mb-2">Total Transactions</p>
            <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">{loading ? '...' : totalTransactions}</p>
          </div>
          <div className="bg-opsly-card rounded-lg p-4 sm:p-6">
            <p className="text-xs sm:text-sm text-gray-400 mb-2">Total Income</p>
            <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-green-500">
              {loading ? '...' : formatCurrency(totalIncome)}
            </p>
          </div>
          <div className="bg-opsly-card rounded-lg p-4 sm:p-6">
            <p className="text-xs sm:text-sm text-gray-400 mb-2">Total Expense</p>
            <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-red-500">
              {loading ? '...' : formatCurrency(totalExpense)}
            </p>
          </div>
          <div className="bg-opsly-card rounded-lg p-4 sm:p-6">
            <p className="text-xs sm:text-sm text-gray-400 mb-2">Net Cash Flow</p>
            <p className={`text-2xl sm:text-3xl md:text-4xl font-bold ${netCashFlow >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {loading ? '...' : formatCurrency(netCashFlow)}
            </p>
          </div>
        </div>

        {/* Transaction History */}
        <div className="bg-opsly-card rounded-lg p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-white mb-1 sm:mb-2">Transaction History</h2>
          <p className="text-sm sm:text-base text-gray-400 mb-4 sm:mb-6">Recent financial transactions</p>

          {loading ? (
            <div className="text-center py-8 text-sm sm:text-base text-gray-400">Loading transactions...</div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-sm sm:text-base text-gray-400">
              No transactions found. Add your first transaction to get started!
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0 max-w-full">
              <div className="inline-block min-w-full align-middle px-4 sm:px-0 max-w-full">
                <table className="min-w-full max-w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 font-semibold">Date</th>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 font-semibold">Type</th>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 font-semibold">Amount</th>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 font-semibold hidden md:table-cell">Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction, idx) => (
                    <tr key={transaction.id || idx} className="border-b border-gray-800 hover:bg-opsly-dark transition">
                      <td className="py-3 sm:py-4 px-2 sm:px-4 text-xs sm:text-sm text-gray-300">{formatDate(transaction.date)}</td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${
                          transaction.transaction_type === 'income' 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {transaction.transaction_type === 'income' ? 'Income' : 'Expense'}
                        </span>
                      </td>
                      <td className={`py-3 sm:py-4 px-2 sm:px-4 text-xs sm:text-sm font-semibold ${
                        transaction.transaction_type === 'income' 
                          ? 'text-green-500' 
                          : 'text-red-500'
                      }`}>
                        {transaction.transaction_type === 'income' ? '+' : '-'}
                        {formatCurrency(parseFloat(transaction.amount || 0))}
                      </td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4 text-xs sm:text-sm text-gray-300 hidden md:table-cell">
                        {transaction.created_at ? formatDate(transaction.created_at) : '-'}
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

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-opsly-card rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl sm:text-2xl font-bold text-white">Add Transaction</h3>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setNewTransaction({ date: '', amount: '', transaction_type: 'expense' })
                  setError('')
                }}
                className="text-gray-400 hover:text-white"
              >
                <HiX className="text-2xl" />
              </button>
            </div>
            <form onSubmit={handleAddTransaction}>
              <div className="mb-4">
                <label className="block text-gray-400 mb-2">Date</label>
                <input
                  type="date"
                  value={newTransaction.date}
                  onChange={(e) => setNewTransaction({ ...newTransaction, date: e.target.value })}
                  className="w-full px-4 py-2 bg-opsly-dark text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-opsly-purple"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-400 mb-2">Transaction Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewTransaction({ ...newTransaction, transaction_type: 'income' })}
                    className={`flex-1 px-4 py-2 rounded-lg transition ${
                      newTransaction.transaction_type === 'income'
                        ? 'bg-green-500 text-white'
                        : 'bg-opsly-dark text-gray-400 hover:bg-opacity-50'
                    }`}
                  >
                    Income
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTransaction({ ...newTransaction, transaction_type: 'expense' })}
                    className={`flex-1 px-4 py-2 rounded-lg transition ${
                      newTransaction.transaction_type === 'expense'
                        ? 'bg-red-500 text-white'
                        : 'bg-opsly-dark text-gray-400 hover:bg-opacity-50'
                    }`}
                  >
                    Expense
                  </button>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-gray-400 mb-2">Amount</label>
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
              <div className="flex gap-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-opacity-90"
                >
                  Add Transaction
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setNewTransaction({ date: '', amount: '', transaction_type: 'expense' })
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
                  CSV must have 'date' and 'amount' columns.<br />
                  Optional: 'transaction_type' column (income/expense, defaults to expense)
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

