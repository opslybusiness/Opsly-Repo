import { Link } from 'react-router-dom'
import { FaGoogle, FaCalendarAlt, FaEnvelope, FaVideo, FaRobot } from 'react-icons/fa'
import { HiPhone, HiThumbUp, HiChartBar, HiUser } from 'react-icons/hi'

function LandingPage() {
  return (
    <div className="min-h-screen bg-opsly-dark relative overflow-x-hidden w-full max-w-full">
      {/* Vertical Lines Background Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'repeating-linear-gradient(to right, rgba(255, 255, 255, 0.1) 0px, rgba(255, 255, 255, 0.1) 1px, transparent 1px, transparent 100px)',
          backgroundSize: '100px 100%'
        }}
      ></div>
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-8 md:px-16 py-4 sm:py-6 relative z-10 flex-wrap gap-4">
        <div className="flex items-center gap-4 sm:gap-8 flex-shrink-0">
          <div className="text-xl sm:text-2xl font-bold">
            <span className="text-opsly-purple">Öps</span><span className="text-white">ly</span>
          </div>
          <nav className="hidden md:flex items-center gap-4 lg:gap-8">
            <Link to="/about-us" className="text-white hover:text-opsly-purple transition text-sm lg:text-base">About Us</Link>
            <Link to="/chat" className="text-white hover:text-opsly-purple transition text-sm lg:text-base">
              Chat Support Trial
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          <Link to="/chat" className="md:hidden text-white hover:text-opsly-purple transition text-sm p-2">
            Chat Support Trial
          </Link>
          <Link to="/signup" className="px-3 sm:px-6 py-2 bg-gradient-to-r from-opsly-purple to-purple-600 text-white rounded-lg hover:opacity-90 transition text-sm sm:text-base whitespace-nowrap">
            Sign Up
          </Link>
          <Link to="/login" className="px-3 sm:px-6 py-2 border border-white text-white rounded-lg hover:bg-white hover:text-opsly-dark transition text-sm sm:text-base whitespace-nowrap">
            Login
          </Link>
        </div>
      </header>

      {/* Main Container - starts below header, ends at bottom of feature cards */}
      <div className="relative z-10 mx-4 sm:mx-8 md:mx-16 mb-8 mt-4 rounded-xl overflow-visible" style={{ backgroundColor: '#1E1E1E', borderRadius: '12px' }}>
        {/* Hero Section */}
        <section className="flex flex-col items-center justify-center py-12 sm:py-16 md:py-20 px-4 sm:px-8">
          <div className="mb-6 sm:mb-8">
            <img src="/logo.png" alt="Opsly Logo" className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 object-contain" />
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-center mb-4 font-inter leading-tight px-2">
            <div className="bg-gradient-to-r from-white to-opsly-purple bg-clip-text text-transparent">smart support</div>
            <div className="bg-gradient-to-r from-opsly-purple to-white bg-clip-text text-transparent pb-1">strong decisions.</div>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-300 mb-8 sm:mb-10 md:mb-12 text-center px-4 max-w-2xl">
            Efficiently automate your business and boost productivity.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto px-4 sm:px-0">
            <Link 
              to="/chat" 
              className="px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-opsly-purple to-purple-600 text-white rounded-lg text-base sm:text-lg font-semibold hover:opacity-90 transition flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <FaRobot className="text-lg sm:text-xl flex-shrink-0" />
              <span>Chat with Support</span>
            </Link>
            <Link 
              to="/about-us"
              className="px-6 sm:px-8 py-3 sm:py-4 bg-transparent border-2 border-white text-white rounded-lg text-base sm:text-lg font-semibold hover:bg-white hover:text-opsly-dark transition whitespace-nowrap text-center"
            >
              Learn More
            </Link>
          </div>
        </section>

        {/* Feature Cards */}
        <section className="relative px-4 sm:px-8 md:px-16 pb-8 md:pb-12 mb-0">
          {/* Purple Gradient Background - bottom to top */}
          <div className="absolute inset-0 bg-gradient-to-t from-purple-900/60 via-purple-800/30 to-transparent pointer-events-none rounded-b-xl"></div>
          
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 relative z-10 pb-4">
          {/* Integrations Card */}
          <div className="bg-gray-100 rounded-lg p-6 sm:p-8 shadow-lg flex flex-col" style={{ boxShadow: '0 4px 6px -1px rgba(94, 94, 94, 0.3), 0 2px 4px -1px rgba(94, 94, 94, 0.2)', border: '2px solid #5E5E5E' }}>
            <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-4 sm:mb-6 text-center">Integrations</h3>
            <div className="flex gap-4 sm:gap-5 justify-center items-center flex-1">
              <img src="/Gmail.png" alt="Gmail" className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-cover flex-shrink-0" />
              <img src="/Meet.png" alt="Meet" className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-cover flex-shrink-0" />
              <img src="/Calender.png" alt="Calendar" className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-cover flex-shrink-0" />
            </div>
          </div>

          {/* Customer Support Card */}
          <div className="bg-gray-100 rounded-lg p-6 sm:p-8 shadow-lg" style={{ boxShadow: '0 4px 6px -1px rgba(94, 94, 94, 0.3), 0 2px 4px -1px rgba(94, 94, 94, 0.2)', border: '2px solid #5E5E5E' }}>
            <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-4 sm:mb-6">Customer Support</h3>
            <div className="flex items-center justify-center">
              <img src="/Frame 19.png" alt="Customer Support" className="object-contain w-full h-auto max-w-xs" />
            </div>
          </div>

          {/* Analytics Card */}
          <div className="bg-gray-100 rounded-lg p-6 sm:p-8 shadow-lg md:col-span-2 lg:col-span-1" style={{ boxShadow: '0 4px 6px -1px rgba(94, 94, 94, 0.3), 0 2px 4px -1px rgba(94, 94, 94, 0.2)', border: '2px solid #5E5E5E' }}>
            <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-4 sm:mb-6">Analytics</h3>
            <div className="grid grid-cols-2 grid-rows-2 gap-3 sm:gap-4" style={{ height: '200px', gridTemplateRows: '0.5fr 1fr', gridTemplateColumns: '1fr 1.2fr' }}>
              {/* Large Card - Total Tickets */}
              <div className="bg-gray-800 rounded-lg shadow-sm row-span-2 flex flex-col" style={{ padding: '12px 16px' }}>
                <p className="text-xs sm:text-sm text-white whitespace-nowrap mb-auto">Total Tickets</p>
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-3xl sm:text-4xl md:text-5xl font-semibold text-white">53</p>
                </div>
              </div>
              {/* Top Right Card - Videos Posted */}
              <div className="bg-blue-500 rounded-lg shadow-sm flex flex-col" style={{ padding: '12px 16px' }}>
                <p className="text-xs sm:text-sm text-white mb-auto whitespace-nowrap">Videos Posted</p>
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-3xl sm:text-4xl md:text-5xl font-semibold text-white">13</p>
                </div>
              </div>
              {/* Bottom Right Card - Total Transactions */}
              <div className="bg-yellow-200 rounded-lg p-3 sm:p-4 shadow-sm flex flex-col">
                <p className="text-xs mb-auto whitespace-nowrap" style={{ color: '#8B4513' }}>Total Transactions</p>
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-3xl sm:text-4xl md:text-5xl font-semibold" style={{ color: '#8B4513' }}>101</p>
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

