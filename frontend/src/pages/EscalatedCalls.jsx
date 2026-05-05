import { useEffect, useState } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { getEscalatedCalls } from '../services/voiceBotService'
import {
  HiExclamation,
  HiRefresh,
  HiChat,
  HiPlay,
  HiClock,
  HiCheckCircle,
  HiPhone,
} from 'react-icons/hi'
import { FiGlobe, FiPhone } from 'react-icons/fi'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function durationLabel(secs) {
  if (secs == null) return null
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}

const RESOLVED_KEY = 'opsly_resolved_calls'

function getResolved() {
  try { return new Set(JSON.parse(localStorage.getItem(RESOLVED_KEY) || '[]')) }
  catch { return new Set() }
}

function saveResolved(set) {
  localStorage.setItem(RESOLVED_KEY, JSON.stringify([...set]))
}

// ── Single escalated call card ────────────────────────────────────────────────

function EscalatedCard({ call, resolved, onResolve }) {
  const [showTranscript, setShowTranscript] = useState(false)
  const isPhone = call.type?.toLowerCase().includes('phone')

  return (
    <div className={`rounded-xl border p-4 sm:p-5 transition-all ${
      resolved
        ? 'border-green-700/40 bg-green-900/10 opacity-60'
        : 'border-red-700/40 bg-red-900/10'
    }`}>
      {/* ── Top row ── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          {/* Type icon */}
          <div className={`mt-0.5 flex-shrink-0 p-2 rounded-lg ${
            resolved ? 'bg-green-800/30' : 'bg-red-800/30'
          }`}>
            {isPhone
              ? <FiPhone className="text-base text-red-400" />
              : <FiGlobe className="text-base text-red-400" />}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-white">{call.type || 'Call'}</span>
              {resolved
                ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-700/50 text-green-300 font-medium">Resolved</span>
                : <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-700/50 text-red-300 font-medium">Needs Attention</span>
              }
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
              <span className="text-xs text-gray-400">{formatDateTime(call.createdAt)}</span>
              {durationLabel(call.duration) && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <HiClock className="text-[11px]" />{durationLabel(call.duration)}
                </span>
              )}
              {call.endedReason && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">
                  {call.endedReason}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          {call.transcript && (
            <button
              onClick={() => setShowTranscript(v => !v)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white text-xs transition"
            >
              <HiChat className="text-xs" />
              {showTranscript ? 'Hide' : 'Transcript'}
            </button>
          )}
          {call.recordingUrl && (
            <a
              href={call.recordingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-opsly-purple hover:bg-purple-700 text-white text-xs transition"
            >
              <HiPlay className="text-xs" />
              Play
            </a>
          )}
          {!resolved && (
            <button
              onClick={() => onResolve(call.id)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-white text-xs transition"
            >
              <HiCheckCircle className="text-xs" />
              Mark Resolved
            </button>
          )}
        </div>
      </div>

      {/* ── AI Summary ── */}
      {call.summary && (
        <div className="mt-3 p-3 rounded-lg bg-gray-800/60 border border-gray-700">
          <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium mb-1">AI Summary</p>
          <p className="text-xs sm:text-sm text-gray-200 leading-relaxed">{call.summary}</p>
        </div>
      )}

      {/* ── Transcript (expandable) ── */}
      {showTranscript && call.transcript && (
        <div className="mt-3 p-3 rounded-lg bg-gray-900/60 border border-gray-700">
          <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium mb-1">Transcript</p>
          <pre className="text-[11px] sm:text-xs text-gray-300 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
            {call.transcript}
          </pre>
        </div>
      )}
    </div>
  )
}

// ── Module-level cache ────────────────────────────────────────────────────────
const CACHE_TTL = 2 * 60 * 1000
let _cachedCalls = null
let _cachedAt    = 0
const cacheValid = () => _cachedCalls !== null && Date.now() - _cachedAt < CACHE_TTL

// ── Page ─────────────────────────────────────────────────────────────────────

export default function EscalatedCalls() {
  const [calls, setCalls]       = useState([])
  const [loading, setLoading]   = useState(!cacheValid())
  const [error, setError]       = useState(null)
  const [resolved, setResolved] = useState(getResolved)
  const [filter, setFilter]     = useState('pending') // 'all' | 'pending' | 'resolved'

  const load = async (force = false) => {
    if (!force && cacheValid()) {
      setCalls(_cachedCalls)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await getEscalatedCalls()
      _cachedCalls = data.escalated_calls || []
      _cachedAt    = Date.now()
      setCalls(_cachedCalls)
    } catch (err) {
      setError(err.message || 'Failed to load escalated calls.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (cacheValid()) {
      setCalls(_cachedCalls)   // instant — no spinner
    } else {
      load()
    }
  }, [])

  const handleResolve = (id) => {
    setResolved(prev => {
      const next = new Set(prev)
      next.add(id)
      saveResolved(next)
      return next
    })
  }

  const pending  = calls.filter(c => !resolved.has(c.id))
  const resolvedCalls = calls.filter(c => resolved.has(c.id))
  const displayed = filter === 'pending'  ? pending
                  : filter === 'resolved' ? resolvedCalls
                  : calls

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-4xl mx-auto">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-red-900/30 border border-red-700/40">
                <HiExclamation className="text-xl text-red-400" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">Escalated Calls</h1>
            </div>
            <p className="text-sm text-gray-400 mt-1 ml-11">
              Calls where the AI couldn't fully resolve the query — requires human follow-up
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition disabled:opacity-60 flex-shrink-0"
          >
            <HiRefresh className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* ── Stats cards ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Escalated', value: calls.length, color: 'text-red-400' },
            { label: 'Pending',         value: pending.length, color: 'text-yellow-400' },
            { label: 'Resolved',        value: resolvedCalls.length, color: 'text-green-400' },
          ].map(s => (
            <div key={s.label} className="bg-opsly-card rounded-xl p-4 border border-gray-700/50 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Filter tabs ── */}
        <div className="flex gap-2">
          {[['all','All'],['pending','Pending'],['resolved','Resolved']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
                filter === val
                  ? 'bg-opsly-purple text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── List ── */}
        {loading ? (
          <div className="flex justify-center items-center py-16">
            <div className="flex gap-2">
              {[0,150,300].map(d => (
                <div key={d} className="w-2.5 h-2.5 bg-red-500 rounded-full animate-bounce"
                  style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-6 text-center">
            <HiExclamation className="text-3xl text-red-400 mx-auto mb-2" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        ) : displayed.length === 0 ? (
          <div className="bg-opsly-card rounded-xl p-10 text-center border border-gray-700/50">
            {filter === 'pending' ? (
              <>
                <HiCheckCircle className="text-5xl text-green-500 mx-auto mb-3" />
                <p className="text-white font-semibold text-lg">All caught up!</p>
                <p className="text-gray-400 text-sm mt-1">No pending escalations. Great work.</p>
              </>
            ) : (
              <>
                <HiPhone className="text-5xl text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">
                  {filter === 'resolved'
                    ? 'No resolved calls yet.'
                    : 'No escalated calls found. Calls where the AI failed to resolve the query will appear here.'}
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map(call => (
              <EscalatedCard
                key={call.id}
                call={call}
                resolved={resolved.has(call.id)}
                onResolve={handleResolve}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
