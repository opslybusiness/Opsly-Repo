import { Link, useNavigate, Navigate } from 'react-router-dom'
import { FaGoogle } from 'react-icons/fa'
import { HiEye, HiEyeOff } from 'react-icons/hi'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

function SignupPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { signUp, isAuthenticated, loading: authLoading } = useAuth()

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/marketing', { replace: true })
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
    return <Navigate to="/marketing" replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    // Validation
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long')
      setLoading(false)
      return
    }

    try {
      const { error: signUpError } = await signUp(email, password, {
        full_name: name,
      })
      
      if (signUpError) {
        setError(signUpError.message || 'Failed to create account. Please try again.')
      } else {
        setSuccess('Account created successfully! Please check your email to verify your account before signing in.')
        // Redirect after a delay
        setTimeout(() => {
          navigate('/login')
        }, 3000)
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      console.error('Signup error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen flex bg-opsly-dark relative overflow-hidden px-16">
      {/* Vertical Lines Background Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'repeating-linear-gradient(to right, rgba(255, 255, 255, 0.1) 0px, rgba(255, 255, 255, 0.1) 1px, transparent 1px, transparent 100px)',
          backgroundSize: '100px 100%'
        }}
      ></div>
      {/* Left Section - Signup Form */}
      <div className="flex-1 p-8 flex flex-col justify-center items-end relative overflow-y-auto z-10 pr-8">

        <div className="relative z-10 max-w-md w-full">
          {/* Logo */}
          <div className="text-2xl font-bold text-white mb-12">
            <span className="text-opsly-purple">Ö</span>psly
          </div>

          {/* Welcome Message */}
          <h1 className="text-4xl font-bold text-white mb-2">Create Account</h1>
          <p className="text-gray-400 mb-8">Please enter your details to get started</p>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 text-red-200 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-4 p-3 bg-green-500/20 border border-green-500/50 text-green-200 rounded-lg text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Name Input */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 bg-white text-opsly-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-opsly-purple disabled:opacity-50"
                required
              />
            </div>

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
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500"
              >
                {showPassword ? <HiEyeOff /> : <HiEye />}
              </button>
            </div>

            {/* Confirm Password Input */}
            <div className="mb-6 relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 bg-white text-opsly-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-opsly-purple pr-12 disabled:opacity-50"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500"
              >
                {showConfirmPassword ? <HiEyeOff /> : <HiEye />}
              </button>
            </div>

            {/* Sign Up Button */}
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-b from-opsly-purple to-purple-700 text-white rounded-lg font-semibold mb-6 hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Creating Account...' : 'Sign Up'}
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
            className="w-full py-3 bg-white text-opsly-dark rounded-lg font-semibold border border-gray-300 flex items-center justify-center gap-3 hover:bg-gray-50 transition">
            <FaGoogle className="text-xl" />
            Continue With Google
          </button>

          {/* Sign In Link */}
          <p className="text-center mt-6 text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-opsly-purple hover:underline">Sign In</Link>
          </p>
        </div>
      </div>

      {/* Right Section - Illustration */}
      <div className="flex-1 flex flex-col justify-center items-end relative overflow-hidden py-8 z-10 pr-8">
        <div className="relative flex items-center justify-center w-full h-full py-8">
          <img src="/Frame 70.png" alt="Illustration" className="object-contain max-w-full max-h-full" />
        </div>
      </div>
    </div>
  )
}

export default SignupPage

