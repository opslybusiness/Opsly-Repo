// Chat service for Supabase chat table
// This service uses user_id (UUID from auth.users) instead of session_id
import { supabase } from '../lib/supabase'

/**
 * Save a chat message to Supabase
 * @param {string} userId - UUID from auth.users
 * @param {string} sender - 'user' or 'ai'
 * @param {string} content - Message content
 * @returns {Promise<Object>} The inserted message
 */
export const saveChatMessage = async (userId, sender, content) => {
  try {
    const { data, error } = await supabase
      .from('chat')
      .insert({
        user_id: userId,
        sender: sender,
        content: content,
      })
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error saving chat message:', error)
    throw error
  }
}

/**
 * Get chat messages for a user
 * @param {string} userId - UUID from auth.users
 * @returns {Promise<Array>} Array of chat messages
 */
export const getChatMessages = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('chat')
      .select('*')
      .eq('user_id', userId)
      .order('id', { ascending: true })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching chat messages:', error)
    throw error
  }
}

/**
 * Clear chat history for a user
 * @param {string} userId - UUID from auth.users
 * @returns {Promise<void>}
 */
export const clearChatHistory = async (userId) => {
  try {
    const { error } = await supabase
      .from('chat')
      .delete()
      .eq('user_id', userId)

    if (error) throw error
  } catch (error) {
    console.error('Error clearing chat history:', error)
    throw error
  }
}

