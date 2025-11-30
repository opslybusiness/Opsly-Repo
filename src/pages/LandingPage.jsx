import { Link } from 'react-router-dom'
import { FaGoogle, FaCalendarAlt, FaEnvelope, FaVideo } from 'react-icons/fa'
import { HiPhone, HiThumbUp, HiChartBar, HiUser } from 'react-icons/hi'

function LandingPage() {
  return (
    <div className="min-h-screen bg-opsly-dark">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-8">
          <div className="text-2xl font-bold text-white">
            <span className="text-opsly-purple">Ö</span>psly
          </div>
          <nav className="flex items-center gap-8">
            <a href="#features" className="text-white hover:text-opsly-purple transition">Features</a>
            <a href="#about" className="text-white hover:text-opsly-purple transition">About Us</a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/login" className="px-6 py-2 bg-gradient-to-r from-opsly-purple to-purple-600 text-white rounded-lg hover:opacity-90 transition">
            Sign Up
          </Link>
          <Link to="/login" className="px-6 py-2 border border-white text-white rounded-lg hover:bg-white hover:text-opsly-dark transition">
            Login
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center py-20 px-8">
        <div className="w-24 h-24 mb-8 flex items-center justify-center text-6xl font-bold text-opsly-purple bg-opsly-card rounded-full">
          Ö
        </div>
        <h1 className="text-6xl font-bold text-center mb-4">
          <span className="text-white">smart support</span>{' '}
          <span className="text-opsly-purple">strong decisions.</span>
        </h1>
        <p className="text-xl text-gray-300 mb-12 text-center">
          Efficiently automate your business and boost productivity.
        </p>
        <button className="px-8 py-4 bg-gradient-to-r from-opsly-purple to-purple-600 text-white rounded-lg text-lg font-semibold hover:opacity-90 transition">
          Learn More
        </button>
      </section>

      {/* Feature Cards */}
      <section className="px-8 pb-20 relative">
        {/* Purple Gradient Background - bottom to top */}
        <div className="absolute inset-0 bg-gradient-to-t from-purple-900/60 via-purple-800/30 to-transparent pointer-events-none"></div>
        
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
          {/* Integrations Card */}
          <div className="bg-gray-100 rounded-lg p-8 shadow-lg" style={{ boxShadow: '0 0 20px rgba(147, 51, 234, 0.3)' }}>
            <h3 className="text-2xl font-semibold text-gray-900 mb-6">Integrations</h3>
            <div className="flex gap-4">
              <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center shadow-md">
                <FaVideo className="text-green-500 text-xl" />
              </div>
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold shadow-md">
                31
              </div>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold shadow-md" style={{ background: 'linear-gradient(to bottom right, #ea4335 0%, #ea4335 50%, #fbbc04 50%, #fbbc04 100%)' }}>
                <span className="text-white font-bold">M</span>
              </div>
            </div>
          </div>

          {/* Customer Support Card */}
          <div className="bg-gray-100 rounded-lg p-8 shadow-lg" style={{ boxShadow: '0 0 20px rgba(147, 51, 234, 0.3)' }}>
            <h3 className="text-2xl font-semibold text-gray-900 mb-6">Customer Support</h3>
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-opsly-purple flex items-center justify-center bg-white">
                  <HiUser className="text-opsly-purple text-2xl" />
                </div>
                <div className="absolute -top-1 -right-1 w-8 h-5 bg-opsly-purple rounded flex items-center justify-center text-white text-xs font-bold">
                  AI
                </div>
              </div>
              <div className="flex gap-4 bg-orange-50 rounded-lg p-3">
                <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center">
                  <HiPhone className="text-white text-xl" />
                </div>
                <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center">
                  <HiThumbUp className="text-white text-xl" />
                </div>
                <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center">
                  <HiChartBar className="text-white text-xl" />
                </div>
              </div>
            </div>
          </div>

          {/* Analytics Card */}
          <div className="bg-gray-100 rounded-lg p-8 shadow-lg" style={{ boxShadow: '0 0 20px rgba(147, 51, 234, 0.3)' }}>
            <h3 className="text-2xl font-semibold text-gray-900 mb-6">Analytics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800 rounded p-4 shadow-sm">
                <p className="text-sm text-white mb-2">Total Teams</p>
                <p className="text-3xl font-bold text-white">53</p>
              </div>
              <div className="bg-blue-500 rounded p-4 shadow-sm">
                <p className="text-sm text-white mb-2">Unique Users</p>
                <p className="text-3xl font-bold text-white">13</p>
              </div>
              <div className="bg-yellow-200 rounded p-4 col-span-2 shadow-sm">
                <p className="text-sm text-gray-800 mb-2">Total Transactions</p>
                <p className="text-3xl font-bold text-gray-800">101</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default LandingPage

