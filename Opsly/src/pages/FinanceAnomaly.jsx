import DashboardLayout from '../components/DashboardLayout'
import { Link } from 'react-router-dom'
import { HiExclamation } from 'react-icons/hi'

const anomalies = [
  { date: '2021-01-15', cardId: 'C14734', amount: '$800.00', useChip: 'Online', merchantId: 'M0234', city: 'New York', state: 'NY', anomalyType: 'Unusual Amount', riskScore: 92 },
  { date: '2021-01-14', cardId: 'C16670', amount: '$200.00', useChip: 'Online', merchantId: 'Unknown', city: 'XX', state: 'XX', anomalyType: 'Excessive Merchant', riskScore: 97 },
  { date: '2021-01-13', cardId: 'C14947', amount: '$241.00', useChip: 'Online', merchantId: 'M7534', city: 'Phoenix', state: 'AZ', anomalyType: 'Unusual Location', riskScore: 78 },
  { date: '2021-01-12', cardId: 'C18890', amount: '$500.00', useChip: 'Online', merchantId: 'M0089', city: 'International', state: 'XX', anomalyType: 'Foreign Transaction', riskScore: 87 },
  { date: '2021-01-11', cardId: 'C15346', amount: '$450.00', useChip: 'Online', merchantId: 'M9856', city: 'Dallas', state: 'TX', anomalyType: 'Unusual Amount', riskScore: 91 },
  { date: '2021-01-10', cardId: 'C13093', amount: '$750.00', useChip: 'Chip', merchantId: 'M7717', city: 'Miami', state: 'FL', anomalyType: 'Multiple Transactions', riskScore: 92 },
  { date: '2021-01-09', cardId: 'C14790', amount: '$120.00', useChip: 'Online', merchantId: 'M4345', city: 'Las Vegas', state: 'NV', anomalyType: 'Unusual Return', riskScore: 79 },
  { date: '2021-01-08', cardId: 'C14799', amount: '$130.00', useChip: 'Online', merchantId: 'M0005', city: 'Seattle', state: 'WA', anomalyType: 'Unusual Amount', riskScore: 90 },
  { date: '2021-01-07', cardId: 'C14759', amount: '$280.00', useChip: 'Online', merchantId: 'M9495', city: 'Unknown', state: 'XX', anomalyType: 'Knockdown Merchant', riskScore: 89 },
]

function FinanceAnomaly() {
  const getRiskColor = (score) => {
    if (score >= 80) return 'text-red-500'
    if (score >= 70) return 'text-orange-500'
    return 'text-yellow-500'
  }

  return (
    <DashboardLayout userName="Amanda">
      <div>
        <Link to="/finance" className="text-opsly-purple mb-4 inline-block">← Back</Link>
        <h1 className="text-4xl font-bold text-white mb-2">Anomaly Detection</h1>
        <p className="text-gray-400 mb-8">All detected suspicious transactions</p>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-red-900 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <HiExclamation className="text-2xl text-red-500" />
              <p className="text-gray-300">High Risk</p>
            </div>
            <p className="text-4xl font-bold text-white">3</p>
          </div>
          <div className="bg-orange-900 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <HiExclamation className="text-2xl text-orange-500" />
              <p className="text-gray-300">Medium Risk</p>
            </div>
            <p className="text-4xl font-bold text-white">4</p>
          </div>
          <div className="bg-opsly-card rounded-lg p-6">
            <p className="text-gray-400 mb-2">Total Anomalies</p>
            <p className="text-4xl font-bold text-white">9</p>
          </div>
          <div className="bg-opsly-card rounded-lg p-6">
            <p className="text-gray-400 mb-2">Total Amount at Risk</p>
            <p className="text-4xl font-bold text-white">$63,475</p>
          </div>
        </div>

        {/* Detected Anomalies Table */}
        <div className="bg-opsly-card rounded-lg p-6">
          <h2 className="text-2xl font-semibold text-white mb-2">Detected Anomalies</h2>
          <p className="text-gray-400 mb-6">Transactions flagged by AI algorithms</p>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">Date</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">Card ID</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">Amount</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">Use Chip</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">Merchant ID</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">City</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">State</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">Anomaly Type</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">Risk Score</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.map((anomaly, idx) => (
                  <tr key={idx} className="border-b border-gray-800 hover:bg-opsly-dark transition">
                    <td className="py-4 px-4 text-gray-300">{anomaly.date}</td>
                    <td className="py-4 px-4 text-white">{anomaly.cardId}</td>
                    <td className="py-4 px-4 text-white">{anomaly.amount}</td>
                    <td className="py-4 px-4 text-gray-300">{anomaly.useChip}</td>
                    <td className="py-4 px-4 text-gray-300">{anomaly.merchantId}</td>
                    <td className="py-4 px-4 text-gray-300">{anomaly.city}</td>
                    <td className="py-4 px-4 text-gray-300">{anomaly.state}</td>
                    <td className="py-4 px-4 text-gray-300">{anomaly.anomalyType}</td>
                    <td className={`py-4 px-4 font-semibold ${getRiskColor(anomaly.riskScore)}`}>
                      {anomaly.riskScore}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default FinanceAnomaly

