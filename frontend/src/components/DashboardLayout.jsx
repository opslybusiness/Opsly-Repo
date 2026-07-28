import { Link, useLocation, useNavigate } from 'react-router-dom'
import { HiPhone, HiPlay, HiCog, HiClock, HiChat, HiLogout, HiMenu, HiX, HiPaperClip, HiMicrophone, HiCalendar, HiExclamation } from 'react-icons/hi'
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

  const displayName = userNameFromBackend || userName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'

  const isActive = (path) => location.pathname.startsWith(path)

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      console.error('Logout error:', error)
      navigate('/login')
    }
  }

  const NavItem = ({ to, icon: Icon, label, alert }) => (
    <Link
      to={to}
      title={label}
      className={`group relative flex items-center justify-center lg:mb-4 p-3 rounded-xl transition-all duration-300 ${
        isActive(to)
          ? 'bg-opsly-purple/20 text-opsly-purple shadow-[inset_0_0_12px_rgba(139,92,246,0.3)]'
          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
      }`}
      onClick={() => setShowMobileMenu(false)}
    >
      <Icon className={`text-xl ${alert ? 'text-red-400' : ''}`} />
      <span className="lg:hidden ml-3 font-medium flex-1">{label}</span>
      {/* Tooltip for Desktop */}
      <div className="hidden lg:block absolute left-14 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
        {label}
      </div>
    </Link>
  )

  return (
    <div className="h-screen flex bg-opsly-dark text-slate-100 font-sans overflow-hidden w-full selection:bg-opsly-purple/30">
      
      {/* Dynamic Background for App */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40">
        <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-opsly-purple/10 rounded-full mix-blend-screen filter blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[30rem] h-[30rem] bg-indigo-900/10 rounded-full mix-blend-screen filter blur-[100px]"></div>
      </div>

      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity" 
            onClick={() => setShowMobileMenu(false)}
          ></div>
          <div className="fixed left-0 top-0 h-screen w-72 flex flex-col items-start py-6 px-4 bg-opsly-card/95 backdrop-blur-xl border-r border-white/5 z-50 lg:hidden animate-fade-in shadow-2xl">
            <div className="w-full flex items-center justify-between mb-8 px-2">
              <Link to="/" className="flex items-center gap-2" onClick={() => setShowMobileMenu(false)}>
                <img src="/logo.png" alt="Opsly Logo" className="w-8 h-8 object-contain" />
                <span className="text-xl font-bold tracking-tight"><span className="text-opsly-purple">Öps</span>ly</span>
              </Link>
              <button onClick={() => setShowMobileMenu(false)} className="text-slate-400 p-2 hover:text-white rounded-lg transition-colors">
                <HiX className="text-2xl" />
              </button>
            </div>
            <div className="flex-1 w-full overflow-y-auto hide-scrollbar space-y-2">
              <NavItem to="/documents" icon={HiPaperClip} label="AI Documents" />
              <NavItem to="/customer-support" icon={HiPhone} label="Customer Support" />
              <NavItem to="/marketing" icon={HiPlay} label="Social Automation" />
              <NavItem to="/campaign-ops" icon={HiClock} label="Campaign Ops" />
              <NavItem to="/finance" icon={FaCoins} label="Finance" />
              <NavItem to="/meetings" icon={HiCalendar} label="Meetings" />
              <NavItem to="/chatbot" icon={HiChat} label="Chatbot" />
              <NavItem to="/voice-bot" icon={HiMicrophone} label="Voice Bot" />
              <NavItem to="/escalated-calls" icon={HiExclamation} label="Escalated Calls" alert />
            </div>
          </div>
        </>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex fixed left-0 top-0 h-screen w-[72px] flex-col items-center py-6 bg-opsly-card/50 backdrop-blur-md border-r border-white/5 z-30 shadow-[4px_0_24px_rgba(0,0,0,0.2)]">
        <Link to="/" className="w-10 h-10 flex items-center justify-center mb-8 hover:scale-105 transition-transform flex-shrink-0">
          <img src="/logo.png" alt="Opsly Logo" className="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]" />
        </Link>
        <div className="flex-1 w-full flex flex-col items-center hide-scrollbar overflow-y-auto">
          <NavItem to="/documents" icon={HiPaperClip} label="AI Documents" />
          <NavItem to="/customer-support" icon={HiPhone} label="Customer Support" />
          <NavItem to="/marketing" icon={HiPlay} label="Social Automation" />
          <NavItem to="/campaign-ops" icon={HiClock} label="Campaign Ops" />
          <NavItem to="/finance" icon={FaCoins} label="Finance" />
          <NavItem to="/chatbot" icon={HiChat} label="Chatbot" />
          <NavItem to="/voice-bot" icon={HiMicrophone} label="Voice Bot" />
          <NavItem to="/meetings" icon={HiCalendar} label="Meetings" />
          <NavItem to="/escalated-calls" icon={HiExclamation} label="Escalated Calls" alert />
        </div>
        <div className="mt-4">
          <button className="p-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors">
            <HiCog className="text-xl" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:ml-[72px] w-full min-w-0 h-screen relative z-10">
        
        {/* Top Header */}
        <header className="px-6 py-4 flex items-center justify-between border-b border-white/5 bg-opsly-dark/40 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button onClick={() => setShowMobileMenu(true)} className="lg:hidden text-slate-300 p-2 hover:bg-white/10 rounded-lg transition-colors">
              <HiMenu className="text-2xl" />
            </button>
            <div className="flex flex-col">
              <span className="text-xs text-slate-400 font-medium tracking-wide uppercase">Welcome back</span>
              <h2 className="text-lg font-bold text-white truncate">
                {displayName}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <button onClick={() => navigate('/support-us')} className="hidden sm:flex px-4 py-2 rounded-lg bg-opsly-purple/10 text-opsly-purple text-sm font-semibold hover:bg-opsly-purple hover:text-white transition-all border border-opsly-purple/20">
              Support Us
            </button>
            <button className="text-slate-400 hover:text-white transition-colors">
              <FaSearch className="text-lg" />
            </button>
            <button className="text-slate-400 hover:text-white transition-colors relative">
              <FaBell className="text-lg" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-opsly-purple rounded-full"></span>
            </button>
            
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-10 h-10 bg-gradient-to-br from-opsly-purple to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold hover:shadow-[0_0_15px_rgba(139,92,246,0.5)] transition-all ring-2 ring-white/10 overflow-hidden"
              >
                {displayName.charAt(0).toUpperCase()}
              </button>
              
              {/* User Dropdown Menu */}
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowUserMenu(false)}></div>
                  <div className="absolute right-0 mt-3 w-48 bg-opsly-card/95 backdrop-blur-xl rounded-xl shadow-2xl py-2 z-40 border border-white/10 animate-fade-in">
                    <div className="px-4 py-3 border-b border-white/5 mb-1">
                      <p className="text-white text-sm font-semibold truncate">{displayName}</p>
                      <p className="text-slate-400 text-xs truncate mt-0.5">{user?.email}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2.5 text-left text-red-400 hover:bg-white/5 flex items-center gap-3 transition-colors text-sm font-medium"
                    >
                      <HiLogout className="text-lg" />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto hide-scrollbar">
          <div className="max-w-[1600px] mx-auto animate-slide-up">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout


