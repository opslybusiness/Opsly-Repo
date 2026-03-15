// src/services/marketingService.js
import { apiClient } from './api'

export const connectFacebook = async () => {
  return apiClient('/auth/facebook/login', {
    method: 'GET',
  })
}

export const disconnectFacebook = async () => {
  return apiClient('/auth/facebook/logout', {
    method: 'POST',
  })
}

export const connectLinkedIn = async () => {
  return apiClient('/auth/linkedin/login', {
    method: 'POST',
  })
}

export const connectInstagram = async () => {
  return apiClient('/auth/instagram/login', {
    method: 'POST',
  })
}

export const getFacebookAnalytics = async () => {
  // user_id is now extracted from JWT token in backend
  return apiClient('/facebook/page-analytics', {
    method: 'GET',
  })
}

export const getInstagramAnalytics = async () => {
  // user_id is now extracted from JWT token in backend
  return apiClient('/instagram/page-analytics', {
    method: 'GET',
  })
}

export const getConnectionStatus = async () => {
  // Check if user has session_token (Facebook/Instagram connection)
  return apiClient('/user/connection-status', {
    method: 'GET',
  })
}

// Post scheduling function - uses FormData for file uploads
export const postDynamic = async (formData) => {
  const { getApiUrl } = await import('../config/api')
  const url = getApiUrl('/social/post-dynamic')
  
  // Don't set Content-Type header - browser will set it with boundary for multipart/form-data
  const headers = {}
  
  // Add auth token if available
  const token = localStorage.getItem('token')
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    })
    
    const contentType = response.headers.get('content-type')
    const data = contentType?.includes('application/json') 
      ? await response.json() 
      : await response.text()
    
    if (!response.ok) {
      throw new Error(data.message || data || `HTTP error! status: ${response.status}`)
    }
    
    return data
  } catch (error) {
    console.error('API Error:', error)
    throw error
  }
}

