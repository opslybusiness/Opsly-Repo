// src/services/api.js
import { getApiUrl } from '../config/api'

export const apiClient = async (endpoint, options = {}) => {
  const url = getApiUrl(endpoint)
  
  const defaultHeaders = {}
  
  // Only set Content-Type to JSON if body is not FormData
  // FormData needs to set its own Content-Type with boundary
  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json'
  }

  // Add auth token if available
  const token = localStorage.getItem('token')
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  }

  try {
    console.log('Making API request to:', url)
    const response = await fetch(url, config)
    
    // Handle non-JSON responses
    const contentType = response.headers.get('content-type')
    const data = contentType?.includes('application/json') 
      ? await response.json() 
      : await response.text()
    
    if (!response.ok) {
      console.error('API request failed:', {
        url,
        status: response.status,
        statusText: response.statusText,
        data
      })
      throw new Error(data.message || data || `HTTP error! status: ${response.status}`)
    }
    
    return data
  } catch (error) {
    console.error('API Error:', {
      url,
      error: error.message,
      stack: error.stack
    })
    throw error
  }
}

