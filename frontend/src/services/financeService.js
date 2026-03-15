import { apiClient } from './api'

/**
 * Finance Service - Handles all finance-related API calls
 */

/**
 * Get financial data for the authenticated user
 * @param {Object} params - Query parameters
 * @param {string} params.start_date - Optional start date filter (YYYY-MM-DD)
 * @param {string} params.end_date - Optional end date filter (YYYY-MM-DD)
 * @param {number} params.month - Optional month filter (1-12, requires year)
 * @param {number} params.year - Optional year filter (YYYY, requires month)
 * @param {number} params.limit - Number of records to return (default: 100)
 * @param {number} params.offset - Number of records to skip (default: 0)
 * @returns {Promise<Object>} Financial data response
 */
export const getFinancialData = async (params = {}) => {
  const queryParams = new URLSearchParams()
  
  if (params.start_date) queryParams.append('start_date', params.start_date)
  if (params.end_date) queryParams.append('end_date', params.end_date)
  if (params.month) queryParams.append('month', params.month.toString())
  if (params.year) queryParams.append('year', params.year.toString())
  if (params.limit) queryParams.append('limit', params.limit.toString())
  if (params.offset) queryParams.append('offset', params.offset.toString())

  const queryString = queryParams.toString()
  const endpoint = `/finance/data${queryString ? `?${queryString}` : ''}`
  
  return apiClient(endpoint, { method: 'GET' })
}

/**
 * Add a single financial data entry
 * @param {Object} data - Financial data
 * @param {string} data.date - Date in YYYY-MM-DD format
 * @param {number} data.amount - Transaction amount
 * @param {string} data.category - Optional expense category
 * @param {string} data.use_chip - Optional payment method ("Swipe Transaction" or "Online Transaction")
 * @returns {Promise<Object>} Created financial data entry
 */
export const addFinancialData = async (data) => {
  const formData = new URLSearchParams()
  formData.append('date', data.date)
  formData.append('amount', data.amount.toString())
  if (data.category) {
    formData.append('category', data.category)
  }
  if (data.use_chip) {
    formData.append('use_chip', data.use_chip)
  }

  return apiClient('/finance/data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  })
}

/**
 * Upload financial data from CSV file
 * @param {File} file - CSV file to upload
 * @returns {Promise<Object>} Upload result with count of added entries
 */
export const uploadFinancialDataCSV = async (file) => {
  const formData = new FormData()
  formData.append('file', file)

  return apiClient('/finance/data/upload', {
    method: 'POST',
    headers: {
      // Don't set Content-Type, let browser set it with boundary for FormData
    },
    body: formData,
  })
}

/**
 * Get financial forecast
 * @param {number} days - Number of days to forecast
 * @returns {Promise<Object>} Forecast data with predictions
 */
export const getFinancialForecast = async (days) => {
  const formData = new URLSearchParams()
  formData.append('days', days.toString())

  return apiClient('/finance/forecast', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  })
}

/**
 * Get all available expense categories
 * @returns {Promise<Object>} Categories list with id, name, mcc_code, and description
 */
export const getCategories = async () => {
  return apiClient('/categories', {
    method: 'GET',
  })
}

