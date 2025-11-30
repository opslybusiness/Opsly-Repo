// src/config/api.js
// In development, use Vite proxy to avoid CORS issues
// In production, use the full API URL
// Check mode first as it's more reliable than DEV/PROD flags
const isDevelopment = import.meta.env.MODE === 'development' || import.meta.env.DEV
const isProduction = import.meta.env.MODE === 'production' || import.meta.env.PROD

// Determine the base URL:
// 1. If VITE_API_BASE_URL is set, use it (works for both dev and prod)
// 2. If in development and no env var, use '/api' (Vite proxy)
// 3. If in production and no env var, use the default production URL
const getBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL
  }
  if (isDevelopment) {
    return '/api'
  }
  return 'https://marketing-minds-be.vercel.app'
}

export const API_CONFIG = {
  BASE_URL: getBaseUrl(),
}

export const getApiUrl = (endpoint) => {
  // Remove leading slash from endpoint if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return `${API_CONFIG.BASE_URL}${cleanEndpoint}`
}

