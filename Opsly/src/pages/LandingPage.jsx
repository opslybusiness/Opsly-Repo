import { Link } from 'react-router-dom'
import { FaGoogle, FaCalendarAlt, FaEnvelope, FaVideo, FaRobot } from 'react-icons/fa'
import { HiPhone, HiThumbUp, HiChartBar, HiUser, HiChat } from 'react-icons/hi'

function LandingPage() {
  return (
    <div className="min-h-screen bg-opsly-dark relative">
      {/* Vertical Lines Background Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'repeating-linear-gradient(to right, rgba(255, 255, 255, 0.1) 0px, rgba(255, 255, 255, 0.1) 1px, transparent 1px, transparent 100px)',
          backgroundSize: '100px 100%'
        }}
      ></div>
      {/* Header */}
      <header className="flex items-center justify-between px-16 py-6 relative z-10">
        <div className="flex items-center gap-8">
          <div className="text-2xl font-bold">
            <span className="text-opsly-purple">Öps</span><span className="text-white">ly</span>
          </div>
          <nav className="flex items-center gap-8">
            <a href="#features" className="text-white hover:text-opsly-purple transition">Features</a>
            <a href="#about" className="text-white hover:text-opsly-purple transition">About Us</a>
            <Link to="/chat" className="flex items-center gap-2 text-white hover:text-opsly-purple transition">
              <HiChat className="text-lg" />
              <span>Chat Support</span>
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/signup" className="px-6 py-2 bg-gradient-to-r from-opsly-purple to-purple-600 text-white rounded-lg hover:opacity-90 transition">
            Sign Up
          </Link>
          <Link to="/login" className="px-6 py-2 border border-white text-white rounded-lg hover:bg-white hover:text-opsly-dark transition">
            Login
          </Link>
        </div>
      </header>

      {/* Main Container - starts below header, ends at bottom of feature cards */}
      <div className="relative z-10 mx-16 mb-8 mt-4 rounded-xl overflow-hidden" style={{ backgroundColor: '#1E1E1E', borderRadius: '12px' }}>
        {/* Hero Section */}
        <section className="flex flex-col items-center justify-center py-20 px-8">
          <div className="mb-8">
            <img src="/logo.png" alt="Opsly Logo" className="w-24 h-24" />
          </div>
          <h1 className="text-6xl font-bold text-center mb-4 font-inter leading-tight">
            <div className="bg-gradient-to-r from-white to-opsly-purple bg-clip-text text-transparent">smart support</div>
            <div className="bg-gradient-to-r from-opsly-purple to-white bg-clip-text text-transparent">strong decisions.</div>
          </h1>
          <p className="text-xl text-gray-300 mb-12 text-center">
            Efficiently automate your business and boost productivity.
          </p>
          <div className="flex gap-4">
            <Link 
              to="/chat" 
              className="px-8 py-4 bg-gradient-to-r from-opsly-purple to-purple-600 text-white rounded-lg text-lg font-semibold hover:opacity-90 transition flex items-center gap-2"
            >
              <FaRobot className="text-xl" />
              <span>Chat with Support</span>
            </Link>
            <button className="px-8 py-4 bg-transparent border-2 border-white text-white rounded-lg text-lg font-semibold hover:bg-white hover:text-opsly-dark transition">
              Learn More
            </button>
          </div>
        </section>

        {/* Feature Cards */}
        <section className="relative" style={{ paddingLeft: '64px', paddingRight: '64px', paddingBottom: '0', marginBottom: '-80px' }}>
          {/* Purple Gradient Background - bottom to top */}
          <div className="absolute inset-0 bg-gradient-to-t from-purple-900/60 via-purple-800/30 to-transparent pointer-events-none"></div>
          
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
          {/* Integrations Card */}
          <div className="bg-gray-100 rounded-lg p-8 shadow-lg" style={{ boxShadow: '0 4px 6px -1px rgba(94, 94, 94, 0.3), 0 2px 4px -1px rgba(94, 94, 94, 0.2)', border: '2px solid #5E5E5E' }}>
            <h3 className="text-2xl font-semibold text-gray-900 mb-6">Integrations</h3>
            <div className="flex gap-8">
              <img src="/Gmail.png" alt="Gmail" className="w-20 h-20 rounded-lg object-cover" />
              <img src="/Meet.png" alt="Meet" className="w-20 h-20 rounded-lg object-cover" />
              <img src="/Calender.png" alt="Calendar" className="w-20 h-20 rounded-lg object-cover" />
            </div>
          </div>

          {/* Customer Support Card */}
          <div className="bg-gray-100 rounded-lg p-8 shadow-lg" style={{ boxShadow: '0 4px 6px -1px rgba(94, 94, 94, 0.3), 0 2px 4px -1px rgba(94, 94, 94, 0.2)', border: '2px solid #5E5E5E' }}>
            <h3 className="text-2xl font-semibold text-gray-900 mb-6">Customer Support</h3>
            <div className="flex items-center justify-center">
              <img src="/Frame 19.png" alt="Customer Support" className="object-contain" />
            </div>
          </div>

          {/* Analytics Card */}
          <div className="bg-gray-100 rounded-lg p-8 shadow-lg" style={{ boxShadow: '0 4px 6px -1px rgba(94, 94, 94, 0.3), 0 2px 4px -1px rgba(94, 94, 94, 0.2)', border: '2px solid #5E5E5E' }}>
            <h3 className="text-2xl font-semibold text-gray-900 mb-6">Analytics</h3>
            <div className="grid grid-cols-2 grid-rows-2 gap-4" style={{ height: '240px', gridTemplateRows: '0.5fr 1fr', gridTemplateColumns: '1fr 1.2fr' }}>
              {/* Large Card - Total Tickets */}
              <div className="bg-gray-800 rounded-lg shadow-sm row-span-2 flex flex-col" style={{ padding: '16px 24px' }}>
                <p className="text-sm text-white whitespace-nowrap mb-auto">Total Tickets</p>
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-5xl font-semibold text-white">53</p>
                </div>
              </div>
              {/* Top Right Card - Videos Posted */}
              <div className="bg-blue-500 rounded-lg shadow-sm flex flex-col" style={{ padding: '16px 16px' }}>
                <p className="text-sm text-white mb-auto whitespace-nowrap">Videos Posted</p>
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-5xl font-semibold text-white">13</p>
                </div>
              </div>
              {/* Bottom Right Card - Total Transactions */}
              <div className="bg-yellow-200 rounded-lg p-4 shadow-sm flex flex-col">
                <p className="text-xs mb-auto whitespace-nowrap" style={{ color: '#8B4513' }}>Total Transactions</p>
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-5xl font-semibold" style={{ color: '#8B4513' }}>101</p>
                </div>
              </div>
            </div>
          </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default LandingPage

