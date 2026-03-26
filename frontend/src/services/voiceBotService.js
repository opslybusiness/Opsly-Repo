import { apiClient } from './api'

// ── Assistant ───────────────────────────────────────────────────────────────

export const createAssistant = async (businessName, systemPrompt) => {
  const formData = new FormData()
  formData.append('business_name', businessName)
  formData.append('system_prompt', systemPrompt)

  return apiClient('/voice-bot/assistant', {
    method: 'POST',
    body: formData,
  })
}

export const getAssistant = async () => {
  return apiClient('/voice-bot/assistant', {
    method: 'GET',
  })
}

export const updateAssistant = async ({ businessName, systemPrompt } = {}) => {
  const formData = new FormData()
  if (businessName !== undefined) formData.append('business_name', businessName)
  if (systemPrompt !== undefined) formData.append('system_prompt', systemPrompt)

  return apiClient('/voice-bot/assistant', {
    method: 'PATCH',
    body: formData,
  })
}

// ── Phone number ────────────────────────────────────────────────────────────

export const buyVoiceBotNumber = async (areaCode = '412') => {
  const formData = new FormData()
  formData.append('area_code', areaCode)

  return apiClient('/voice-bot/buy-number', {
    method: 'POST',
    body: formData,
  })
}

export const getVoiceBotNumber = async () => {
  return apiClient('/voice-bot/my-number', {
    method: 'GET',
  })
}

// ── Recordings ──────────────────────────────────────────────────────────────

export const getVoiceBotRecordings = async () => {
  return apiClient('/voice-bot/recordings', {
    method: 'GET',
  })
}
