import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
      
      // Store access token in localStorage for API calls
      if (session?.access_token) {
        localStorage.setItem('token', session.access_token)
      } else {
        localStorage.removeItem('token')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Sign up with email and password
  const signUp = async (email, password, metadata = {}) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata, // Additional user metadata (like name)
        },
      })

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Sign up error:', error)
      return { data: null, error }
    }
  }

  // Sign in with email and password
  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
      
      // Store token for API calls
      if (data.session?.access_token) {
        localStorage.setItem('token', data.session.access_token)
      }
      
      return { data, error: null }
    } catch (error) {
      console.error('Sign in error:', error)
      return { data: null, error }
    }
  }

  // Sign out
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      localStorage.removeItem('token')
      // Navigation will be handled by the component calling signOut
      return { error: null }
    } catch (error) {
      console.error('Sign out error:', error)
      return { error }
    }
  }

  // Reset password
  const resetPassword = async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      return { error: null }
    } catch (error) {
      console.error('Reset password error:', error)
      return { error }
    }
  }

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    isAuthenticated: !!user,
    userId: user?.id || null, // UUID from auth.users table
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

