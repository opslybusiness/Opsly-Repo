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
      // Group historical data by month and sum expenses
      const monthlyData = {}
      historicalData.forEach((item) => {
        const date = new Date(item.date)
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = 0
        }
        // Sum all expenses
        const amount = parseFloat(item.amount || 0)
        monthlyData[monthKey] += amount
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
      <div>
        <Link to="/finance" className="text-opsly-purple mb-4 inline-block">← Back</Link>
        <h1 className="text-4xl font-bold text-white mb-2">Monthly Forecast</h1>
        <p className="text-gray-400 mb-8">AI-powered expense predictions</p>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 text-red-200 rounded-lg">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-opsly-card rounded-lg p-6">
            <p className="text-gray-400 mb-2">Next Month Expenses</p>
            <p className="text-4xl font-bold mb-2 text-red-500">
              {loading ? '...' : nextMonthPrediction ? formatCurrency(nextMonthPrediction.forecasted_amount) : '$0'}
            </p>
            {nextMonthPrediction && (
              <p className={`text-sm ${calculateGrowth() <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {calculateGrowth() <= 0 ? '' : '+'}{calculateGrowth().toFixed(1)}% from last month
              </p>
            )}
          </div>
          <div className="bg-opsly-card rounded-lg p-6">
            <p className="text-gray-400 mb-2">Avg Previous Monthly</p>
            <p className="text-4xl font-bold text-white mb-2">
              {loading ? '...' : forecastData?.summary?.average_previous_monthly ? formatCurrency(forecastData.summary.average_previous_monthly) : '$0'}
            </p>
            <p className="text-gray-400 text-sm">Based on historical data</p>
          </div>
          <div className="bg-opsly-card rounded-lg p-6">
            <p className="text-gray-400 mb-2">Forecast Period</p>
            <p className="text-4xl font-bold text-white mb-2">
              {loading ? '...' : `${forecastData?.forecast_months || 0} Month(s)`}
            </p>
            <p className="text-gray-400 text-sm">Based on {forecastDays} days</p>
          </div>
          <div className="bg-opsly-card rounded-lg p-6">
            <p className="text-gray-400 mb-2">Forecast Range</p>
            {nextMonthPrediction ? (
              <>
                <p className="text-lg text-white mb-1">
                  Lower: {formatCurrency(nextMonthPrediction.lower_bound)}
                </p>
                <p className="text-lg text-white">
                  Upper: {formatCurrency(nextMonthPrediction.upper_bound)}
                </p>
              </>
            ) : (
              <p className="text-gray-400 text-sm">No forecast available</p>
            )}
          </div>
        </div>

        {/* Spending Trend & Forecast */}
        <div className="bg-opsly-card rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-white">Expense Trend & Forecast</h2>
            <div className="flex items-center gap-4">
              <button
                onClick={fetchForecast}
                disabled={loading}
                className="px-4 py-2 bg-opsly-purple text-white rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 flex items-center gap-2"
                title="Refresh forecast"
              >
                <HiRefresh className={`text-lg ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 mr-2">Forecast</span>
                {[30, 90, 180, 270].map((days) => {
                  const months = Math.ceil(days / 30)
                  return (
                    <button
                      key={days}
                      onClick={() => setForecastDays(days)}
                      disabled={loading}
                      className={`px-4 py-2 rounded transition ${
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
            <div className="text-center py-8 text-gray-400">Loading forecast data...</div>
          ) : chartData.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No data available. Add expense transactions to generate forecasts.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
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
                  label={{ value: 'Expenses ($)', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
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
                  name="Historical Expenses"
                />
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="#F97316"
                  strokeWidth={3}
                  strokeDasharray="5 5"
                  dot={{ fill: '#F97316', r: 5 }}
                  name="Forecasted Expenses"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Forecast Table */}
        {forecastData && forecastData.forecast && forecastData.forecast.length > 0 && (
          <div className="bg-opsly-card rounded-lg p-6 mt-8">
            <h2 className="text-2xl font-semibold text-white mb-4">Detailed Forecast</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-400 font-semibold">Month</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-semibold">Forecasted Amount</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-semibold">Lower Bound</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-semibold">Upper Bound</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-semibold">Range</th>
                  </tr>
                </thead>
                <tbody>
                  {forecastData.forecast.map((item, idx) => {
                    const range = item.upper_bound - item.lower_bound
                    return (
                      <tr key={idx} className="border-b border-gray-800 hover:bg-opsly-dark transition">
                        <td className="py-4 px-4 text-gray-300">
                          {formatMonthLabel(item.date)}
                        </td>
                        <td className="py-4 px-4 text-green-500 font-semibold">
                          {formatCurrency(item.forecasted_amount)}
                        </td>
                        <td className="py-4 px-4 text-gray-400">
                          {formatCurrency(item.lower_bound)}
                        </td>
                        <td className="py-4 px-4 text-gray-400">
                          {formatCurrency(item.upper_bound)}
                        </td>
                        <td className="py-4 px-4 text-gray-400">
                          {formatCurrency(range)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default FinanceForecast

