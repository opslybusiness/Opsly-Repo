import { apiClient } from './api'

/**
 * Fraud Detection Service - Handles all fraud detection-related API calls
 */

/**
 * Check if a single transaction is fraudulent
 * @param {Object} data - Transaction data
 * @param {number} data.amount - Transaction amount
 * @param {string} data.transaction_date - Date in YYYY-MM-DD or YYYY-MM-DD HH:MM:SS format
 * @param {string} data.merchant_name - Optional merchant name
 * @param {string} data.merchant_state - Optional merchant state
 * @param {string} data.transaction_id - Optional transaction ID
 * @returns {Promise<Object>} Fraud detection result
 */
export const checkTransactionFraud = async (data) => {
  const formData = new URLSearchParams()
  formData.append('amount', data.amount.toString())
  formData.append('transaction_date', data.transaction_date)
  if (data.merchant_name) formData.append('merchant_name', data.merchant_name)
  if (data.merchant_state) formData.append('merchant_state', data.merchant_state)
  if (data.transaction_id) formData.append('transaction_id', data.transaction_id)

  return apiClient('/fraud/check', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  })
}

/**
 * Check multiple transactions from a CSV file for fraud
 * @param {File} file - CSV file to upload
 * @returns {Promise<Object>} Batch fraud detection results
 */
export const checkTransactionsBatch = async (file) => {
  const formData = new FormData()
  formData.append('file', file)

  return apiClient('/fraud/check/batch', {
    method: 'POST',
    headers: {
      // Don't set Content-Type, let browser set it with boundary for FormData
    },
    body: formData,
  })
}

/**
 * Get fraud detection history for the authenticated user
 * @param {Object} params - Query parameters
 * @param {string} params.start_date - Optional start date filter (YYYY-MM-DD)
 * @param {string} params.end_date - Optional end date filter (YYYY-MM-DD)
 * @param {number} params.is_fraud - Optional filter: 0 for legitimate, 1 for fraud
 * @param {number} params.limit - Number of records to return (default: 100)
 * @param {number} params.offset - Number of records to skip (default: 0)
 * @returns {Promise<Object>} Fraud detection history
 */
export const getFraudDetectionHistory = async (params = {}) => {
  const queryParams = new URLSearchParams()
  
  if (params.start_date) queryParams.append('start_date', params.start_date)
  if (params.end_date) queryParams.append('end_date', params.end_date)
  if (params.is_fraud !== undefined) queryParams.append('is_fraud', params.is_fraud.toString())
  if (params.limit) queryParams.append('limit', params.limit.toString())
  if (params.offset) queryParams.append('offset', params.offset.toString())

  const queryString = queryParams.toString()
  const endpoint = `/fraud/history${queryString ? `?${queryString}` : ''}`
  
  return apiClient(endpoint, { method: 'GET' })
}

