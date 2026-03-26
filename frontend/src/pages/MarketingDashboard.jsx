import DashboardLayout from '../components/DashboardLayout'
import { FaFacebook, FaInstagram, FaLinkedin } from 'react-icons/fa'
import { HiCalendar, HiPhotograph } from 'react-icons/hi'
import { useEffect, useState, useRef } from 'react'
import { getApiUrl } from '../config/api'
import { postDynamic, getConnectionStatus } from '../services/marketingService'
import { useAuth } from '../contexts/AuthContext'
import { useMarketing } from '../contexts/MarketingContext'

function MarketingDashboard() {
  const { userId, isAuthenticated, loading: authLoading } = useAuth()
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

  const [connectionStatus, setConnectionStatus] = useState({
    facebook: false,
    linkedin: false,
    instagram: false
  })
  
  // Post scheduling form state
  const [postForm, setPostForm] = useState({
    postToFacebook: false,
    postToInstagram: false,
    postToLinkedin: false,
    message: '',
    image: null,
    postNow: true,
    scheduleMinutes: null,
    scheduledDatetime: '',
  })
  const [isPosting, setIsPosting] = useState(false)
  const [postError, setPostError] = useState(null)
  const [postSuccess, setPostSuccess] = useState(null)
  /** null | 'published' | 'scheduled' */
  const [linkedinToast, setLinkedinToast] = useState(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null)
  const imageInputRef = useRef(null)
  const linkedinToastTimerRef = useRef(null)

  useEffect(() => {
    if (!postForm.image) {
      setImagePreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(postForm.image)
    setImagePreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [postForm.image])

  // OAuth return: ?connected=true (Meta), ?connected=linkedin, or ?error=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connected')
    if (connected === 'true' || connected === 'linkedin') {
      window.history.replaceState({}, document.title, window.location.pathname)
    }
    const qError = params.get('error')
    if (qError) {
      const label = qError.includes('linkedin') ? 'LinkedIn' : 'Facebook'
      setPostError(`${label} connection failed: ${qError.replace(/_/g, ' ')}`)
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  useEffect(() => {
    const fetchConnectionStatus = async () => {
      try {
        const status = await getConnectionStatus()
        setConnectionStatus(prev => ({
          ...prev,
          facebook: status.facebook || false,
          instagram: status.instagram || false,
          linkedin: status.linkedin || false,
        }))
      } catch (error) {
        console.error('Failed to fetch connection status:', error)
        // Keep default values on error
      }
    }

    // Fetch connection status first - only if authenticated
    if (!authLoading && isAuthenticated && userId) {
      fetchConnectionStatus()
    }
    
    // Fetch posts using context (will use cache if available)
    // Only fetch if authenticated and not loading
    if (!authLoading && isAuthenticated) {
      try {
        fetchFbAnalytics()
        fetchInstaAnalytics()
      } catch (error) {
        console.error('Error fetching analytics:', error)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, userId])

  const handleConnectFacebook = () => {
    const url = userId
      ? getApiUrl(`/auth/facebook/login?user_id=${userId}`)
      : getApiUrl('/auth/facebook/login')
    window.location.href = url
  }

  const handleConnectLinkedin = () => {
    const url = userId
      ? getApiUrl(`/auth/linkedin/login?user_id=${userId}`)
      : getApiUrl('/auth/linkedin/login')
    window.location.href = url
  }

  const showLinkedinSuccessToast = (mode) => {
    if (linkedinToastTimerRef.current) clearTimeout(linkedinToastTimerRef.current)
    setLinkedinToast(mode === 'scheduled' ? 'scheduled' : 'published')
    linkedinToastTimerRef.current = window.setTimeout(() => {
      setLinkedinToast(null)
      linkedinToastTimerRef.current = null
    }, 5200)
  }

  useEffect(() => {
    return () => {
      if (linkedinToastTimerRef.current) clearTimeout(linkedinToastTimerRef.current)
    }
  }, [])

  /** Collect API errors from /social/post-dynamic results (Graph often returns 200 + error object). */
  const collectPostResultErrors = (results, form) => {
    const errs = []
    if (!results || typeof results !== 'object') return errs

    if (form.postToFacebook && results.facebook) {
      const fb = results.facebook
      if (fb.error) {
        const msg =
          typeof fb.error === 'object' && fb.error !== null
            ? fb.error.message || JSON.stringify(fb.error)
            : String(fb.error)
        errs.push(`Facebook: ${msg}`)
      }
    }

    if (form.postToInstagram && results.instagram) {
      const ig = results.instagram
      if (ig.error) {
        const msg =
          typeof ig.error === 'object' && ig.error !== null
            ? ig.error.message || JSON.stringify(ig.error)
            : String(ig.error)
        errs.push(`Instagram: ${msg}`)
      }
    }

    if (form.postToLinkedin) {
      const li = results.linkedin
      if (!li) {
        errs.push('LinkedIn: empty response from server')
      } else if (li.error) {
        const detail = li.details ? ` ${typeof li.details === 'string' ? li.details : JSON.stringify(li.details)}` : ''
        errs.push(`LinkedIn: ${li.error}${detail}`)
      }
    }

    return errs
  }

  const buildSuccessCopy = (response, form) => {
    const parts = []
    const r = response?.results || {}
    const when = form.postNow ? 'published' : 'scheduled'
    if (form.postToFacebook && r.facebook && !r.facebook.error) parts.push('Facebook')
    if (form.postToInstagram && r.instagram && !r.instagram.error) parts.push('Instagram')
    if (form.postToLinkedin && r.linkedin && !r.linkedin.error) parts.push('LinkedIn')
    const names = parts.join(', ')
    const suffix = response?.scheduled_for && response.scheduled_for !== 'NOW'
      ? ` · ${response.scheduled_for}`
      : ''
    return names
      ? `Post ${when} on ${names}.${suffix}`
      : `Post ${when} successfully!${suffix}`
  }

  const handlePostSubmit = async (e) => {
    e.preventDefault()
    setPostError(null)
    setPostSuccess(null)

    // Auth check BEFORE setting isPosting so the button never gets stuck
    if (!isAuthenticated || !userId) {
      setPostError('Please log in to post')
      return
    }

    // Validation
    if (!postForm.postToFacebook && !postForm.postToInstagram && !postForm.postToLinkedin) {
      setPostError('Please select at least one platform')
      return
    }

    if (!postForm.postNow && !postForm.scheduleMinutes && !postForm.scheduledDatetime) {
      setPostError('Please choose post timing: either post now or schedule')
      return
    }

    // Platform connection validation
    if (postForm.postToFacebook && !connectionStatus.facebook) {
      setPostError('Please connect your Facebook account before posting')
      return
    }
    if (postForm.postToInstagram && !connectionStatus.instagram) {
      setPostError('Please connect your Instagram account before posting')
      return
    }
    if (postForm.postToLinkedin && !connectionStatus.linkedin) {
      setPostError('Please connect your LinkedIn account before posting')
      return
    }

    setIsPosting(true)
    const formSnapshot = { ...postForm }

    try {
      // Create FormData for multipart/form-data
      const formData = new FormData()
      // user_id is now extracted from JWT token in backend, no need to send it
      formData.append('post_to_facebook', postForm.postToFacebook)
      formData.append('post_to_instagram', postForm.postToInstagram)
      formData.append('post_to_linkedin', postForm.postToLinkedin)
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
      const resultErrors = collectPostResultErrors(response?.results, formSnapshot)

      if (resultErrors.length > 0) {
        setPostError(resultErrors.join(' '))
        return
      }

      setPostSuccess(buildSuccessCopy(response, formSnapshot))

      if (formSnapshot.postToLinkedin) {
        const li = response?.results?.linkedin
        if (li && !li.error && (li.scheduled === true || li.id != null || li.ok === true)) {
          showLinkedinSuccessToast(li.scheduled === true ? 'scheduled' : 'published')
        }
      }

      handleResetForm()

      if (formSnapshot.postToFacebook || formSnapshot.postToInstagram) {
        try {
          fetchFbAnalytics(true)
          fetchInstaAnalytics(true)
        } catch (_) {
          /* ignore */
        }
      }
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
      postToLinkedin: false,
      message: '',
      image: null,
      postNow: true,
      scheduleMinutes: null,
      scheduledDatetime: '',
    })
    if (imageInputRef.current) imageInputRef.current.value = ''
    setPostError(null)
    setPostSuccess(null)
  }

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    setPostForm((prev) => ({ ...prev, image: file || null }))
  }

  const handleRemoveImage = () => {
    setPostForm((prev) => ({ ...prev, image: null }))
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  // Show loading if auth is still loading
  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="text-white text-xl mb-4">Loading...</div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="min-w-0 max-w-full">
        {/* Hero: title + compact connect cards (top-right on large screens) */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-6 sm:mb-8">
          <header className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-1 sm:mb-2 tracking-tight">
              Social media automation
            </h1>
            <p className="text-sm text-gray-400 max-w-xl">
              Publish and schedule content to your connected channels.
            </p>
          </header>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full sm:w-[min(100%,22rem)] lg:w-[24rem] lg:shrink-0 lg:ml-auto">
            <div className="min-w-0 rounded-xl border border-gray-800/80 bg-opsly-card/90 p-2.5 sm:p-3 flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                <FaFacebook className="text-xl text-blue-500 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-medium text-white truncate">Facebook</span>
        <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-1 sm:mb-2">Marketing</h1>
            <p className="text-sm sm:text-base text-gray-400">Connect Your Accounts</p>
          </div>
          <Link
            to="/campaign-ops"
            className="inline-flex items-center justify-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400"
          >
            Open Campaign Ops
          </Link>
        </div>

        {/* Connect Your Accounts Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
          {/* Facebook Card */}
          <div className="bg-opsly-card rounded-lg p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
              <FaFacebook className="text-3xl sm:text-4xl text-blue-500 flex-shrink-0" />
              <div className="min-w-0">
                <h3 className="text-lg sm:text-xl font-semibold text-white">Facebook</h3>
                <p className={`text-xs sm:text-sm ${connectionStatus.facebook ? 'text-green-400' : 'text-gray-400'}`}>
                  {connectionStatus.facebook ? 'Connected' : 'Not Connected'}
                </p>
              </div>
              <p className={`text-[11px] leading-tight mb-2.5 ${connectionStatus.facebook ? 'text-green-400' : 'text-gray-500'}`}>
                {connectionStatus.facebook ? 'Connected' : 'Not connected'}
              </p>
              <button
                type="button"
                onClick={handleConnectFacebook}
                disabled={connectionStatus.facebook}
                className="mt-auto w-full py-1.5 text-xs font-medium bg-opsly-purple text-white rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {connectionStatus.facebook ? 'Connected' : 'Connect'}
              </button>
            </div>

            <div className="min-w-0 rounded-xl border border-gray-800/80 bg-opsly-card/90 p-2.5 sm:p-3 flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                <FaInstagram
                  className="text-xl flex-shrink-0"
                  style={{
                    background: 'linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                />
                <span className="text-xs sm:text-sm font-medium text-white truncate">Instagram</span>
              </div>
              <p className={`text-[11px] leading-tight mb-2.5 ${connectionStatus.instagram ? 'text-green-400' : 'text-gray-500'}`}>
                {connectionStatus.instagram ? 'Connected' : 'Via Facebook'}
              </p>
              <button
                type="button"
                disabled={connectionStatus.instagram}
                className="mt-auto w-full py-1.5 text-xs font-medium bg-opsly-purple text-white rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {connectionStatus.instagram ? 'Connected' : 'Connect'}
              </button>
            </div>

            <div className="min-w-0 rounded-xl border border-gray-800/80 bg-opsly-card/90 p-2.5 sm:p-3 flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                <FaLinkedin className="text-xl text-[#0A66C2] flex-shrink-0" />
                <span className="text-xs sm:text-sm font-medium text-white truncate">LinkedIn</span>
              </div>
              <p className={`text-[11px] leading-tight mb-2.5 ${connectionStatus.linkedin ? 'text-green-400' : 'text-gray-500'}`}>
                {connectionStatus.linkedin ? 'Member connected' : 'Not connected'}
              </p>
              <button
                type="button"
                onClick={handleConnectLinkedin}
                disabled={connectionStatus.linkedin}
                className="mt-auto w-full py-1.5 text-xs font-medium bg-opsly-purple text-white rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {connectionStatus.linkedin ? 'Connected' : 'Connect'}
              </button>
            </div>
          </div>
        </div>

        {/* Create New Post — image left, options right */}
        <div className="bg-opsly-card rounded-xl border border-gray-800/60 p-4 sm:p-6 mb-8 sm:mb-12">
          <div className="mb-4 sm:mb-5">
            <h2 className="text-lg sm:text-xl font-semibold text-white">Create new post</h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Add media, caption, timing, and destinations</p>
          </div>

          {postError && (
            <div className="mb-4 p-3 text-sm bg-red-500/15 border border-red-500/40 rounded-xl text-red-200">{postError}</div>
          )}
          {postSuccess && (
            <div className="mb-4 p-3 text-sm bg-green-500/15 border border-green-500/40 rounded-xl text-green-200">{postSuccess}</div>
          )}

          <form onSubmit={handlePostSubmit} className="min-w-0">
            <div className="grid gap-6 md:grid-cols-2 md:gap-8">
              {/* Left: image upload + preview */}
              <div className="min-w-0 flex flex-col">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Media</span>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="sr-only"
                  id="post-image-input"
                />
                <label
                  htmlFor="post-image-input"
                  className={`group relative flex flex-col flex-1 min-h-[14rem] sm:min-h-[17rem] rounded-xl border-2 border-dashed cursor-pointer overflow-hidden transition-colors ${
                    imagePreviewUrl
                      ? 'border-gray-700 bg-opsly-dark'
                      : 'border-gray-700 bg-opsly-dark/50 hover:border-opsly-purple/50 hover:bg-opsly-dark'
                  }`}
                >
                  {imagePreviewUrl ? (
                    <>
                      <img
                        src={imagePreviewUrl}
                        alt="Preview"
                        className="absolute inset-0 w-full h-full object-contain bg-black/40"
                      />
                      <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between gap-2">
                        <span className="text-[11px] text-white/90 truncate px-1">{postForm.image?.name}</span>
                        <div className="flex gap-2 flex-shrink-0">
                          <span className="text-[11px] text-opsly-purple font-medium px-2 py-1 rounded-md bg-black/50">
                            Change
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
                      <HiPhotograph className="text-4xl text-gray-600 group-hover:text-opsly-purple/80 transition-colors mb-3" />
                      <p className="text-sm text-gray-300 font-medium">Drop or click to upload</p>
                      <p className="text-xs text-gray-500 mt-1">PNG, JPG — optional</p>
                    </div>
                  )}
                </label>
                {imagePreviewUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="mt-2 text-xs text-gray-500 hover:text-red-400 transition-colors self-start"
                  >
                    Remove image
                  </button>
                )}
              </div>

              {/* Right: platforms, caption, timing */}
              <div className="min-w-0 flex flex-col gap-5">
                <div>
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 block">Platforms</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setPostForm({ ...postForm, postToFacebook: !postForm.postToFacebook })}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                        postForm.postToFacebook
                          ? 'border-blue-500/60 bg-blue-500/15 text-white'
                          : 'border-gray-700 bg-opsly-dark text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      <FaFacebook className={`text-lg ${postForm.postToFacebook ? 'text-blue-400' : 'text-gray-500'}`} />
                      Facebook
                    </button>
                    <button
                      type="button"
                      onClick={() => setPostForm({ ...postForm, postToInstagram: !postForm.postToInstagram })}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                        postForm.postToInstagram
                          ? 'border-pink-500/60 bg-pink-500/15 text-white'
                          : 'border-gray-700 bg-opsly-dark text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      <FaInstagram className={`text-lg ${postForm.postToInstagram ? 'text-pink-400' : 'text-gray-500'}`} />
                      Instagram
                    </button>
                    <button
                      type="button"
                      onClick={() => setPostForm({ ...postForm, postToLinkedin: !postForm.postToLinkedin })}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                        postForm.postToLinkedin
                          ? 'border-[#0A66C2]/60 bg-[#0A66C2]/15 text-white'
                          : 'border-gray-700 bg-opsly-dark text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      <FaLinkedin className={`text-lg ${postForm.postToLinkedin ? 'text-[#0A66C2]' : 'text-gray-500'}`} />
                      LinkedIn
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="post-caption" className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 block">
                    Caption
                  </label>
                  <textarea
                    id="post-caption"
                    value={postForm.message}
                    onChange={(e) => setPostForm({ ...postForm, message: e.target.value })}
                    placeholder="Write a caption…"
                    rows={5}
                    className="w-full px-3 py-2.5 text-sm bg-opsly-dark text-white rounded-lg border border-gray-800 focus:outline-none focus:ring-2 focus:ring-opsly-purple/60 focus:border-transparent resize-none min-h-[7.5rem]"
                  />
                </div>

                <div>
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 block">When to post</span>
                  <div className="flex p-1 rounded-xl bg-opsly-dark border border-gray-800 w-full max-w-md">
                    <button
                      type="button"
                      onClick={() =>
                        setPostForm({
                          ...postForm,
                          postNow: true,
                          scheduleMinutes: null,
                          scheduledDatetime: '',
                        })
                      }
                      className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                        postForm.postNow ? 'bg-opsly-purple text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      Post now
                    </button>
                    <button
                      type="button"
                      onClick={() => setPostForm({ ...postForm, postNow: false })}
                      className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                        !postForm.postNow ? 'bg-opsly-purple text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <HiCalendar className="text-base opacity-90" />
                      Schedule
                    </button>
                  </div>

                  {!postForm.postNow && (
                    <div className="mt-3 space-y-3 p-3 rounded-xl bg-opsly-dark/80 border border-gray-800/80">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1.5">In minutes</label>
                        <input
                          type="number"
                          min={1}
                          placeholder="e.g. 30"
                          value={postForm.scheduleMinutes || ''}
                          onChange={(e) =>
                            setPostForm({
                              ...postForm,
                              scheduleMinutes: e.target.value ? parseInt(e.target.value, 10) : null,
                              scheduledDatetime: '',
                            })
                          }
                          className="w-full px-3 py-2 text-sm bg-opsly-dark border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-opsly-purple/50"
                        />
                      </div>
                      <p className="text-[11px] text-center text-gray-600">or pick a date & time</p>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1.5">Date & time</label>
                        <input
                          type="datetime-local"
                          value={postForm.scheduledDatetime ? postForm.scheduledDatetime.slice(0, 16) : ''}
                          onChange={(e) => {
                            const dt = e.target.value
                            const formatted = dt ? `${dt}:00` : ''
                            setPostForm({
                              ...postForm,
                              scheduledDatetime: formatted,
                              scheduleMinutes: null,
                            })
                          }}
                          className="w-full px-3 py-2 text-sm bg-opsly-dark border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-opsly-purple/50"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={
                      isPosting ||
                      (!postForm.postToFacebook && !postForm.postToInstagram && !postForm.postToLinkedin)
                    }
                    className="flex-1 px-4 py-2.5 text-sm font-medium bg-opsly-purple text-white rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                  >
                    {isPosting ? (
                      <>
                        <span className="inline-block animate-pulse">⏳</span>
                        Publishing…
                      </>
                    ) : postForm.postNow ? (
                      'Publish now'
                    ) : (
                      <>
                        <HiCalendar className="text-lg" />
                        Schedule post
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="px-4 py-2.5 text-sm font-medium bg-transparent text-gray-400 rounded-lg border border-gray-700 hover:bg-opsly-dark hover:text-gray-200 transition"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Facebook Posts — compact list */}
        <div className="mt-8 sm:mt-12">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between mb-3 sm:mb-4 pb-3 border-b border-gray-800/80">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-white tracking-tight">Facebook Posts</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {connectionStatus.facebook ? 'Connected page' : 'Connect Facebook to sync'} · {fbPosts.length} {fbPosts.length === 1 ? 'post' : 'posts'}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-800/60 bg-opsly-card/80 p-3 sm:p-4">
            {isFbLoading && (
              <p className="text-sm text-gray-400 py-4 text-center">Loading Facebook posts…</p>
            )}
            {fbError && (
              <p className="text-sm text-red-400 py-2">Failed to load posts: {fbError}</p>
            )}
            {!isFbLoading && !fbError && fbPosts.length === 0 && (
              <p className="text-sm text-gray-400 py-4 text-center">No Facebook posts found.</p>
            )}

            {!isFbLoading && !fbError && fbPosts.length > 0 && (
              <ul className="space-y-2 sm:space-y-2.5 max-h-[min(22rem,42vh)] sm:max-h-[26rem] overflow-y-auto overflow-x-hidden pr-1 -mr-1">
                {fbPosts.map((post) => (
                  <li key={post.post_id}>
                    <a
                      href={post.post_url}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex gap-3 p-2.5 sm:p-3 rounded-xl bg-opsly-dark/50 border border-gray-800/80 hover:border-blue-500/40 hover:bg-opsly-dark transition-colors min-w-0"
                    >
                      <div className="w-16 h-16 sm:w-[4.25rem] sm:h-[4.25rem] flex-shrink-0 rounded-lg overflow-hidden bg-gray-900/90 ring-1 ring-white/5">
                        {post.image_url ? (
                          <img
                            src={post.image_url}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-blue-500/35">
                            <FaFacebook className="text-2xl" aria-hidden />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 flex flex-col justify-center gap-1">
                        <time className="text-[11px] sm:text-xs text-gray-500 tabular-nums">
                          {post.created_time
                            ? new Date(post.created_time).toLocaleString(undefined, {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })
                            : 'Date unknown'}
                        </time>
                        <p className="text-sm text-gray-100 leading-snug line-clamp-2 group-hover:text-white transition-colors">
                          {post.message?.trim() || 'No caption'}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] sm:text-xs text-gray-500">
                          <span>
                            <span className="text-gray-300 tabular-nums">{post.likes ?? 0}</span> likes
                          </span>
                          <span className="text-gray-700">·</span>
                          <span>
                            <span className="text-gray-300 tabular-nums">{post.comments?.length ?? 0}</span> comments
                          </span>
                          <span className="text-gray-700">·</span>
                          <span>
                            <span className="text-gray-300 tabular-nums">{post.shares ?? 0}</span> shares
                          </span>
                        </div>
                      </div>
                      <span className="self-center text-[10px] uppercase tracking-wider text-gray-600 group-hover:text-blue-400/90 flex-shrink-0 hidden sm:inline">
                        Open
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Instagram Posts — compact list */}
        <div className="mt-8 sm:mt-12">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between mb-3 sm:mb-4 pb-3 border-b border-gray-800/80">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-white tracking-tight">Instagram Posts</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {instaPosts.length} {instaPosts.length === 1 ? 'post' : 'posts'} · tap a row to open on Instagram
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-800/60 bg-opsly-card/80 p-3 sm:p-4">
            {isInstaLoading && (
              <p className="text-sm text-gray-400 py-4 text-center">Loading Instagram posts…</p>
            )}
            {instaError && (
              <p className="text-sm text-red-400 py-2">Failed to load posts: {instaError}</p>
            )}
            {!isInstaLoading && !instaError && instaPosts.length === 0 && (
              <p className="text-sm text-gray-400 py-4 text-center">No Instagram posts found.</p>
            )}

            {!isInstaLoading && !instaError && instaPosts.length > 0 && (
              <ul className="space-y-2 sm:space-y-2.5 max-h-[min(22rem,42vh)] sm:max-h-[26rem] overflow-y-auto overflow-x-hidden pr-1 -mr-1">
                {instaPosts.map((post) => (
                  <li key={post.post_id || post.timestamp}>
                    <a
                      href={post.post_url}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex gap-3 p-2.5 sm:p-3 rounded-xl bg-opsly-dark/50 border border-gray-800/80 hover:border-pink-500/35 hover:bg-opsly-dark transition-colors min-w-0"
                    >
                      <div className="w-16 h-16 sm:w-[4.25rem] sm:h-[4.25rem] flex-shrink-0 rounded-lg overflow-hidden bg-gray-900/90 ring-1 ring-white/5">
                        {post.media_url ? (
                          <img
                            src={post.media_url}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-pink-500/35">
                            <FaInstagram className="text-2xl" aria-hidden />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 flex flex-col justify-center gap-1">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs text-gray-500">
                          <span className="text-[10px] uppercase tracking-wider text-pink-400/90 font-medium">
                            {post.media_type || 'Post'}
                          </span>
                          <span className="text-gray-700">·</span>
                          <time className="tabular-nums">
                            {post.timestamp
                              ? new Date(post.timestamp).toLocaleString(undefined, {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                })
                              : 'Date unknown'}
                          </time>
                        </div>
                        <p className="text-sm text-gray-100 leading-snug line-clamp-2 group-hover:text-white transition-colors">
                          {post.caption?.trim() || 'No caption'}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] sm:text-xs text-gray-500">
                          <span>
                            <span className="text-gray-300 tabular-nums">{post.likes ?? 0}</span> likes
                          </span>
                          <span className="text-gray-700">·</span>
                          <span>
                            <span className="text-gray-300 tabular-nums">{post.comments_count ?? 0}</span> comments
                          </span>
                          {(post.shares ?? 0) > 0 && (
                            <>
                              <span className="text-gray-700">·</span>
                              <span>
                                <span className="text-gray-300 tabular-nums">{post.shares}</span> shares
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <span className="self-center text-[10px] uppercase tracking-wider text-gray-600 group-hover:text-pink-400/90 flex-shrink-0 hidden sm:block">
                        Open
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {linkedinToast && (
        <div
          className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 flex items-center gap-3 pl-3 pr-4 py-3 rounded-xl border border-[#0A66C2]/45 bg-[#12121c]/95 shadow-xl shadow-black/50 max-w-[min(100vw-2rem,22rem)] pointer-events-none"
          role="status"
          aria-live="polite"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0A66C2]/20">
            <FaLinkedin className="text-2xl text-[#0A66C2]" aria-hidden />
          </div>
          <div className="min-w-0 text-left">
            <p className="text-sm font-semibold text-white">
              {linkedinToast === 'scheduled' ? 'LinkedIn post scheduled' : 'Posted to LinkedIn'}
            </p>
            <p className="text-xs text-gray-400 leading-snug">
              {linkedinToast === 'scheduled'
                ? 'We’ll publish it at the time you chose (server must stay running).'
                : 'Your update is on your profile.'}
            </p>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}

export default MarketingDashboard

