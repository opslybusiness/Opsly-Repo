import DashboardLayout from '../components/DashboardLayout'
import { FaFacebook, FaLinkedin, FaInstagram } from 'react-icons/fa'
import { HiCalendar } from 'react-icons/hi'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getApiUrl } from '../config/api'
import { postDynamic, getConnectionStatus } from '../services/marketingService'
import { useAuth } from '../contexts/AuthContext'
import { useMarketing } from '../contexts/MarketingContext'

function MarketingDashboard() {
  const { userId, isAuthenticated } = useAuth()
  const { 
    fbPosts, 
    instaPosts, 
    isFbLoading, 
    isInstaLoading, 
    fbError, 
    instaError, 
    fetchFbAnalytics, 
    fetchInstaAnalytics 
  } = useMarketing()
  
  const [selectedPlatform, setSelectedPlatform] = useState('facebook')
  const [connectionStatus, setConnectionStatus] = useState({
    facebook: false,
    linkedin: false,
    instagram: false
  })
  
  // Post scheduling form state
  const [postForm, setPostForm] = useState({
    postToFacebook: false,
    postToInstagram: false,
    message: '',
    image: null,
    postNow: true,
    scheduleMinutes: null,
    scheduledDatetime: '',
  })
  const [isPosting, setIsPosting] = useState(false)
  const [postError, setPostError] = useState(null)
  const [postSuccess, setPostSuccess] = useState(null)

  useEffect(() => {
    const fetchConnectionStatus = async () => {
      try {
        const status = await getConnectionStatus()
        setConnectionStatus(prev => ({
          ...prev,
          facebook: status.facebook || false,
          instagram: status.instagram || false
        }))
      } catch (error) {
        console.error('Failed to fetch connection status:', error)
        // Keep default values on error
      }
    }

    // Fetch connection status first
    if (isAuthenticated && userId) {
      fetchConnectionStatus()
    }
    
    // Fetch posts using context (will use cache if available)
    // Only fetch on mount or when auth changes, not when fetch functions change
    fetchFbAnalytics()
    fetchInstaAnalytics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, userId])

  const handleConnectFacebook = () => {
    // OAuth redirects require browser navigation, not fetch/axios
    window.location.href = getApiUrl('/auth/facebook/login')
  }

  const handlePostSubmit = async (e) => {
    e.preventDefault()
    setPostError(null)
    setPostSuccess(null)

    // Validation
    if (!postForm.postToFacebook && !postForm.postToInstagram) {
      setPostError('Please select at least one platform')
      return
    }

    if (!postForm.postNow && !postForm.scheduleMinutes && !postForm.scheduledDatetime) {
      setPostError('Please choose post timing: either post now or schedule')
      return
    }

    setIsPosting(true)

    if (!isAuthenticated || !userId) {
      setPostError('Please log in to post')
      return
    }

    try {
      // Create FormData for multipart/form-data
      const formData = new FormData()
      // user_id is now extracted from JWT token in backend, no need to send it
      formData.append('post_to_facebook', postForm.postToFacebook)
      formData.append('post_to_instagram', postForm.postToInstagram)
      formData.append('post_now', postForm.postNow)

      if (postForm.message) {
        formData.append('message', postForm.message)
      }

      if (postForm.image) {
        formData.append('image', postForm.image)
      }

      if (!postForm.postNow) {
        if (postForm.scheduleMinutes) {
          formData.append('schedule_minutes', postForm.scheduleMinutes)
        }
        if (postForm.scheduledDatetime) {
          formData.append('scheduled_datetime', postForm.scheduledDatetime)
        }
      }

      const response = await postDynamic(formData)
      
      setPostSuccess(
        `Post ${postForm.postNow ? 'published' : 'scheduled'} successfully! ${
          response.scheduled_for ? `Scheduled for: ${response.scheduled_for}` : ''
        }`
      )
      
      // Reset form after successful submission
      handleResetForm()
      
      // Optionally refresh analytics
      // You can add logic here to refresh the posts list
      
    } catch (error) {
      setPostError(error.message || 'Failed to post. Please try again.')
      console.error('Post error:', error)
    } finally {
      setIsPosting(false)
    }
  }

  const handleResetForm = () => {
    setPostForm({
      postToFacebook: false,
      postToInstagram: false,
      message: '',
      image: null,
      postNow: true,
      scheduleMinutes: null,
      scheduledDatetime: '',
    })
    setPostError(null)
    setPostSuccess(null)
  }

  return (
    <DashboardLayout userName="Alexa">
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Marketing</h1>
        <p className="text-gray-400 mb-8">Connect Your Accounts</p>

        {/* Connect Your Accounts Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Facebook Card */}
          <div className="bg-opsly-card rounded-lg p-6">
            <div className="flex items-center gap-4 mb-4">
              <FaFacebook className="text-4xl text-blue-500" />
              <div>
                <h3 className="text-xl font-semibold text-white">Facebook</h3>
                <p className={`text-sm ${connectionStatus.facebook ? 'text-green-400' : 'text-gray-400'}`}>
                  {connectionStatus.facebook ? 'Connected' : 'Not Connected'}
                </p>
              </div>
            </div>
            <p className="text-gray-300 mb-4 text-sm">Connect your account to start posting</p>
            <button 
              onClick={handleConnectFacebook}
              disabled={connectionStatus.facebook}
              className="w-full py-2 bg-opsly-purple text-white rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {connectionStatus.facebook ? 'Connected' : 'Connect Account'}
            </button>
          </div>

          {/* LinkedIn Card */}
          {/* <div className="bg-opsly-card rounded-lg p-6">
            <div className="flex items-center gap-4 mb-4">
              <FaLinkedin className="text-4xl text-blue-600" />
              <div>
                <h3 className="text-xl font-semibold text-white">LinkedIn</h3>
                <p className="text-sm text-gray-400">Not Connected</p>
              </div>
            </div>
            <p className="text-gray-300 mb-4 text-sm">Connect your account to start posting</p>
            <button className="w-full py-2 bg-opsly-purple text-white rounded-lg hover:bg-opacity-90 transition">
              Connect Account
            </button>
          </div> */}

          {/* Instagram Card */}
          <div className="bg-opsly-card rounded-lg p-6">
            <div className="flex items-center gap-4 mb-4">
              <FaInstagram className="text-4xl" style={{ background: 'linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }} />
              <div>
                <h3 className="text-xl font-semibold text-white">Instagram</h3>
                <p className={`text-sm ${connectionStatus.instagram ? 'text-green-400' : 'text-gray-400'}`}>
                  {connectionStatus.instagram ? 'Connected' : 'Not Connected'}
                </p>
              </div>
            </div>
            <p className="text-gray-300 mb-4 text-sm">
              {connectionStatus.instagram ? 'Your account is connected and ready to post' : 'Connect your account to start posting'}
            </p>
            <button 
              disabled={connectionStatus.instagram}
              className="w-full py-2 bg-opsly-purple text-white rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {connectionStatus.instagram ? 'Connected' : 'Connect Account'}
            </button>
          </div>
        </div>

        {/* Create New Post Section */}
        <div className="bg-opsly-card rounded-lg p-6 mb-12">
          <h2 className="text-2xl font-semibold text-white mb-2">Create New Post</h2>
          <p className="text-gray-400 mb-6">Select platforms and schedule your post</p>
          
          {postError && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-300">
              {postError}
            </div>
          )}
          
          {postSuccess && (
            <div className="mb-4 p-3 bg-green-500/20 border border-green-500 rounded-lg text-green-300">
              {postSuccess}
            </div>
          )}

          <form onSubmit={handlePostSubmit} className="space-y-6">
            {/* Platform Selection */}
            <div>
              <label className="block text-white mb-3">Select Platforms</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={postForm.postToFacebook}
                    onChange={(e) => setPostForm({ ...postForm, postToFacebook: e.target.checked })}
                    className="w-5 h-5 rounded"
                  />
                  <FaFacebook className="text-xl text-blue-500" />
                  <span className="text-gray-300">Facebook</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={postForm.postToInstagram}
                    onChange={(e) => setPostForm({ ...postForm, postToInstagram: e.target.checked })}
                    className="w-5 h-5 rounded"
                  />
                  <FaInstagram className="text-xl" style={{ background: 'linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }} />
                  <span className="text-gray-300">Instagram</span>
                </label>
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="block text-white mb-2">Message (Optional)</label>
              <textarea
                value={postForm.message}
                onChange={(e) => setPostForm({ ...postForm, message: e.target.value })}
                placeholder="What's on your mind?"
                className="w-full px-4 py-3 bg-opsly-dark text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-opsly-purple resize-none"
                rows="4"
              />
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-white mb-2">Image (Optional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPostForm({ ...postForm, image: e.target.files[0] })}
                className="w-full px-4 py-2 bg-opsly-dark text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-opsly-purple file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-opsly-purple file:text-white hover:file:bg-opacity-90"
              />
              {postForm.image && (
                <p className="mt-2 text-sm text-gray-400">Selected: {postForm.image.name}</p>
              )}
            </div>

            {/* Post Now vs Schedule */}
            <div>
              <label className="block text-white mb-3">Post Timing</label>
              <div className="flex gap-4 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="postTiming"
                    checked={postForm.postNow}
                    onChange={() => setPostForm({ ...postForm, postNow: true, scheduleMinutes: null, scheduledDatetime: '' })}
                    className="w-4 h-4"
                  />
                  <span className="text-gray-300">Post Now</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="postTiming"
                    checked={!postForm.postNow}
                    onChange={() => setPostForm({ ...postForm, postNow: false })}
                    className="w-4 h-4"
                  />
                  <span className="text-gray-300">Schedule</span>
                </label>
              </div>

              {!postForm.postNow && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-300 mb-2 text-sm">Schedule in minutes (Optional)</label>
                    <input
                      type="number"
                      value={postForm.scheduleMinutes || ''}
                      onChange={(e) => setPostForm({ ...postForm, scheduleMinutes: e.target.value ? parseInt(e.target.value) : null, scheduledDatetime: '' })}
                      placeholder="e.g., 30"
                      min="1"
                      className="w-full px-4 py-2 bg-opsly-dark text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-opsly-purple"
                    />
                  </div>
                  <div className="text-gray-400 text-sm text-center">OR</div>
                  <div>
                    <label className="block text-gray-300 mb-2 text-sm">Schedule at specific date & time</label>
                    <input
                      type="datetime-local"
                      value={postForm.scheduledDatetime ? postForm.scheduledDatetime.slice(0, 16) : ''}
                      onChange={(e) => {
                        const dt = e.target.value
                        // Convert datetime-local format (YYYY-MM-DDTHH:mm) to backend format (YYYY-MM-DDTHH:MM:SS)
                        const formatted = dt ? `${dt}:00` : ''
                        setPostForm({ ...postForm, scheduledDatetime: formatted, scheduleMinutes: null })
                      }}
                      className="w-full px-4 py-2 bg-opsly-dark text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-opsly-purple"
                    />
                    <p className="mt-1 text-xs text-gray-500">Format: YYYY-MM-DDTHH:MM:SS</p>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={isPosting || (!postForm.postToFacebook && !postForm.postToInstagram)}
                className="px-6 py-3 bg-opsly-purple text-white rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isPosting ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Posting...
                  </>
                ) : postForm.postNow ? (
                  'Post Now'
                ) : (
                  <>
                    <HiCalendar className="text-xl" />
                    Schedule Post
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleResetForm}
                className="px-6 py-3 bg-opsly-dark text-gray-300 rounded-lg hover:bg-opacity-90 transition border border-gray-700"
              >
                Reset
              </button>
            </div>
          </form>
        </div>

        {/* Your Posts Section */}
        <div>
          <h2 className="text-2xl font-semibold text-white mb-6">Your Posts</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Post 1 */}
            <Link to="/marketing/post-analytics" className="bg-opsly-card rounded-lg overflow-hidden hover:opacity-90 transition cursor-pointer">
              <div className="relative">
                <div className="w-full h-48 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <div className="text-6xl">📊</div>
                </div>
                <span className="absolute top-2 right-2 bg-green-500 text-white px-3 py-1 rounded text-sm font-semibold">
                  Published
                </span>
              </div>
              <div className="p-4">
                <div className="flex gap-2">
                  <FaFacebook className="text-blue-500" />
                  <FaInstagram className="text-pink-500" />
                  {/* <FaLinkedin className="text-blue-600" /> */}
                </div>
              </div>
            </Link>

            {/* Post 2 */}
            <Link to="/marketing/post-analytics" className="bg-opsly-card rounded-lg overflow-hidden hover:opacity-90 transition cursor-pointer">
              <div className="relative">
                <div className="w-full h-48 bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                  <div className="text-6xl">👥</div>
                </div>
                <span className="absolute top-2 right-2 bg-orange-500 text-white px-3 py-1 rounded text-sm font-semibold">
                  Scheduled
                </span>
              </div>
              <div className="p-4">
                <div className="flex gap-2">
                  <FaFacebook className="text-blue-500" />
                  <FaInstagram className="text-pink-500" />
                  <FaLinkedin className="text-blue-600" />
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Facebook Analytics Section */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-white">Facebook Posts</h2>
            <p className="text-gray-400 text-sm">
              {fbPosts.length} posts fetched from{' '}
              <span className="text-white font-medium">{connectionStatus.facebook ? 'connected' : 'your'}</span> page
            </p>
          </div>

          <div className="bg-opsly-card rounded-lg p-6">
            {isFbLoading && (
              <p className="text-gray-400">Loading Facebook analytics...</p>
            )}
            {fbError && (
              <p className="text-red-400">Failed to load posts: {fbError}</p>
            )}
            {!isFbLoading && !fbError && fbPosts.length === 0 && (
              <p className="text-gray-400">No Facebook posts found.</p>
            )}

            {!isFbLoading && !fbError && fbPosts.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {fbPosts.map((post) => (
                  <a
                    key={post.post_id}
                    href={post.post_url}
                    target="_blank"
                    rel="noreferrer"
                    className="border border-gray-800 rounded-lg overflow-hidden bg-opsly-dark hover:border-opsly-purple transition"
                  >
                    {post.image_url && (
                      <div className="h-48 bg-opsly-card">
                        <img
                          src={post.image_url}
                          alt={post.message || 'Facebook post'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-4 space-y-3">
                      <div className="text-sm text-gray-400">
                        {post.created_time
                          ? new Date(post.created_time).toLocaleString()
                          : 'Date not available'}
                      </div>
                      <p className="text-white">
                        {post.message || 'No caption provided'}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-gray-300">
                        <span>👍 {post.likes}</span>
                        <span>💬 {post.comments?.length || 0}</span>
                        <span>🔁 {post.shares}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Instagram Analytics Section */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-white">Instagram Posts</h2>
            <p className="text-gray-400 text-sm">
              {instaPosts.length} posts fetched from Instagram
            </p>
          </div>

          <div className="bg-opsly-card rounded-lg p-6">
            {isInstaLoading && (
              <p className="text-gray-400">Loading Instagram analytics...</p>
            )}
            {instaError && (
              <p className="text-red-400">Failed to load posts: {instaError}</p>
            )}
            {!isInstaLoading && !instaError && instaPosts.length === 0 && (
              <p className="text-gray-400">No Instagram posts found.</p>
            )}

            {!isInstaLoading && !instaError && instaPosts.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {instaPosts.map((post) => (
                  <a
                    key={post.post_id || post.timestamp}
                    href={post.post_url}
                    target="_blank"
                    rel="noreferrer"
                    className="border border-gray-800 rounded-lg overflow-hidden bg-opsly-dark hover:border-pink-500 transition"
                  >
                    {post.media_url && (
                      <div className="h-48 bg-opsly-card">
                        <img
                          src={post.media_url}
                          alt={post.caption || 'Instagram post'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-4 space-y-3">
                      <div className="text-sm text-gray-400 flex justify-between">
                        <span className="uppercase tracking-wide text-pink-400">
                          {post.media_type || 'POST'}
                        </span>
                        <span>
                          {post.timestamp
                            ? new Date(post.timestamp).toLocaleString()
                            : 'Date not available'}
                        </span>
                      </div>
                      <p className="text-white">
                        {post.caption || 'No caption provided'}
                      </p>
                      <div className="grid grid-cols-3 gap-3 text-sm text-gray-300">
                        <span>👍 Likes: <span className="text-white">{post.likes ?? 0}</span></span>
                        <span>💬 Comments: <span className="text-white">{post.comments_count ?? 0}</span></span>
                        <span>🔁 Shares: <span className="text-white">{post.shares ?? 0}</span></span>
                        {/* <span>💾 Saved: <span className="text-white">{post.saved ?? 0}</span></span>
                        <span>📣 Reach: <span className="text-white">{post.reach ?? 0}</span></span>
                        <span>👀 Impressions: <span className="text-white">{post.impressions ?? 0}</span></span> */}
                      </div>
                      {Array.isArray(post.comments) && post.comments.length > 0 && (
                        <div className="text-sm text-gray-400 border-t border-gray-800 pt-3">
                          <p className="text-white font-medium mb-2">Recent comments</p>
                          <ul className="space-y-2">
                            {post.comments.slice(0, 2).map((comment, idx) => (
                              <li key={idx} className="text-gray-300">
                                “{comment}”
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default MarketingDashboard

