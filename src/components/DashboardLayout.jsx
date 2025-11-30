import { Link, useLocation } from 'react-router-dom'
import { HiPhone, HiChartBar, HiFolder, HiCog, HiClock, HiChat } from 'react-icons/hi'
import { FaSearch, FaBell } from 'react-icons/fa'

function DashboardLayout({ children, userName = "User" }) {
  const location = useLocation()

  const isActive = (path) => {
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen flex bg-opsly-gray">
      {/* Sidebar */}
      <div className="w-20 bg-blue-600 flex flex-col items-center py-6">
        <div className="w-12 h-12 bg-opsly-purple rounded-full flex items-center justify-center text-white text-xl font-bold mb-8">
          Ö
        </div>
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
            Good Morning, <span className="text-opsly-purple">{userName}</span>
          </h2>
          <div className="flex items-center gap-6">
            <FaSearch className="text-xl text-white cursor-pointer" />
            <FaBell className="text-xl text-white cursor-pointer" />
            <div className="w-10 h-10 bg-opsly-purple rounded-full flex items-center justify-center text-white font-semibold">
              {userName.charAt(0)}
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

