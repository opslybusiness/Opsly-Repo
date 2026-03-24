import { getApiUrl } from '../config/api'

const EMAIL_BOT_API_BASE_URL = (import.meta.env.VITE_EMAIL_BOT_API_BASE_URL || 'http://localhost:8001').replace(/\/$/, '')

const getCampaignApiUrl = (endpoint) => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`

  // Use a dedicated base URL for Campaign Ops so it can target EmailBot-BE independently.
  if (EMAIL_BOT_API_BASE_URL) {
    return `${EMAIL_BOT_API_BASE_URL}${cleanEndpoint}`
  }

  // Fallback to shared API config if no dedicated URL is provided.
  return getApiUrl(endpoint)
}

function getAuthHeaders() {
  const token = localStorage.getItem('token')
  const headers = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

async function request(endpoint, options = {}) {
  const response = await fetch(getCampaignApiUrl(endpoint), {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.detail || payload.message || 'Request failed')
  }
  return payload
}

export const createProfile = (data) => request('/campaigns/profiles', {
  method: 'POST',
  body: JSON.stringify(data),
})

export const listProfiles = () => request('/campaigns/profiles')

export const createCampaign = (data) => request('/campaigns', {
  method: 'POST',
  body: JSON.stringify(data),
})

export const listCampaigns = () => request('/campaigns')

export const discoverProspects = (campaignId, maxResults = 20) => request(`/campaigns/${campaignId}/discover`, {
  method: 'POST',
  body: JSON.stringify({ max_results: maxResults }),
})

export const importManualProspects = (campaignId, csvData = '') => request(`/campaigns/${campaignId}/prospects/manual`, {
  method: 'POST',
  body: JSON.stringify({ csv_data: csvData }),
})

export const generateEmails = (campaignId) => request(`/campaigns/${campaignId}/generate-emails`, {
  method: 'POST',
})

export const sendEmails = (campaignId) => request(`/campaigns/${campaignId}/send`, {
  method: 'POST',
})

export const checkReplies = (campaignId) => request(`/campaigns/${campaignId}/check-replies`, {
  method: 'POST',
})

export const getAnalytics = (campaignId) => request(`/campaigns/${campaignId}/analytics`)

export const listProspects = (campaignId) => request(`/campaigns/${campaignId}/prospects`)

export const listEmails = (campaignId) => request(`/campaigns/${campaignId}/emails`)

export const updateEmailDraft = (campaignId, emailId, data) => request(`/campaigns/${campaignId}/emails/${emailId}`, {
  method: 'PATCH',
  body: JSON.stringify(data),
})

export const listReplyThreads = (campaignId) => request(`/campaigns/${campaignId}/reply-threads`)

export const sendSingleEmail = (campaignId, emailId) => request(`/campaigns/${campaignId}/emails/${emailId}/send`, {
  method: 'POST',
})
