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
      <div className="fixed left-0 top-0 h-screen w-14 flex flex-col items-center py-4" style={{ backgroundColor: '#1E1E1E' }}>
        <Link 
          to="/" 
          className="w-10 h-10 flex items-center justify-center mb-6 hover:opacity-80 transition cursor-pointer"
        >
          <img src="/logo.png" alt="Opsly Logo" className="w-10 h-10 object-contain" />
        </Link>
        <Link to="/customer-support" className={`mb-4 p-2 rounded-lg ${isActive('/customer-support') ? 'bg-gray-700' : 'hover:bg-gray-700'}`}>
          <HiPhone className="text-xl text-white" />
        </Link>
        <Link to="/marketing" className={`mb-4 p-2 rounded-lg ${isActive('/marketing') ? 'bg-gray-700' : 'hover:bg-gray-700'}`}>
          <HiChartBar className="text-xl text-white" />
        </Link>
        <Link to="/finance" className={`mb-4 p-2 rounded-lg ${isActive('/finance') ? 'bg-gray-700' : 'hover:bg-gray-700'}`}>
          <HiFolder className="text-xl text-white" />
        </Link>
        <Link to="/chatbot" className={`mb-4 p-2 rounded-lg ${isActive('/chatbot') ? 'bg-gray-700' : 'hover:bg-gray-700'}`}>
          <HiChat className="text-xl text-white" />
        </Link>
        <div className="mt-auto">
          <button className="mb-4 p-2 rounded-lg hover:bg-gray-700">
            <HiCog className="text-xl text-white" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-opsly-dark ml-14">
        {/* Header */}
        <header className="bg-opsly-dark px-5 py-4 flex items-center justify-between border-b border-gray-800">
          <h2 className="text-lg text-white">
            Good Morning, <span className="text-opsly-purple">{displayName}</span>
          </h2>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/support-us')}
              className="px-3 py-1.5 rounded-full bg-opsly-purple text-white text-xs font-medium hover:bg-purple-700 transition border border-purple-500/60"
            >
              Support Us
            </button>
            <FaSearch className="text-lg text-white cursor-pointer hover:text-gray-300 transition" />
            <FaBell className="text-lg text-white cursor-pointer hover:text-gray-300 transition" />
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-8 h-8 bg-opsly-purple rounded-full flex items-center justify-center text-white text-sm font-semibold hover:bg-purple-700 transition"
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
                  <div className="absolute right-0 mt-2 w-36 bg-opsly-card rounded-lg shadow-lg py-1.5 z-20 border border-gray-700">
                    <div className="px-3 py-1.5 border-b border-gray-700">
                      <p className="text-white text-xs font-semibold">{displayName}</p>
                      <p className="text-gray-400 text-xs">{user?.email}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full px-3 py-1.5 text-left text-red-400 hover:bg-gray-700 flex items-center gap-2 transition text-xs"
                    >
                      <HiLogout className="text-base" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-5 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout


