import { apiClient } from './api'

/**
 * Fraud Detection Service - Handles fraud detection history API calls
 * 
 * Note: Fraud detection is now performed automatically when transactions are added.
 * This service is primarily used to retrieve fraud detection history.
 */

/**
 * Get fraud detection history for the authenticated user
 * Returns transactions that have been analyzed for fraud from the FinancialData table.
 * 
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

/**
 * Payment code mapping (for display purposes)
 * Maps use_chip values to payment codes:
 * - 'Swipe Transaction': 1
 * - 'Chip Transaction': 2
 * - 'Online Transaction': 3
 */
export const PAYMENT_CODE_MAP = {
  'Swipe Transaction': 1,
  'Chip Transaction': 2,
  'Online Transaction': 3
}

/**
 * Payment code labels for display
 */
export const PAYMENT_CODE_LABELS = {
  1: 'Swipe',
  2: 'Chip',
  3: 'Online'
}
