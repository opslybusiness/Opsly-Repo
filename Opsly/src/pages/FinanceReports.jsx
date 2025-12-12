import { useState, useEffect } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { Link } from 'react-router-dom'
import { HiArrowLeft, HiDownload, HiRefresh } from 'react-icons/hi'
import { getFinancialData, getCategories } from '../services/financeService'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts'

const COLORS = ['#8B5CF6', '#EC4899', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#14B8A6']

function FinanceReports() {
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError('')
      const [financeRes, categoriesRes] = await Promise.all([
        getFinancialData({ limit: 500 }),
        getCategories()
      ])
      setTransactions(financeRes.data || [])
      setCategories(categoriesRes.categories || [])
    } catch (err) {
      console.error('Error fetching data:', err)
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  // Calculate summary statistics
  const totalTransactions = transactions.length
  const totalExpense = transactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
  const avgTransaction = totalTransactions > 0 ? totalExpense / totalTransactions : 0

  // Group by category for pie chart
  const categoryData = transactions.reduce((acc, t) => {
    const cat = t.category || 'Uncategorized'
    acc[cat] = (acc[cat] || 0) + parseFloat(t.amount || 0)
    return acc
  }, {})

  const pieChartData = Object.entries(categoryData)
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8) // Top 8 categories

  // Group by month for trend chart
  const monthlyData = transactions.reduce((acc, t) => {
    if (!t.date) return acc
    const date = new Date(t.date)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    acc[monthKey] = (acc[monthKey] || 0) + parseFloat(t.amount || 0)
    return acc
  }, {})

  const trendChartData = Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12) // Last 12 months
    .map(([month, amount]) => ({
      month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      amount: Math.round(amount * 100) / 100
    }))

  // Group by payment method
  const paymentMethodData = transactions.reduce((acc, t) => {
    const method = t.use_chip || 'Unknown'
    acc[method] = (acc[method] || 0) + 1
    return acc
  }, {})

  const paymentChartData = Object.entries(paymentMethodData)
    .map(([name, count]) => ({ name, count }))

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const handleExportReport = () => {
    // Create comprehensive CSV report with all chart data
    const sections = []

    // Section 1: Summary
    sections.push('=== FINANCIAL SUMMARY ===')
    sections.push('Metric,Value')
    sections.push(`Total Transactions,${totalTransactions}`)
    sections.push(`Total Expenses,$${totalExpense.toFixed(2)}`)
    sections.push(`Average Transaction,$${avgTransaction.toFixed(2)}`)
    sections.push(`Categories Used,${Object.keys(categoryData).length}`)
    sections.push('')

    // Section 2: Monthly Trend
    sections.push('=== MONTHLY EXPENSE TREND ===')
    sections.push('Month,Amount')
    trendChartData.forEach(item => {
      sections.push(`${item.month},$${item.amount.toFixed(2)}`)
    })
    sections.push('')

    // Section 3: Category Breakdown
    sections.push('=== EXPENSE BY CATEGORY ===')
    sections.push('Category,Amount,Percentage')
    const totalForPercentage = pieChartData.reduce((sum, item) => sum + item.value, 0)
    pieChartData.forEach(item => {
      const percentage = totalForPercentage > 0 ? ((item.value / totalForPercentage) * 100).toFixed(1) : 0
      sections.push(`"${item.name}",$${item.value.toFixed(2)},${percentage}%`)
    })
    sections.push('')

    // Section 4: Payment Methods
    sections.push('=== PAYMENT METHODS ===')
    sections.push('Payment Method,Transaction Count')
    paymentChartData.forEach(item => {
      sections.push(`"${item.name}",${item.count}`)
    })
    sections.push('')

    // Section 5: All Transactions
    sections.push('=== ALL TRANSACTIONS ===')
    sections.push('Date,Amount,Category,Payment Method')
    transactions.forEach(t => {
      sections.push(`${t.date || '-'},$${parseFloat(t.amount || 0).toFixed(2)},"${t.category || '-'}","${t.use_chip || '-'}"`)
    })

    const csvContent = sections.join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `financial_report_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <DashboardLayout>
      <div className="min-w-0 max-w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link to="/finance" className="text-gray-400 hover:text-white transition">
                <HiArrowLeft className="text-xl" />
              </Link>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">Financial Reports</h1>
            </div>
            <p className="text-sm sm:text-base text-gray-400">Comprehensive overview of your financial data</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-4 py-2 bg-opsly-card text-white rounded-lg hover:bg-opacity-80 transition flex items-center gap-2 disabled:opacity-50"
            >
              <HiRefresh className={`text-lg ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={handleExportReport}
              disabled={loading || transactions.length === 0}
              className="px-4 py-2 bg-opsly-purple text-white rounded-lg hover:bg-opacity-90 transition flex items-center gap-2 disabled:opacity-50"
            >
              <HiDownload className="text-lg" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 text-red-200 rounded-lg">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-opsly-card rounded-xl p-5">
            <p className="text-gray-400 text-sm mb-1">Total Transactions</p>
            <p className="text-3xl font-bold text-white">{loading ? '...' : totalTransactions}</p>
          </div>
          <div className="bg-opsly-card rounded-xl p-5">
            <p className="text-gray-400 text-sm mb-1">Total Expenses</p>
            <p className="text-3xl font-bold text-red-400">{loading ? '...' : formatCurrency(totalExpense)}</p>
          </div>
          <div className="bg-opsly-card rounded-xl p-5">
            <p className="text-gray-400 text-sm mb-1">Average Transaction</p>
            <p className="text-3xl font-bold text-blue-400">{loading ? '...' : formatCurrency(avgTransaction)}</p>
          </div>
          <div className="bg-opsly-card rounded-xl p-5">
            <p className="text-gray-400 text-sm mb-1">Categories Used</p>
            <p className="text-3xl font-bold text-purple-400">{loading ? '...' : Object.keys(categoryData).length}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-opsly-purple border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">Loading report data...</p>
            </div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="bg-opsly-card rounded-xl p-12 text-center">
            <p className="text-gray-400 text-lg mb-4">No transaction data available</p>
            <Link to="/finance" className="text-opsly-purple hover:underline">
              Add transactions to generate reports
            </Link>
          </div>
        ) : (
          <>
            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Monthly Trend Chart */}
              <div className="bg-opsly-card rounded-xl p-5">
                <h3 className="text-lg font-semibold text-white mb-4">Monthly Expense Trend</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                      <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={(v) => `$${v}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                        labelStyle={{ color: '#fff' }}
                        formatter={(value) => [formatCurrency(value), 'Amount']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="amount" 
                        stroke="#8B5CF6" 
                        strokeWidth={3}
                        dot={{ fill: '#8B5CF6', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: '#A78BFA' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Category Breakdown Pie Chart */}
              <div className="bg-opsly-card rounded-xl p-5">
                <h3 className="text-lg font-semibold text-white mb-4">Expense by Category</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name.slice(0, 10)}${name.length > 10 ? '..' : ''} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                        formatter={(value) => [formatCurrency(value), 'Amount']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Second Row Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Category Bar Chart */}
              <div className="bg-opsly-card rounded-xl p-5">
                <h3 className="text-lg font-semibold text-white mb-4">Top Categories by Amount</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pieChartData.slice(0, 6)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis type="number" stroke="#9CA3AF" fontSize={12} tickFormatter={(v) => `$${v}`} />
                      <YAxis type="category" dataKey="name" stroke="#9CA3AF" fontSize={11} width={80} tickFormatter={(v) => v.slice(0, 12)} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                        formatter={(value) => [formatCurrency(value), 'Amount']}
                      />
                      <Bar dataKey="value" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Payment Method Chart */}
              <div className="bg-opsly-card rounded-xl p-5">
                <h3 className="text-lg font-semibold text-white mb-4">Payment Methods</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={paymentChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" stroke="#9CA3AF" fontSize={11} />
                      <YAxis stroke="#9CA3AF" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                        labelStyle={{ color: '#fff' }}
                      />
                      <Bar dataKey="count" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Recent Transactions Table */}
            <div className="bg-opsly-card rounded-xl p-5">
              <h3 className="text-lg font-semibold text-white mb-4">Recent Transactions</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4 text-gray-400 font-semibold text-sm">Date</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-semibold text-sm">Category</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-semibold text-sm">Payment</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-semibold text-sm">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.slice(0, 10).map((t, index) => (
                      <tr key={index} className="border-b border-gray-800">
                        <td className="py-3 px-4 text-gray-300 text-sm">
                          {t.date ? new Date(t.date).toLocaleDateString() : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 bg-opsly-purple/20 text-purple-300 rounded text-xs">
                            {t.category || 'Uncategorized'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-300 text-sm">{t.use_chip || '-'}</td>
                        <td className="py-3 px-4 text-right text-red-400 font-medium text-sm">
                          {formatCurrency(t.amount || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {transactions.length > 10 && (
                <p className="text-center text-gray-500 text-sm mt-4">
                  Showing 10 of {transactions.length} transactions
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}

export default FinanceReports

