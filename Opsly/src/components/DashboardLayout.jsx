import { Link, useLocation, useNavigate } from 'react-router-dom'
import { HiPhone, HiChartBar, HiFolder, HiCog, HiClock, HiChat, HiLogout } from 'react-icons/hi'
import { FaSearch, FaBell } from 'react-icons/fa'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getConnectionStatus } from '../services/marketingService'

function DashboardLayout({ children, userName }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut, isAuthenticated, userId } = useAuth()
  const [showUserMenu, setShowUserMenu] = useState(false)
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
    <div className="min-h-screen flex bg-opsly-gray">
      {/* Sidebar */}
      <div className="w-20 bg-blue-600 flex flex-col items-center py-6">
        <Link 
          to="/" 
          className="w-12 h-12 bg-opsly-purple rounded-full flex items-center justify-center text-white text-xl font-bold mb-8 hover:bg-purple-700 transition cursor-pointer"
        >
          Ö
        </Link>
        <Link to="/customer-support" className={`mb-6 p-3 rounded-lg ${isActive('/customer-support') ? 'bg-blue-700' : 'hover:bg-blue-700'}`}>
          <HiPhone className="text-2xl text-white" />
        </Link>
        <Link to="/marketing" className={`mb-6 p-3 rounded-lg ${isActive('/marketing') ? 'bg-blue-700' : 'hover:bg-blue-700'}`}>
          <HiChartBar className="text-2xl text-white" />
        </Link>
        <Link to="/finance" className={`mb-6 p-3 rounded-lg ${isActive('/finance') ? 'bg-blue-700' : 'hover:bg-blue-700'}`}>
          <HiFolder className="text-2xl text-white" />
        </Link>
        <Link to="/chatbot" className={`mb-6 p-3 rounded-lg ${isActive('/chatbot') ? 'bg-blue-700' : 'hover:bg-blue-700'}`}>
          <HiChat className="text-2xl text-white" />
        </Link>
        <div className="mt-auto">
          <button className="mb-6 p-3 rounded-lg hover:bg-blue-700">
            <HiCog className="text-2xl text-white" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-opsly-dark">
        {/* Header */}
        <header className="bg-opsly-dark px-8 py-6 flex items-center justify-between border-b border-gray-800">
          <h2 className="text-xl text-white">
            Good Morning, <span className="text-opsly-purple">{displayName}</span>
          </h2>
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate('/support-us')}
              className="px-4 py-2 rounded-full bg-opsly-purple text-white text-sm font-medium hover:bg-purple-700 transition border border-purple-500/60"
            >
              Support Us
            </button>
            <FaSearch className="text-xl text-white cursor-pointer hover:text-gray-300 transition" />
            <FaBell className="text-xl text-white cursor-pointer hover:text-gray-300 transition" />
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-10 h-10 bg-opsly-purple rounded-full flex items-center justify-center text-white font-semibold hover:bg-purple-700 transition"
              >
                {displayName.charAt(0).toUpperCase()}
              </button>
              
              {/* User Dropdown Menu */}
              {showUserMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowUserMenu(false)}
                  ></div>
                  <div className="absolute right-0 mt-2 w-48 bg-opsly-card rounded-lg shadow-lg py-2 z-20 border border-gray-700">
                    <div className="px-4 py-2 border-b border-gray-700">
                      <p className="text-white text-sm font-semibold">{displayName}</p>
                      <p className="text-gray-400 text-xs">{user?.email}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-700 flex items-center gap-2 transition"
                    >
                      <HiLogout className="text-lg" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout


