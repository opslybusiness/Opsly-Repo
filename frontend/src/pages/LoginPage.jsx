import { Link, useNavigate, Navigate } from 'react-router-dom'
import { FaGoogle } from 'react-icons/fa'
import { HiEye, HiEyeOff } from 'react-icons/hi'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { signIn, isAuthenticated, loading: authLoading } = useAuth()

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-opsly-dark">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  // Only redirect if authenticated AFTER loading is complete
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/marketing', { replace: true })
    }
  }, [authLoading, isAuthenticated, navigate])

  if (!authLoading && isAuthenticated) {
    return <Navigate to="/marketing" replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!email || !password) {
      setError('Please fill in all fields')
      setLoading(false)
      return
    }

    try {
      const { error: signInError, data } = await signIn(email, password)
      
      if (signInError) {
        setError(signInError.message || 'Failed to sign in. Please check your credentials.')
        setLoading(false)
      } else if (data?.session) {
        // Only redirect after successful login
        navigate('/marketing', { replace: true })
      } else {
        setError('Login failed. Please try again.')
        setLoading(false)
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      console.error('Login error:', err)
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    if (!email) {
      setError('Please enter your email address first')
      return
    }
    // TODO: Implement forgot password flow
    alert('Password reset functionality coming soon!')
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-opsly-dark relative overflow-hidden px-4 sm:px-8 md:px-16">
      {/* Vertical Lines Background Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'repeating-linear-gradient(to right, rgba(255, 255, 255, 0.1) 0px, rgba(255, 255, 255, 0.1) 1px, transparent 1px, transparent 100px)',
          backgroundSize: '100px 100%'
        }}
      ></div>
      {/* Left Section - Login Form */}
      <div className="flex-1 p-4 sm:p-6 md:p-8 flex flex-col justify-center items-center lg:items-end relative overflow-y-auto z-10 lg:pr-8">

        <div className="relative z-10 max-w-md w-full min-w-0 px-4">
          {/* Logo */}
          <div className="text-xl sm:text-2xl font-bold text-white mb-8 sm:mb-10 md:mb-12">
            <span className="text-opsly-purple">Ö</span>psly
          </div>

          {/* Welcome Message */}
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Welcome Back</h1>
          <p className="mb-6 sm:mb-8 text-sm sm:text-base" style={{ color: '#FEF08A' }}>Please enter your username and password</p>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 text-red-200 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Email Input */}
            <div className="mb-4">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 bg-white text-opsly-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-opsly-purple disabled:opacity-50"
                required
              />
            </div>

            {/* Password Input */}
            <div className="mb-4 relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 bg-white text-opsly-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-opsly-purple pr-12 disabled:opacity-50"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500"
              >
                {showPassword ? <HiEyeOff /> : <HiEye />}
              </button>
            </div>

            {/* Forgot Password */}
            <div className="flex justify-end mb-6">
              <button 
                type="button"
                onClick={handleForgotPassword}
                className="text-opsly-purple hover:underline text-sm">
                Forgot Password?
              </button>
            </div>

            {/* Sign In Button */}
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-b from-opsly-purple to-purple-700 text-white rounded-lg font-semibold mb-6 hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          {/* OR Separator */}
          <div className="flex items-center mb-6">
            <div className="flex-1 border-t border-gray-600"></div>
            <span className="px-4 text-gray-400 text-sm">OR</span>
            <div className="flex-1 border-t border-gray-600"></div>
          </div>

            {/* Continue With Google */}
          <button 
            onClick={() => navigate('/marketing')}
            className="w-full py-3 bg-white text-opsly-dark rounded-lg font-semibold border border-gray-300 flex items-center justify-center gap-2 sm:gap-3 hover:bg-gray-50 transition text-sm sm:text-base">
            <FaGoogle className="text-lg sm:text-xl flex-shrink-0" />
            <span>Continue With Google</span>
          </button>

          {/* Sign Up Link */}
          <p className="text-center mt-6 text-sm sm:text-base text-gray-400">
            Don't have an account?{' '}
            <Link to="/signup" className="text-opsly-purple hover:underline">Sign Up</Link>
          </p>
        </div>
      </div>

      {/* Right Section - Illustration */}
      <div className="hidden lg:flex flex-1 flex-col justify-center items-end relative overflow-hidden py-8 z-10 pr-8">
        <div className="relative flex items-center justify-center w-full h-full py-8">
          <img src="/Frame 70.png" alt="Illustration" className="object-contain max-w-full max-h-full" />
        </div>
      </div>
    </div>
  )
}

export default LoginPage

