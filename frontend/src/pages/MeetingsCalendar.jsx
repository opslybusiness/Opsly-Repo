import { useEffect, useMemo, useState } from 'react'
import { FaGoogle, FaVideo } from 'react-icons/fa'
import { HiCalendar, HiClock } from 'react-icons/hi'
import DashboardLayout from '../components/DashboardLayout'
import { getApiUrl } from '../config/api'
import { getConnectionStatus } from '../services/marketingService'
import { apiClient } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

function toLocalDateTimeInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function toDateOnly(date) {
  return toLocalDateTimeInputValue(date).slice(0, 10)
}

function formatFriendly(dateString) {
  try {
    return new Date(dateString).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return dateString
  }
}

function MeetingsCalendar() {
  const { userId, isAuthenticated, loading: authLoading } = useAuth()
  const [isGoogleConnected, setIsGoogleConnected] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [loadingCalendar, setLoadingCalendar] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  const [events, setEvents] = useState([])
  const [slots, setSlots] = useState([])
  const [selectedDate, setSelectedDate] = useState(toDateOnly(new Date()))

  const defaultStart = useMemo(() => {
    const d = new Date()
    d.setMinutes(0, 0, 0)
    d.setHours(d.getHours() + 1)
    return d
  }, [])

  const defaultEnd = useMemo(() => {
    const d = new Date(defaultStart)
    d.setMinutes(d.getMinutes() + 30)
    return d
  }, [defaultStart])

  const [form, setForm] = useState({
    summary: '',
    description: '',
    attendeeEmail: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    startLocal: toLocalDateTimeInputValue(defaultStart),
    endLocal: toLocalDateTimeInputValue(defaultEnd),
  })

  const selectedStartIso = useMemo(() => {
    const d = new Date(`${selectedDate}T00:00:00`)
    return d.toISOString()
  }, [selectedDate])

  const selectedEndIso = useMemo(() => {
    const d = new Date(`${selectedDate}T00:00:00`)
    d.setDate(d.getDate() + 1)
    return d.toISOString()
  }, [selectedDate])

  useEffect(() => {
    const fetchStatus = async () => {
      if (!isAuthenticated || !userId) return
      setLoadingStatus(true)
      try {
        const status = await getConnectionStatus()
        setIsGoogleConnected(Boolean(status.google))
      } catch (e) {
        console.error('Failed to fetch connection status', e)
      } finally {
        setLoadingStatus(false)
      }
    }

    if (!authLoading) {
      fetchStatus()
    }
  }, [authLoading, isAuthenticated, userId])

  const handleConnectGoogle = () => {
    const url = userId
      ? getApiUrl(`/auth/google/login?user_id=${userId}`)
      : getApiUrl('/auth/google/login')
    window.location.href = url
  }

  const loadCalendarData = async (dateValue = selectedDate, timezoneValue = form.timezone) => {
    if (!isGoogleConnected) {
      setEvents([])
      setSlots([])
      return
    }

    setLoadingCalendar(true)
    try {
      const dayStart = new Date(`${dateValue}T00:00:00`)
      const dayEnd = new Date(`${dateValue}T00:00:00`)
      dayEnd.setDate(dayEnd.getDate() + 1)

      const [eventsRes, slotsRes] = await Promise.all([
        apiClient(`/meetings/google/events?start=${encodeURIComponent(dayStart.toISOString())}&end=${encodeURIComponent(dayEnd.toISOString())}&timezone=${encodeURIComponent(timezoneValue)}`),
        apiClient(`/meetings/google/slots?date=${encodeURIComponent(dateValue)}&timezone=${encodeURIComponent(timezoneValue)}&slot_minutes=30&workday_start_hour=9&workday_end_hour=18`),
      ])
      setEvents(eventsRes.events || [])
      setSlots(slotsRes.slots || [])
    } catch (e) {
      console.error('Failed to load calendar data', e)
      setEvents([])
      setSlots([])
    } finally {
      setLoadingCalendar(false)
    }
  }

  useEffect(() => {
    if (!isGoogleConnected) return
    loadCalendarData(selectedDate, form.timezone)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGoogleConnected, selectedDate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess(null)

    if (!form.summary.trim()) {
      setError('Meeting title is required.')
      return
    }

    const startDate = new Date(form.startLocal)
    const endDate = new Date(form.endLocal)
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      setError('Please provide valid start and end time.')
      return
    }
    if (endDate <= startDate) {
      setError('End time must be after start time.')
      return
    }

    setSubmitting(true)
    try {
      const attendees = form.attendeeEmail.trim() ? [form.attendeeEmail.trim()] : []
      const payload = {
        summary: form.summary.trim(),
        description: form.description.trim(),
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        attendees,
        timezone: form.timezone || 'UTC',
      }

      const response = await apiClient('/meetings/google', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      setSuccess(response)
      setForm((prev) => ({
        ...prev,
        summary: '',
        description: '',
        attendeeEmail: '',
      }))
      await loadCalendarData(selectedDate, form.timezone)
    } catch (err) {
      setError(err.message || 'Failed to create meeting.')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || loadingStatus) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-white text-lg">Loading meeting scheduler...</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="min-w-0 max-w-full">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-7">
          <header className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 tracking-tight">
              Meetings & Calendar
            </h1>
            <p className="text-sm text-gray-400 max-w-2xl">
              Connect Google and create meetings with a Google Meet link in one click.
            </p>
          </header>

          <div className="w-full sm:w-[min(100%,24rem)] lg:w-[25rem] bg-opsly-card rounded-xl border border-gray-800/70 p-4">
            <div className="flex items-center gap-3 mb-3">
              <FaGoogle className="text-xl text-[#4285F4]" />
              <div>
                <p className="text-sm font-semibold text-white">Google Calendar</p>
                <p className={`text-xs ${isGoogleConnected ? 'text-green-400' : 'text-gray-500'}`}>
                  {isGoogleConnected ? 'Connected' : 'Not connected'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleConnectGoogle}
              disabled={isGoogleConnected}
              className="w-full py-2.5 text-sm font-medium bg-opsly-purple text-white rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGoogleConnected ? 'Google Connected' : 'Connect Google'}
            </button>
          </div>
        </div>

        <div className="bg-opsly-card rounded-xl border border-gray-800/70 p-4 sm:p-6">
          <div className="mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-white">Create Meeting</h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Creates a Calendar event and auto-generates a Google Meet URL.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 text-sm bg-red-500/15 border border-red-500/40 rounded-xl text-red-200">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 text-sm bg-green-500/15 border border-green-500/40 rounded-xl text-green-200 space-y-1">
              <p className="font-medium">Meeting created successfully.</p>
              {success.meetLink && (
                <p>
                  Meet link:{' '}
                  <a href={success.meetLink} target="_blank" rel="noreferrer" className="text-green-300 underline">
                    Open Google Meet
                  </a>
                </p>
              )}
              {success.eventLink && (
                <p>
                  Calendar event:{' '}
                  <a href={success.eventLink} target="_blank" rel="noreferrer" className="text-green-300 underline">
                    Open Event
                  </a>
                </p>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                Meeting title
              </label>
              <input
                type="text"
                value={form.summary}
                onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))}
                placeholder="e.g. Client Discovery Call"
                className="w-full px-3 py-2.5 text-sm bg-opsly-dark text-white rounded-lg border border-gray-800 focus:outline-none focus:ring-2 focus:ring-opsly-purple/60"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                Description
              </label>
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Agenda, notes, context..."
                className="w-full px-3 py-2.5 text-sm bg-opsly-dark text-white rounded-lg border border-gray-800 focus:outline-none focus:ring-2 focus:ring-opsly-purple/60 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                <span className="inline-flex items-center gap-1">
                  <HiClock /> Start time
                </span>
              </label>
              <input
                type="datetime-local"
                value={form.startLocal}
                onChange={(e) => setForm((prev) => ({ ...prev, startLocal: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm bg-opsly-dark text-white rounded-lg border border-gray-800 focus:outline-none focus:ring-2 focus:ring-opsly-purple/60"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                <span className="inline-flex items-center gap-1">
                  <HiCalendar /> End time
                </span>
              </label>
              <input
                type="datetime-local"
                value={form.endLocal}
                onChange={(e) => setForm((prev) => ({ ...prev, endLocal: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm bg-opsly-dark text-white rounded-lg border border-gray-800 focus:outline-none focus:ring-2 focus:ring-opsly-purple/60"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                Attendee email (optional)
              </label>
              <input
                type="email"
                value={form.attendeeEmail}
                onChange={(e) => setForm((prev) => ({ ...prev, attendeeEmail: e.target.value }))}
                placeholder="client@example.com"
                className="w-full px-3 py-2.5 text-sm bg-opsly-dark text-white rounded-lg border border-gray-800 focus:outline-none focus:ring-2 focus:ring-opsly-purple/60"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                Timezone
              </label>
              <input
                type="text"
                value={form.timezone}
                onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value }))}
                placeholder="Asia/Karachi"
                className="w-full px-3 py-2.5 text-sm bg-opsly-dark text-white rounded-lg border border-gray-800 focus:outline-none focus:ring-2 focus:ring-opsly-purple/60"
              />
            </div>

            <div className="md:col-span-2 flex flex-col sm:flex-row gap-3 pt-1">
              <button
                type="submit"
                disabled={submitting || !isGoogleConnected}
                className="px-4 py-2.5 text-sm font-medium bg-opsly-purple text-white rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                <FaVideo />
                {submitting ? 'Creating meeting...' : 'Create meeting'}
              </button>
              {!isGoogleConnected && (
                <p className="text-xs text-gray-500 self-center">
                  Connect Google first to enable meeting creation.
                </p>
              )}
            </div>
          </form>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-6">
          <div className="bg-opsly-card rounded-xl border border-gray-800/70 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Calendar Day View</h3>
                <p className="text-xs text-gray-500">View scheduled and available slots for selected date.</p>
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 text-sm bg-opsly-dark text-white rounded-lg border border-gray-800 focus:outline-none focus:ring-2 focus:ring-opsly-purple/60"
              />
            </div>
            <div className="text-xs text-gray-500 mb-3">
              Range: {formatFriendly(selectedStartIso)} - {formatFriendly(selectedEndIso)}
            </div>
            {loadingCalendar ? (
              <p className="text-sm text-gray-400">Loading calendar...</p>
            ) : (
              <div className="space-y-2 max-h-[24rem] overflow-y-auto pr-1">
                {events.length === 0 ? (
                  <p className="text-sm text-gray-400">No scheduled events for this date.</p>
                ) : (
                  events.map((event) => (
                    <div key={event.id} className="rounded-lg border border-gray-800 bg-opsly-dark p-3">
                      <p className="text-sm font-medium text-white">{event.summary || 'Busy'}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatFriendly(event.start)} - {formatFriendly(event.end)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs">
                        {event.meet_link && (
                          <a href={event.meet_link} target="_blank" rel="noreferrer" className="text-opsly-purple underline">
                            Meet
                          </a>
                        )}
                        {event.html_link && (
                          <a href={event.html_link} target="_blank" rel="noreferrer" className="text-gray-300 underline">
                            Calendar
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="bg-opsly-card rounded-xl border border-gray-800/70 p-4 sm:p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white">Available Slots</h3>
              <p className="text-xs text-gray-500">Click an available slot to pre-fill meeting time.</p>
            </div>
            {loadingCalendar ? (
              <p className="text-sm text-gray-400">Loading slots...</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[24rem] overflow-y-auto pr-1">
                {slots.length === 0 && <p className="text-sm text-gray-400">No slots found.</p>}
                {slots.map((slot) => {
                  const available = slot.status === 'available'
                  return (
                    <button
                      key={`${slot.start}-${slot.end}`}
                      type="button"
                      disabled={!available}
                      onClick={() => {
                        const start = new Date(slot.start)
                        const end = new Date(slot.end)
                        setForm((prev) => ({
                          ...prev,
                          startLocal: toLocalDateTimeInputValue(start),
                          endLocal: toLocalDateTimeInputValue(end),
                        }))
                      }}
                      className={`text-left rounded-lg border p-2.5 transition ${
                        available
                          ? 'border-green-700/70 bg-green-900/20 hover:border-green-500'
                          : 'border-red-800/60 bg-red-900/15 cursor-not-allowed'
                      }`}
                    >
                      <p className={`text-xs font-medium ${available ? 'text-green-300' : 'text-red-300'}`}>
                        {available ? 'Available' : 'Scheduled'}
                      </p>
                      <p className="text-xs text-gray-300 mt-1">
                        {formatFriendly(slot.start)} - {new Date(slot.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default MeetingsCalendar
