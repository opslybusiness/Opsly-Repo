import DashboardLayout from '../components/DashboardLayout'
import { Link, useNavigate } from 'react-router-dom'
import { HiArrowUp, HiClock } from 'react-icons/hi'

const tickets = [
  { id: 'TKT-1001', status: 'Open', statusColor: 'bg-opsly-purple', time: '-', caller: '-', category: '-', source: '-' },
]

function CustomerSupportDashboard() {
  const navigate = useNavigate()

  return (
    <DashboardLayout>
      <div className="min-w-0 max-w-full">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4 sm:mb-6 md:mb-8">Customer Support</h1>

        {/* Customer Insights */}
        <div className="bg-opsly-card rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-semibold text-white mb-4 sm:mb-6">Insights</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-opsly-dark rounded-lg p-4 sm:p-6">
              <p className="text-sm sm:text-base text-gray-400 mb-2">Total Tickets Today</p>
              <p className="text-3xl sm:text-4xl font-bold text-white">-</p>
            </div>
            <div className="bg-opsly-dark rounded-lg p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm sm:text-base text-gray-400">All Resolved Tickets</p>
                <HiArrowUp className="text-green-500 text-lg sm:text-xl flex-shrink-0" />
              </div>
              <p className="text-3xl sm:text-4xl font-bold text-white">-</p>
            </div>
            <div className="bg-opsly-dark rounded-lg p-4 sm:p-6 sm:col-span-2 md:col-span-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm sm:text-base text-gray-400">Avg Response Time</p>
                <HiClock className="text-white text-lg sm:text-xl flex-shrink-0" />
              </div>
              <p className="text-3xl sm:text-4xl font-bold text-white">-</p>
            </div>
          </div>
        </div>

        {/* All Support Tickets */}
        <div className="bg-opsly-card rounded-lg p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-2">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold text-white">All Support Tickets</h2>
              <p className="text-sm sm:text-base text-gray-400 mt-1">-</p>
            </div>
          </div>

          <div className="overflow-x-auto -mx-4 sm:mx-0 max-w-full">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0 max-w-full">
              <table className="min-w-full max-w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 font-semibold">Ticket ID</th>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 font-semibold">Status</th>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 font-semibold hidden sm:table-cell">Time</th>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 font-semibold">Caller</th>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 font-semibold hidden md:table-cell">Category</th>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-400 font-semibold hidden lg:table-cell">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr 
                      key={ticket.id} 
                      onClick={() => navigate(`/customer-support/ticket/${ticket.id}`)}
                      className="border-b border-gray-800 hover:bg-opsly-dark transition cursor-pointer"
                    >
                      <td className="py-3 sm:py-4 px-2 sm:px-4">
                        <span className="text-xs sm:text-sm text-opsly-purple hover:underline">
                          {ticket.id}
                        </span>
                      </td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4">
                        <span className={`${ticket.statusColor} text-white px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-semibold whitespace-nowrap`}>
                          {ticket.status}
                        </span>
                      </td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4 text-xs sm:text-sm text-gray-300 hidden sm:table-cell">{ticket.time}</td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4 text-xs sm:text-sm text-white truncate max-w-[120px] sm:max-w-none">{ticket.caller}</td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4 text-xs sm:text-sm text-gray-300 hidden md:table-cell">{ticket.category}</td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4 text-xs sm:text-sm text-gray-300 hidden lg:table-cell">{ticket.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default CustomerSupportDashboard

