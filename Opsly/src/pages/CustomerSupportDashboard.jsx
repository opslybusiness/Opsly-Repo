import DashboardLayout from '../components/DashboardLayout'
import { Link, useNavigate } from 'react-router-dom'
import { HiArrowUp, HiClock } from 'react-icons/hi'

const tickets = [
  { id: 'TKT-1824', status: 'Urgent', statusColor: 'bg-red-500', time: '2 min ago', caller: 'John Martinez', category: 'Payment Issue', source: 'Call' },
  { id: 'TKT-1823', status: 'Open', statusColor: 'bg-opsly-purple', time: '26 min ago', caller: 'Sarah Chen', category: 'Account Access', source: 'Text' },
  { id: 'TKT-1822', status: 'Resolved', statusColor: 'bg-green-500', time: '1 hour ago', caller: 'Michael Brown', category: 'Feature Request', source: 'Call' },
  { id: 'TKT-1821', status: 'In Progress', statusColor: 'bg-blue-500', time: '2 hours ago', caller: 'Emily Watson', category: 'Bug Report', source: 'Call' },
  { id: 'TKT-1820', status: 'Resolved', statusColor: 'bg-green-500', time: '3 hours ago', caller: 'David Lee', category: 'Integration Issue', source: 'Call' },
  { id: 'TKT-1819', status: 'Open', statusColor: 'bg-opsly-purple', time: '4 hours ago', caller: 'Lisa Anderson', category: 'Billing Question', source: 'Text' },
  { id: 'TKT-1818', status: 'In Progress', statusColor: 'bg-blue-500', time: '5 hours ago', caller: 'Robert Taylor', category: 'Technical Support', source: 'Call' },
  { id: 'TKT-1817', status: 'Urgent', statusColor: 'bg-red-500', time: '6 hours ago', caller: 'Maria Garcia', category: 'Security Issue', source: 'Text' },
  { id: 'TKT-1816', status: 'Resolved', statusColor: 'bg-green-500', time: '7 hours ago', caller: 'James Wilson', category: 'Account Settings', source: 'Call' },
]

function CustomerSupportDashboard() {
  const navigate = useNavigate()

  return (
    <DashboardLayout userName="Martin">
      <div>
        <h1 className="text-4xl font-bold text-white mb-8">Customer Support</h1>

        {/* Customer Insights */}
        <div className="bg-opsly-card rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold text-white mb-6">Customer Insights</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-opsly-dark rounded-lg p-6">
              <p className="text-gray-400 mb-2">Total Tickets Today</p>
              <p className="text-4xl font-bold text-white">47</p>
            </div>
            <div className="bg-opsly-dark rounded-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-400">All Resolved Tickets</p>
                <HiArrowUp className="text-green-500 text-xl" />
              </div>
              <p className="text-4xl font-bold text-white">32</p>
            </div>
            <div className="bg-opsly-dark rounded-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-400">Avg Response Time</p>
                <HiClock className="text-white text-xl" />
              </div>
              <p className="text-4xl font-bold text-white">3.2 min</p>
            </div>
          </div>
        </div>

        {/* All Support Tickets */}
        <div className="bg-opsly-card rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-white">All Support Tickets</h2>
              <p className="text-gray-400 mt-1">8 new tickets</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">Ticket ID</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">Status</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">Time</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">Caller</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">Category</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">Source</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr 
                    key={ticket.id} 
                    onClick={() => navigate(`/customer-support/ticket/${ticket.id}`)}
                    className="border-b border-gray-800 hover:bg-opsly-dark transition cursor-pointer"
                  >
                    <td className="py-4 px-4">
                      <span className="text-opsly-purple hover:underline">
                        {ticket.id}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`${ticket.statusColor} text-white px-3 py-1 rounded text-sm font-semibold`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-gray-300">{ticket.time}</td>
                    <td className="py-4 px-4 text-white">{ticket.caller}</td>
                    <td className="py-4 px-4 text-gray-300">{ticket.category}</td>
                    <td className="py-4 px-4 text-gray-300">{ticket.source}</td>
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

export default CustomerSupportDashboard

