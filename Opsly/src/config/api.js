
// Check if we're in development mode
// Vite sets MODE to 'development' in dev, 'production' in production builds

const isDevelopment = 
  import.meta.env.MODE === 'development' || 
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.includes('localhost')))


// 1. If VITE_API_BASE_URL is set, use it (works for both dev and prod)
// 2. Otherwise, use '/api' which is proxied by Vite in dev and Vercel in production

const getBaseUrl = () => {
  // Priority 1: Use environment variable if set (always takes precedence)
  const envApiUrl = import.meta.env.VITE_API_BASE_URL
  if (envApiUrl && envApiUrl.trim() !== '') {
    // Remove trailing slash if present
    return envApiUrl.replace(/\/$/, '')
  }
  
  // Priority 2: Use '/api' proxy in both dev and production
  // - In development: Vite proxy handles it (see vite.config.js)
  // - In production: Vercel rewrites handle it (see vercel.json)
  // This avoids CORS issues since requests appear to come from the same origin
  return '/api'
}

const BASE_URL = getBaseUrl()

// Log in development to help debug
if (isDevelopment) {
  console.log('API Config - Development mode:', {
    MODE: import.meta.env.MODE,
    DEV: import.meta.env.DEV,
    BASE_URL: BASE_URL,
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL
  })
} else {
  console.log('API Config - Production mode:', {
    MODE: import.meta.env.MODE,
    BASE_URL: BASE_URL,
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL
  })
}

export const API_CONFIG = {
  BASE_URL: BASE_URL,
}

export const getApiUrl = (endpoint) => {
  // Remove leading slash from endpoint if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  const fullUrl = `${API_CONFIG.BASE_URL}${cleanEndpoint}`
  
  // Log in development
  if (isDevelopment) {
    console.log('API Call:', fullUrl)
  }
  
  return fullUrl
}
