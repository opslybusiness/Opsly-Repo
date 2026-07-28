import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { FaChartLine, FaRobot, FaPuzzlePiece } from 'react-icons/fa'

function LandingPage() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="min-h-screen bg-opsly-dark text-slate-100 overflow-x-hidden font-sans selection:bg-opsly-purple/30">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-opsly-purple/20 rounded-full mix-blend-screen filter blur-[128px] opacity-50 animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-[30rem] h-[30rem] bg-indigo-900/20 rounded-full mix-blend-screen filter blur-[128px] opacity-50"></div>
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '4rem 4rem'
          }}
        ></div>
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 md:px-12 lg:px-24 py-6 border-b border-white/5 bg-opsly-dark/50 backdrop-blur-md">
        <div className="flex items-center gap-8">
          <div className="text-2xl font-bold tracking-tight">
            <span className="text-opsly-purple">Öps</span><span className="text-white">ly</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/about-us" className="text-slate-300 hover:text-white transition-colors text-sm font-medium">About Us</Link>
            <Link to="/chat" className="text-slate-300 hover:text-white transition-colors text-sm font-medium">Chat Trial</Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <Link to="/marketing" className="px-5 py-2.5 bg-opsly-purple text-white rounded-lg hover:bg-purple-500 transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)] text-sm font-semibold">
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="px-5 py-2.5 text-slate-300 hover:text-white transition-colors text-sm font-semibold">
                Log In
              </Link>
              <Link to="/signup" className="px-5 py-2.5 bg-opsly-purple text-white rounded-lg hover:bg-purple-500 transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_rgba(139,92,246,0.5)] text-sm font-semibold">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="relative z-10 px-6 md:px-12 lg:px-24 py-20 lg:py-32 flex flex-col items-center">
        {/* Hero Section */}
        <div className="max-w-4xl mx-auto text-center animate-slide-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-8">
            <span className="flex h-2 w-2 rounded-full bg-opsly-purple animate-ping"></span>
            <span className="text-xs font-medium text-slate-300">Opsly AI 2.0 is now live</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-[1.1]">
            <span className="text-white">smart support.</span>
            <br />
            <span className="bg-gradient-to-r from-opsly-purple to-indigo-400 bg-clip-text text-transparent">
              strong decisions.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Efficiently automate your business operations, streamline customer support, and unlock powerful analytics with our unified AI platform.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/signup" className="w-full sm:w-auto px-8 py-4 bg-opsly-purple text-white rounded-xl hover:bg-purple-500 transition-all shadow-[0_0_30px_rgba(139,92,246,0.4)] hover:shadow-[0_0_40px_rgba(139,92,246,0.6)] font-semibold text-lg flex items-center justify-center gap-2">
              Get Started Free
            </Link>
            <Link to="/about-us" className="w-full sm:w-auto px-8 py-4 bg-white/5 text-white rounded-xl hover:bg-white/10 border border-white/10 transition-all font-semibold text-lg flex items-center justify-center">
              Learn More
            </Link>
          </div>
        </div>

        {/* Feature Grid (Bento Box) */}
        <div className="max-w-6xl w-full mx-auto mt-32 grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          
          {/* Integrations Card */}
          <div className="col-span-1 bg-opsly-card/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 hover:bg-opsly-card/60 transition-colors group">
            <div className="h-12 w-12 bg-indigo-500/20 rounded-xl flex items-center justify-center mb-6 text-indigo-400 group-hover:scale-110 transition-transform">
              <FaPuzzlePiece className="text-2xl" />
            </div>
            <h3 className="text-2xl font-semibold mb-3 text-white">Seamless Integrations</h3>
            <p className="text-slate-400 mb-8 leading-relaxed">
              Connect your favorite tools instantly. Gmail, Meet, Calendar, and more work perfectly together.
            </p>
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center p-2"><img src="/Gmail.png" alt="Gmail" className="w-full h-full object-contain" /></div>
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center p-2"><img src="/Meet.png" alt="Meet" className="w-full h-full object-contain" /></div>
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center p-2"><img src="/Calender.png" alt="Calendar" className="w-full h-full object-contain" /></div>
            </div>
          </div>

          {/* Support Card */}
          <div className="col-span-1 lg:col-span-2 bg-opsly-card/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 hover:bg-opsly-card/60 transition-colors group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-opsly-purple/10 rounded-full blur-3xl group-hover:bg-opsly-purple/20 transition-colors"></div>
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <div className="h-12 w-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-6 text-purple-400 group-hover:scale-110 transition-transform">
                  <FaRobot className="text-2xl" />
                </div>
                <h3 className="text-2xl font-semibold mb-3 text-white">AI Customer Support</h3>
                <p className="text-slate-400 max-w-md leading-relaxed">
                  Resolve tickets automatically with advanced RAG models. Provide instant, accurate answers 24/7 without breaking a sweat.
                </p>
              </div>
              <div className="mt-8">
                 <Link to="/chat" className="text-opsly-purple hover:text-purple-400 font-medium inline-flex items-center gap-2">
                   Try the interactive demo &rarr;
                 </Link>
              </div>
            </div>
          </div>

          {/* Analytics Card - Spans full width on bottom */}
          <div className="col-span-1 lg:col-span-3 bg-opsly-card/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 hover:bg-opsly-card/60 transition-colors group">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
              <div className="max-w-xl">
                <div className="h-12 w-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-6 text-emerald-400 group-hover:scale-110 transition-transform">
                  <FaChartLine className="text-2xl" />
                </div>
                <h3 className="text-2xl font-semibold mb-3 text-white">Powerful Analytics</h3>
                <p className="text-slate-400 leading-relaxed">
                  Track performance across all channels. Get real-time insights on tickets, posts, and transactions to drive growth.
                </p>
              </div>
              
              <div className="flex flex-wrap md:flex-nowrap gap-4 w-full lg:w-auto">
                <div className="bg-white/5 border border-white/5 rounded-2xl p-6 flex-1 min-w-[140px]">
                  <p className="text-slate-400 text-sm mb-2">Total Tickets</p>
                  <p className="text-4xl font-bold text-white">53</p>
                </div>
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-6 flex-1 min-w-[140px]">
                  <p className="text-indigo-300 text-sm mb-2">Videos Posted</p>
                  <p className="text-4xl font-bold text-indigo-400">13</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 flex-1 min-w-[140px]">
                  <p className="text-amber-300 text-sm mb-2">Transactions</p>
                  <p className="text-4xl font-bold text-amber-400">101</p>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </main>
    </div>
  )
}

export default LandingPage

