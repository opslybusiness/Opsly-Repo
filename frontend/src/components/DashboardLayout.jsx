import { Link, useLocation, useNavigate } from 'react-router-dom'
import { HiPhone, HiChartBar, HiCog, HiClock, HiChat, HiLogout, HiMenu, HiX } from 'react-icons/hi'
import { FaSearch, FaBell, FaCoins } from 'react-icons/fa'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getConnectionStatus } from '../services/marketingService'

function DashboardLayout({ children, userName }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut, isAuthenticated, userId } = useAuth()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [userNameFromBackend, setUserNameFromBackend] = useState(null)

  // Fetch user name from backend
  useEffect(() => {
    const fetchUserName = async () => {
      if (isAuthenticated && userId) {
        try {
          const status = await getConnectionStatus()
          if (status.name) {
            setUserNameFromBackend(status.name)
          }
        } catch (error) {
          console.error('Failed to fetch user name:', error)
        }
      }
    }

    fetchUserName()
  }, [isAuthenticated, userId])

  // Get user name from backend first, then prop, then auth, then fallback
  const displayName = userNameFromBackend || userName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'

  const isActive = (path) => {
    return location.pathname.startsWith(path)
  }

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <div className="h-screen flex bg-opsly-gray overflow-hidden w-full">
      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <>
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" 
            onClick={() => setShowMobileMenu(false)}
          ></div>
          <div className="fixed left-0 top-0 h-screen w-64 flex flex-col items-start py-4 px-4 bg-opsly-card z-50 lg:hidden transform transition-transform">
            <div className="w-full flex items-center justify-between mb-6">
              <Link 
                to="/" 
                className="w-10 h-10 flex items-center justify-center hover:opacity-80 transition cursor-pointer"
                onClick={() => setShowMobileMenu(false)}
              >
                <img src="/logo.png" alt="Opsly Logo" className="w-10 h-10 object-contain" />
              </Link>
              <button 
                onClick={() => setShowMobileMenu(false)}
                className="text-white p-2 hover:bg-gray-700 rounded-lg"
              >
                <HiX className="text-xl" />
              </button>
            </div>
            <Link 
              to="/customer-support" 
              className={`w-full mb-2 p-3 rounded-lg flex items-center gap-3 ${isActive('/customer-support') ? 'bg-gray-700' : 'hover:bg-gray-700'}`}
              onClick={() => setShowMobileMenu(false)}
            >
              <HiPhone className="text-xl text-white" />
              <span className="text-white">Customer Support</span>
            </Link>
            <Link 
              to="/marketing" 
              className={`w-full mb-2 p-3 rounded-lg flex items-center gap-3 ${isActive('/marketing') ? 'bg-gray-700' : 'hover:bg-gray-700'}`}
              onClick={() => setShowMobileMenu(false)}
            >
              <HiChartBar className="text-xl text-white" />
              <span className="text-white">Marketing</span>
            </Link>
            <Link 
              to="/finance" 
              className={`w-full mb-2 p-3 rounded-lg flex items-center gap-3 ${isActive('/finance') ? 'bg-gray-700' : 'hover:bg-gray-700'}`}
              onClick={() => setShowMobileMenu(false)}
            >
              <FaCoins className="text-xl text-white" />
              <span className="text-white">Finance</span>
            </Link>
            <Link 
              to="/chatbot" 
              className={`w-full mb-2 p-3 rounded-lg flex items-center gap-3 ${isActive('/chatbot') ? 'bg-gray-700' : 'hover:bg-gray-700'}`}
              onClick={() => setShowMobileMenu(false)}
            >
              <HiChat className="text-xl text-white" />
              <span className="text-white">Chatbot</span>
            </Link>
            <div className="mt-auto w-full">
              <button className="w-full mb-4 p-3 rounded-lg hover:bg-gray-700 flex items-center gap-3">
                <HiCog className="text-xl text-white" />
                <span className="text-white">Settings</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex fixed left-0 top-0 h-screen w-14 flex-col items-center py-4" style={{ backgroundColor: '#1E1E1E' }}>
        <Link 
          to="/" 
          className="w-10 h-10 flex items-center justify-center mb-6 hover:opacity-80 transition cursor-pointer flex-shrink-0"
        >
          <img src="/logo.png" alt="Opsly Logo" className="w-10 h-10 object-contain" />
        </Link>
        <Link to="/customer-support" className={`mb-4 p-2 rounded-lg flex-shrink-0 ${isActive('/customer-support') ? 'bg-gray-700' : 'hover:bg-gray-700'}`}>
          <HiPhone className="text-xl text-white" />
        </Link>
        <Link to="/marketing" className={`mb-4 p-2 rounded-lg flex-shrink-0 ${isActive('/marketing') ? 'bg-gray-700' : 'hover:bg-gray-700'}`}>
          <HiChartBar className="text-xl text-white" />
        </Link>
        <Link to="/finance" className={`mb-4 p-2 rounded-lg flex-shrink-0 ${isActive('/finance') ? 'bg-gray-700' : 'hover:bg-gray-700'}`}>
          <FaCoins className="text-xl text-white" />
        </Link>
        <Link to="/chatbot" className={`mb-4 p-2 rounded-lg flex-shrink-0 ${isActive('/chatbot') ? 'bg-gray-700' : 'hover:bg-gray-700'}`}>
          <HiChat className="text-xl text-white" />
        </Link>
        <div className="mt-auto">
          <button className="mb-4 p-2 rounded-lg hover:bg-gray-700 flex-shrink-0">
            <HiCog className="text-xl text-white" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-opsly-dark lg:ml-14 w-full min-w-0 overflow-hidden h-screen">
        {/* Header */}
        <header className="bg-opsly-dark px-3 sm:px-5 py-3 sm:py-4 flex items-center justify-between border-b border-gray-800 min-w-0 overflow-visible max-w-full relative z-20">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              onClick={() => setShowMobileMenu(true)}
              className="lg:hidden text-white p-2 hover:bg-gray-700 rounded-lg flex-shrink-0"
            >
              <HiMenu className="text-xl" />
            </button>
            <h2 className="text-sm sm:text-base lg:text-lg text-white truncate min-w-0">
              <span className="hidden sm:inline">Good Morning, </span>
              <span className="sm:hidden">Hi, </span>
              <span className="text-opsly-purple truncate">{displayName}</span>
            </h2>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4 flex-shrink-0 ml-2">
            <button
              onClick={() => navigate('/support-us')}
              className="px-2 sm:px-3 py-1.5 rounded-full bg-opsly-purple text-white text-xs font-medium hover:bg-purple-700 transition border border-purple-500/60 whitespace-nowrap flex-shrink-0"
            >
              <span className="hidden sm:inline">Support Us</span>
              <span className="sm:hidden">Support</span>
            </button>
            <FaSearch className="text-base sm:text-lg text-white cursor-pointer hover:text-gray-300 transition flex-shrink-0" />
            <FaBell className="text-base sm:text-lg text-white cursor-pointer hover:text-gray-300 transition flex-shrink-0" />
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-7 h-7 sm:w-8 sm:h-8 bg-opsly-purple rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-semibold hover:bg-purple-700 transition flex-shrink-0"
              >
                {displayName.charAt(0).toUpperCase()}
              </button>
              
              {/* User Dropdown Menu */}
              {showUserMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-30" 
                    onClick={() => setShowUserMenu(false)}
                  ></div>
                  <div className="absolute right-0 mt-2 w-36 bg-opsly-card rounded-lg shadow-lg py-1.5 z-40 border border-gray-700 overflow-visible">
                    <div className="px-3 py-1.5 border-b border-gray-700">
                      <p className="text-white text-xs font-semibold truncate">{displayName}</p>
                      <p className="text-gray-400 text-xs truncate">{user?.email}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full px-3 py-1.5 text-left text-red-400 hover:bg-gray-700 flex items-center gap-2 transition text-xs"
                    >
                      <HiLogout className="text-base flex-shrink-0" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-3 sm:p-5 overflow-y-auto overflow-x-hidden min-w-0">
          <div className="min-w-0 max-w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout


