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

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/customer-support', { replace: true })
    }
  }, [isAuthenticated, authLoading, navigate])

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-opsly-dark">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  // Redirect if authenticated
  if (isAuthenticated) {
    return <Navigate to="/customer-support" replace />
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
      const { error: signInError } = await signIn(email, password)
      
      if (signInError) {
        setError(signInError.message || 'Failed to sign in. Please check your credentials.')
      } else {
        // Redirect to dashboard or intended page
        navigate('/customer-support')
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      console.error('Login error:', err)
    } finally {
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
    <div className="min-h-screen flex bg-opsly-dark">
      {/* Left Section - Login Form */}
      <div className="flex-1 bg-opsly-dark p-12 flex flex-col justify-center relative overflow-hidden">
        {/* Hexagonal Pattern Background */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239933ea' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>

        <div className="relative z-10 max-w-md w-full">
          {/* Logo */}
          <div className="text-2xl font-bold text-white mb-12">
            <span className="text-opsly-purple">Ö</span>psly
          </div>

          {/* Welcome Message */}
          <h1 className="text-4xl font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-gray-400 mb-8">Please enter your username and password</p>

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
            onClick={() => navigate('/customer-support')}
            className="w-full py-3 bg-white text-opsly-dark rounded-lg font-semibold border border-gray-300 flex items-center justify-center gap-3 hover:bg-gray-50 transition">
            <FaGoogle className="text-xl" />
            Continue With Google
          </button>

          {/* Sign Up Link */}
          <p className="text-center mt-6 text-gray-400">
            Don't have an account?{' '}
            <Link to="/signup" className="text-opsly-purple hover:underline">Sign Up</Link>
          </p>
        </div>
      </div>

      {/* Right Section - Illustration */}
      <div className="flex-1 bg-opsly-gray p-12 flex flex-col justify-center items-center relative overflow-hidden">
        {/* Hexagonal Pattern Background */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239933ea' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>

        <div className="relative z-10 flex flex-col items-center">
          {/* 3D Character Placeholder - Using a styled div to represent the character */}
          <div className="relative mb-8">
            <div className="w-64 h-80 bg-gradient-to-br from-gray-400 to-gray-600 rounded-2xl flex items-center justify-center relative" style={{
              boxShadow: '0 0 40px rgba(147, 51, 234, 0.5)',
              border: '2px solid rgba(147, 51, 234, 0.3)'
            }}>
              <div className="text-6xl">👨‍💻</div>
            </div>
            {/* Floating Shapes */}
            <div className="absolute -top-8 -left-8 w-16 h-16 bg-opsly-purple opacity-60 rounded-lg transform rotate-45"></div>
            <div className="absolute -bottom-8 -right-8 w-20 h-12 bg-green-400 opacity-60 rounded-full"></div>
          </div>

          {/* Promotional Text */}
          <p className="text-2xl text-white text-center">
            Business Operations, done when you're{' '}
            <span className="text-opsly-purple">asleep</span>
          </p>

          {/* Pagination Dots */}
          <div className="flex gap-2 mt-8">
            <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
            <div className="w-3 h-2 bg-opsly-purple rounded-full"></div>
            <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage

