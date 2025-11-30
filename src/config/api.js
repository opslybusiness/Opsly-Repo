// src/config/api.js
// In development, use Vite proxy to avoid CORS issues
// In production, use the full API URL
const isDevelopment = import.meta.env.DEV
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://marketing-minds-be.vercel.app'

export const API_CONFIG = {
  BASE_URL: isDevelopment ? '/api' : API_BASE_URL,
}

export const getApiUrl = (endpoint) => {
  // Remove leading slash from endpoint if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return `${API_CONFIG.BASE_URL}${cleanEndpoint}`
}

