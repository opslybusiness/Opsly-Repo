import DashboardLayout from '../components/DashboardLayout'
import { Link } from 'react-router-dom'
import { HiPlus, HiDocumentText, HiChartBar, HiExclamation } from 'react-icons/hi'

const transactions = [
  { date: '2025-06-15', clientId: 'C002M', amount: '$1250.80', category: 'Electronics', useChip: 'Snipe', merchant: 'Apple Store', city: 'New York', state: 'NY' },
  { date: '2025-06-14', clientId: 'C0189', amount: '$150.75', category: 'Groceries', useChip: 'Chip', merchant: 'Whole Foods Market', city: 'Los Angeles', state: 'CA' },
  { date: '2025-06-14', clientId: 'C00421', amount: '$850.00', category: 'Travel', useChip: 'Celery', merchant: 'Delta Airlines', city: 'Chicago', state: 'IL' },
  { date: '2025-06-13', clientId: 'C0056', amount: '$45.20', category: 'Fuel', useChip: 'Chip', merchant: 'Shell Gas Station', city: 'Houston', state: 'TX' },
  { date: '2025-06-13', clientId: 'C0078', amount: '$320.50', category: 'Food & Dining', useChip: 'Snipe', merchant: 'Target', city: 'Phoenix', state: 'AZ' },
  { date: '2025-06-12', clientId: 'C0091', amount: '$12.50', category: 'Food & Dining', useChip: 'Chip', merchant: 'Starbucks', city: 'Philadelphia', state: 'PA' },
  { date: '2025-06-12', clientId: 'C0102', amount: '$450.00', category: 'Shopping', useChip: 'Snipe', merchant: 'Amazon', city: 'San Antonio', state: 'TX' },
  { date: '2025-06-11', clientId: 'C0115', amount: '$89.99', category: 'Healthcare', useChip: 'Chip', merchant: 'CVS Pharmacy', city: 'San Diego', state: 'CA' },
  { date: '2025-06-11', clientId: 'C0128', amount: '$650.00', category: 'Travel', useChip: 'Celery', merchant: 'Hilton Hotel', city: 'Dallas', state: 'TX' },
  { date: '2025-06-10', clientId: 'C0141', amount: '$280.00', category: 'Electronics', useChip: 'Snipe', merchant: 'Best Buy', city: 'San Jose', state: 'CA' },
  { date: '2025-06-10', clientId: 'C0154', amount: '$15.99', category: 'Entertainment', useChip: 'Snipe', merchant: 'Netflix', city: 'Austin', state: 'TX' },
  { date: '2025-06-09', clientId: 'C0167', amount: '$1200.00', category: 'Automotive', useChip: 'Chip', merchant: 'Toyota Dealership', city: 'Jacksonville', state: 'FL' },
]

function FinanceDashboard() {
  return (
    <DashboardLayout userName="Amanda">
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Finance Analytics</h1>
        <p className="text-gray-400 mb-8">Monitor and analyze financial transactions</p>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 mb-8">
          <button className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-opacity-90 transition flex items-center gap-2">
            <HiPlus className="text-xl" />
            Add Transaction
          </button>
          <button className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-opacity-90 transition flex items-center gap-2">
            <HiDocumentText className="text-xl" />
            Generate Report
          </button>
          <Link to="/finance/forecast" className="px-6 py-3 bg-opsly-purple text-white rounded-lg hover:bg-opacity-90 transition flex items-center gap-2">
            <HiChartBar className="text-xl" />
            Modify Forecast
          </Link>
          <Link to="/finance/anomaly" className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-opacity-90 transition flex items-center gap-2">
            <HiExclamation className="text-xl" />
            Anomaly Detection
          </Link>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-opsly-card rounded-lg p-6">
            <p className="text-gray-400 mb-2">Total Transactions</p>
            <p className="text-4xl font-bold text-white">12</p>
          </div>
          <div className="bg-opsly-card rounded-lg p-6">
            <p className="text-gray-400 mb-2">Total Value</p>
            <p className="text-4xl font-bold text-white">$12,960.1</p>
          </div>
          <div className="bg-opsly-card rounded-lg p-6">
            <p className="text-gray-400 mb-2">Avg Transaction</p>
            <p className="text-4xl font-bold text-white">$1081.67</p>
          </div>
        </div>

        {/* Transaction History */}
        <div className="bg-opsly-card rounded-lg p-6">
          <h2 className="text-2xl font-semibold text-white mb-2">Transaction History</h2>
          <p className="text-gray-400 mb-6">Recent financial transactions</p>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">Date</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">Client ID</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">Amount</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">Category</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">Use Chip</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">Merchant Name</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">City</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">State</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction, idx) => (
                  <tr key={idx} className="border-b border-gray-800 hover:bg-opsly-dark transition">
                    <td className="py-4 px-4 text-gray-300">{transaction.date}</td>
                    <td className={`py-4 px-4 ${idx % 3 === 0 ? 'text-opsly-purple' : 'text-white'}`}>
                      {transaction.clientId}
                    </td>
                    <td className="py-4 px-4 text-green-500 font-semibold">{transaction.amount}</td>
                    <td className="py-4 px-4 text-gray-300">{transaction.category}</td>
                    <td className="py-4 px-4 text-gray-300">{transaction.useChip}</td>
                    <td className="py-4 px-4 text-gray-300">{transaction.merchant}</td>
                    <td className="py-4 px-4 text-gray-300">{transaction.city}</td>
                    <td className="py-4 px-4 text-gray-300">{transaction.state}</td>
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

export default FinanceDashboard

