import DashboardLayout from '../components/DashboardLayout'
import { Link, useParams } from 'react-router-dom'
import { HiPaperAirplane } from 'react-icons/hi'

const messages = [
  {
    type: 'customer',
    text: "Hi, I'm having trouble with my payment. My credit card was charged twice.",
    time: '10:31 AM'
  },
  {
    type: 'ai',
    text: "Hello! I'm sorry to hear you're experiencing payment issues. I'm here to help. Let me look into your recent transactions.",
    time: '10:32 AM'
  },
  {
    type: 'ai',
    text: "I see two charges on your account. The first charge was the actual payment, and the second appears to be a pending authorization that will be automatically released within 3-5 business days.",
    time: '10:35 AM'
  },
  {
    type: 'customer',
    text: "So I won't actually be charged twice?",
    time: '10:36 AM'
  },
  {
    type: 'ai',
    text: "That's correct! You will only be charged once. The pending authorization is a common practice by banks and will disappear automatically. If it doesn't clear within 5 business days, please reach out to us again.",
    time: '10:37 AM'
  },
]

function TicketDetail() {
  const { id } = useParams()

  return (
    <DashboardLayout userName="Martin">
      <div>
        <Link to="/customer-support" className="text-opsly-purple mb-4 inline-block">← Back</Link>
        <h1 className="text-4xl font-bold text-white mb-8">Ticket Details</h1>

        {/* Ticket Summary */}
        <div className="bg-opsly-card rounded-lg p-6 mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-semibold text-white">{id}</h2>
                <span className="bg-red-500 text-white px-3 py-1 rounded text-sm font-semibold">Urgent</span>
                <span className="bg-opsly-purple text-white px-3 py-1 rounded text-sm font-semibold">Call</span>
              </div>
              <div className="space-y-2 text-gray-300">
                <p><span className="text-gray-400">Customer:</span> John Martinez</p>
                <p><span className="text-gray-400">Category:</span> Payment issue</p>
                <p><span className="text-gray-400">Created:</span> 2 min ago</p>
              </div>
            </div>
          </div>
        </div>

        {/* AI Support Conversation */}
        <div className="bg-opsly-card rounded-lg p-6">
          <h2 className="text-2xl font-semibold text-white mb-6">AI Support Conversation</h2>
          
          <div className="space-y-4 mb-6">
            {messages.map((message, idx) => (
              <div
                key={idx}
                className={`flex ${message.type === 'customer' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-md rounded-lg p-4 ${
                    message.type === 'customer'
                      ? 'bg-opsly-purple text-white'
                      : 'bg-opsly-dark text-gray-200'
                  }`}
                >
                  <p className="mb-2">{message.text}</p>
                  <p className={`text-xs ${message.type === 'customer' ? 'text-purple-200' : 'text-gray-400'}`}>
                    {message.time}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Message Input */}
          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder="Type a message to the customer..."
              className="flex-1 px-4 py-3 bg-opsly-dark text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-opsly-purple"
            />
            <button className="p-3 bg-opsly-purple text-white rounded-lg hover:bg-opacity-90 transition">
              <HiPaperAirplane className="text-xl" />
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default TicketDetail

