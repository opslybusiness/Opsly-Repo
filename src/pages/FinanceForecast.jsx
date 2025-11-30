import DashboardLayout from '../components/DashboardLayout'
import { Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useState } from 'react'

const data = [
  { month: 'Jan 2024', actual: 12000 },
  { month: 'Feb 2024', actual: 13500 },
  { month: 'Mar 2024', actual: 14200 },
  { month: 'Apr 2024', actual: 15000 },
  { month: 'May 2024', actual: 15800 },
  { month: 'Jun 2024', actual: 16500 },
  { month: 'Jul 2024', actual: 17000 },
  { month: 'Aug 2024', actual: 17500 },
  { month: 'Sep 2024', actual: 18000 },
  { month: 'Oct 2024', actual: 17800 },
  { month: 'Nov 2024', actual: 18200 },
  { month: 'Dec 2024', actual: 18500 },
  { month: 'Jan 2025', actual: 19000 },
  { month: 'Feb 2025', actual: 19200 },
  { month: 'Mar 2025', actual: 19500 },
  { month: 'Apr 2025', actual: 19800 },
  { month: 'May 2025', actual: 20000, predicted: 20000 },
  { month: 'Jun 2025', predicted: 20470 },
]

function FinanceForecast() {
  const [forecastMonths, setForecastMonths] = useState(1)

  return (
    <DashboardLayout userName="Amanda">
      <div>
        <Link to="/finance" className="text-opsly-purple mb-4 inline-block">← Back</Link>
        <h1 className="text-4xl font-bold text-white mb-2">Monthly Forecast</h1>
        <p className="text-gray-400 mb-8">AI-powered spending predictions</p>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-opsly-card rounded-lg p-6">
            <p className="text-gray-400 mb-2">Next Month Prediction</p>
            <p className="text-4xl font-bold text-white mb-2">$18,470</p>
            <p className="text-opsly-purple text-sm">+6.2% from last month</p>
          </div>
          <div className="bg-opsly-card rounded-lg p-6">
            <p className="text-gray-400 mb-2">Confidence Level</p>
            <p className="text-4xl font-bold text-white mb-2">87%</p>
            <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm">High Accuracy</span>
          </div>
          <div className="bg-opsly-card rounded-lg p-6">
            <p className="text-gray-400 mb-2">Forecast Period</p>
            <p className="text-4xl font-bold text-white mb-2">1 Month</p>
            <p className="text-gray-400 text-sm">Adjustable</p>
          </div>
        </div>

        {/* Spending Trend & Forecast */}
        <div className="bg-opsly-card rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-white">Spending Trend & Forecast</h2>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 mr-2">Predict</span>
              {[1, 3, 6, 9].map((months) => (
                <button
                  key={months}
                  onClick={() => setForecastMonths(months)}
                  className={`px-4 py-2 rounded ${
                    forecastMonths === months
                      ? 'bg-opsly-purple text-white'
                      : 'bg-opsly-dark text-gray-400 hover:bg-opacity-50'
                  }`}
                >
                  {months}
                </button>
              ))}
              <span className="text-gray-400 ml-2">month(s)</span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={data}>
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
                label={{ value: 'Spending ($)', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1E1E2E', border: '1px solid #374151', color: '#fff' }}
              />
              <Legend wrapperStyle={{ color: '#fff' }} />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#9333EA"
                strokeWidth={2}
                dot={{ fill: '#9333EA' }}
                name="Actual Spending -> Predicted Spending"
              />
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#F97316"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#F97316' }}
                name="Historical Data -> AI Prediction"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default FinanceForecast

