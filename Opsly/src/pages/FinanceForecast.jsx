import { useState, useEffect } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { getFinancialForecast, getFinancialData } from '../services/financeService'
import { HiRefresh } from 'react-icons/hi'

function FinanceForecast() {
  const [forecastDays, setForecastDays] = useState(30)
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [forecastData, setForecastData] = useState(null)
  const [nextMonthPrediction, setNextMonthPrediction] = useState(null)

  useEffect(() => {
    fetchForecast()
  }, [forecastDays])

  const fetchForecast = async () => {
    try {
      setLoading(true)
      setError('')
      
      // Get historical data
      const historicalResponse = await getFinancialData({ limit: 100 })
      const historicalData = historicalResponse.data || []

      // Get forecast
      const forecastResponse = await getFinancialForecast(forecastDays)
      setForecastData(forecastResponse)

      // Prepare chart data
      // Group historical data by month and calculate net cash flow (income - expense)
      const monthlyData = {}
      historicalData.forEach((item) => {
        const date = new Date(item.date)
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = 0
        }
        // Income is positive, expense is negative
        const amount = parseFloat(item.amount || 0)
        monthlyData[monthKey] += item.transaction_type === 'income' ? amount : -amount
      })

      // Format historical data for chart
      const historicalChartData = Object.entries(monthlyData)
        .sort()
        .map(([month, amount]) => ({
          month: formatMonthLabel(month),
          actual: amount,
        }))

      // Add forecast data
      const forecastChartData = forecastResponse.forecast.map((item) => ({
        month: formatMonthLabel(item.date),
        predicted: item.forecasted_amount,
        lowerBound: item.lower_bound,
        upperBound: item.upper_bound,
      }))

      // Combine and set chart data
      const combinedData = [...historicalChartData, ...forecastChartData]
      setChartData(combinedData)

      // Set next month prediction (first forecast entry)
      if (forecastResponse.forecast && forecastResponse.forecast.length > 0) {
        setNextMonthPrediction(forecastResponse.forecast[0])
      }
    } catch (err) {
      console.error('Error fetching forecast:', err)
      setError(err.message || 'Failed to load forecast data')
    } finally {
      setLoading(false)
    }
  }

  const formatMonthLabel = (dateString) => {
    const date = new Date(dateString + '-01')
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const calculateGrowth = () => {
    if (!chartData.length || !nextMonthPrediction) return 0
    const lastActual = chartData.filter((d) => d.actual).pop()?.actual
    if (!lastActual) return 0
    return ((nextMonthPrediction.forecasted_amount - lastActual) / lastActual) * 100
  }

  return (
    <DashboardLayout userName="Amanda">
      <div className="min-w-0 max-w-full">
        <Link to="/finance" className="text-sm sm:text-base text-opsly-purple mb-3 sm:mb-4 inline-block hover:underline">← Back</Link>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-1 sm:mb-2">Monthly Forecast</h1>
        <p className="text-sm sm:text-base text-gray-400 mb-6 sm:mb-8">AI-powered net cash flow predictions (Income - Expense)</p>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 sm:p-4 text-sm sm:text-base bg-red-500/20 border border-red-500/50 text-red-200 rounded-lg">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-opsly-card rounded-lg p-4 sm:p-6">
            <p className="text-xs sm:text-sm text-gray-400 mb-2">Next Month Net Cash Flow</p>
            <p className={`text-2xl sm:text-3xl md:text-4xl font-bold mb-2 ${
              nextMonthPrediction && nextMonthPrediction.forecasted_amount >= 0 
                ? 'text-green-500' 
                : 'text-red-500'
            }`}>
              {loading ? '...' : nextMonthPrediction ? formatCurrency(nextMonthPrediction.forecasted_amount) : '$0'}
            </p>
            {nextMonthPrediction && (
              <p className={`text-xs sm:text-sm ${calculateGrowth() >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {calculateGrowth() >= 0 ? '+' : ''}{calculateGrowth().toFixed(1)}% from last month
              </p>
            )}
          </div>
          <div className="bg-opsly-card rounded-lg p-4 sm:p-6">
            <p className="text-xs sm:text-sm text-gray-400 mb-2">Forecast Period</p>
            <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2">
              {loading ? '...' : `${forecastData?.forecast_months || 0} Month(s)`}
            </p>
            <p className="text-xs sm:text-sm text-gray-400">Based on {forecastDays} days</p>
          </div>
          <div className="bg-opsly-card rounded-lg p-4 sm:p-6 sm:col-span-2 lg:col-span-1">
            <p className="text-xs sm:text-sm text-gray-400 mb-2">Forecast Range</p>
            {nextMonthPrediction ? (
              <>
                <p className="text-sm sm:text-base md:text-lg text-white mb-1">
                  Lower: {formatCurrency(nextMonthPrediction.lower_bound)}
                </p>
                <p className="text-sm sm:text-base md:text-lg text-white">
                  Upper: {formatCurrency(nextMonthPrediction.upper_bound)}
                </p>
              </>
            ) : (
              <p className="text-xs sm:text-sm text-gray-400">No forecast available</p>
            )}
          </div>
        </div>

        {/* Spending Trend & Forecast */}
        <div className="bg-opsly-card rounded-lg p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-white">Net Cash Flow Trend & Forecast</h2>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <button
                onClick={fetchForecast}
                disabled={loading}
                className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-opsly-purple text-white rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                title="Refresh forecast"
              >
                <HiRefresh className={`text-base sm:text-lg flex-shrink-0 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm text-gray-400 mr-1 sm:mr-2 whitespace-nowrap">Forecast</span>
                {[30, 90, 180, 270].map((days) => {
                  const months = Math.ceil(days / 30)
                  return (
                    <button
                      key={days}
                      onClick={() => setForecastDays(days)}
                      disabled={loading}
                      className={`px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded transition ${
                        forecastDays === days
                          ? 'bg-opsly-purple text-white'
                          : 'bg-opsly-dark text-gray-400 hover:bg-opacity-50'
                      } disabled:opacity-50`}
                    >
                      {months}M
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-sm sm:text-base text-gray-400">Loading forecast data...</div>
          ) : chartData.length === 0 ? (
            <div className="text-center py-8 text-sm sm:text-base text-gray-400">
              No data available. Add financial transactions (income and/or expense) to generate forecasts.
            </div>
          ) : (
            <div className="w-full" style={{ height: '300px', minHeight: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="month"
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF' }}
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF' }}
                  label={{ value: 'Net Cash Flow ($)', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1E1E2E', border: '1px solid #374151', color: '#fff' }}
                  formatter={(value) => formatCurrency(value)}
                />
                <Legend wrapperStyle={{ color: '#fff' }} />
                {/* Confidence interval lines */}
                {chartData.some(d => d.lowerBound) && (
                  <Line
                    type="monotone"
                    dataKey="lowerBound"
                    stroke="#F97316"
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    dot={false}
                    strokeOpacity={0.4}
                    name="Lower Bound"
                  />
                )}
                {chartData.some(d => d.upperBound) && (
                  <Line
                    type="monotone"
                    dataKey="upperBound"
                    stroke="#F97316"
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    dot={false}
                    strokeOpacity={0.4}
                    name="Upper Bound"
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#9333EA"
                  strokeWidth={3}
                  dot={{ fill: '#9333EA', r: 5 }}
                  name="Historical Net Cash Flow"
                />
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="#F97316"
                  strokeWidth={3}
                  strokeDasharray="5 5"
                  dot={{ fill: '#F97316', r: 5 }}
                  name="Forecasted Net Cash Flow"
                />
              </LineChart>
            </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Forecast Table */}
        {forecastData && forecastData.forecast && forecastData.forecast.length > 0 && (
          <div className="bg-opsly-card rounded-lg p-4 sm:p-6 mt-6 sm:mt-8">
            <h2 className="text-xl sm:text-2xl font-semibold text-white mb-3 sm:mb-4">Detailed Forecast</h2>
            <div className="overflow-x-auto -mx-4 sm:mx-0 max-w-full">
              <div className="inline-block min-w-full align-middle px-4 sm:px-0 max-w-full">
                <table className="min-w-full max-w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 font-semibold">Month</th>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 font-semibold">Forecasted</th>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 font-semibold hidden md:table-cell">Lower Bound</th>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 font-semibold hidden md:table-cell">Upper Bound</th>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 font-semibold hidden lg:table-cell">Range</th>
                  </tr>
                </thead>
                <tbody>
                  {forecastData.forecast.map((item, idx) => {
                    const range = item.upper_bound - item.lower_bound
                    return (
                      <tr key={idx} className="border-b border-gray-800 hover:bg-opsly-dark transition">
                        <td className="py-3 sm:py-4 px-2 sm:px-4 text-xs sm:text-sm text-gray-300">
                          {formatMonthLabel(item.date)}
                        </td>
                        <td className="py-3 sm:py-4 px-2 sm:px-4 text-xs sm:text-sm text-green-500 font-semibold">
                          {formatCurrency(item.forecasted_amount)}
                        </td>
                        <td className="py-3 sm:py-4 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 hidden md:table-cell">
                          {formatCurrency(item.lower_bound)}
                        </td>
                        <td className="py-3 sm:py-4 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 hidden md:table-cell">
                          {formatCurrency(item.upper_bound)}
                        </td>
                        <td className="py-3 sm:py-4 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 hidden lg:table-cell">
                          {formatCurrency(range)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default FinanceForecast

