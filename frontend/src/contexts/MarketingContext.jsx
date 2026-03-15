import { createContext, useContext, useState, useCallback } from 'react'
import { getFacebookAnalytics, getInstagramAnalytics } from '../services/marketingService'

const MarketingContext = createContext({})

export const useMarketing = () => {
  const context = useContext(MarketingContext)
  if (!context) {
    throw new Error('useMarketing must be used within a MarketingProvider')
  }
  return context
}

// Cache expiration time in milliseconds (5 minutes)
const CACHE_EXPIRATION = 5 * 60 * 1000

export const MarketingProvider = ({ children }) => {
  const [fbPosts, setFbPosts] = useState([])
  const [instaPosts, setInstaPosts] = useState([])
  const [isFbLoading, setIsFbLoading] = useState(false)
  const [isInstaLoading, setIsInstaLoading] = useState(false)
  const [fbError, setFbError] = useState(null)
  const [instaError, setInstaError] = useState(null)
  
  // Cache timestamps
  const [fbCacheTime, setFbCacheTime] = useState(null)
  const [instaCacheTime, setInstaCacheTime] = useState(null)

  // Check if cache is still valid
  const isCacheValid = (cacheTime) => {
    if (!cacheTime) return false
    return Date.now() - cacheTime < CACHE_EXPIRATION
  }

  // Fetch Facebook analytics
  const fetchFbAnalytics = useCallback(async (forceRefresh = false) => {
    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && isCacheValid(fbCacheTime) && fbPosts.length >= 0) {
      return { analytics: fbPosts }
    }

    // If already loading, don't start another request
    if (isFbLoading) {
      return { analytics: fbPosts }
    }

    setIsFbLoading(true)
    setFbError(null)

    try {
      const data = await getFacebookAnalytics()
      const posts = data?.analytics || []
      setFbPosts(posts)
      setFbCacheTime(Date.now())
      return { analytics: posts }
    } catch (error) {
      setFbError(error.message || 'Failed to load Facebook analytics')
      throw error
    } finally {
      setIsFbLoading(false)
    }
  }, [fbPosts, fbCacheTime, isFbLoading])

  // Fetch Instagram analytics
  const fetchInstaAnalytics = useCallback(async (forceRefresh = false) => {
    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && isCacheValid(instaCacheTime) && instaPosts.length >= 0) {
      return { analytics: instaPosts }
    }

    // If already loading, don't start another request
    if (isInstaLoading) {
      return { analytics: instaPosts }
    }

    setIsInstaLoading(true)
    setInstaError(null)

    try {
      const data = await getInstagramAnalytics()
      const posts = data?.analytics || []
      setInstaPosts(posts)
      setInstaCacheTime(Date.now())
      return { analytics: posts }
    } catch (error) {
      setInstaError(error.message || 'Failed to load Instagram analytics')
      throw error
    } finally {
      setIsInstaLoading(false)
    }
  }, [instaPosts, instaCacheTime, isInstaLoading])

  // Clear cache
  const clearCache = useCallback(() => {
    setFbPosts([])
    setInstaPosts([])
    setFbCacheTime(null)
    setInstaCacheTime(null)
    setFbError(null)
    setInstaError(null)
  }, [])

  const value = {
    fbPosts,
    instaPosts,
    isFbLoading,
    isInstaLoading,
    fbError,
    instaError,
    fetchFbAnalytics,
    fetchInstaAnalytics,
    clearCache,
    // Expose cache status
    isFbCacheValid: isCacheValid(fbCacheTime),
    isInstaCacheValid: isCacheValid(instaCacheTime),
  }

  return <MarketingContext.Provider value={value}>{children}</MarketingContext.Provider>
}

