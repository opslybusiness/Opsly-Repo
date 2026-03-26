import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import {
  checkReplies,
  listCampaigns,
  listReplyThreads,
  updateEmailDraft,
  sendSingleEmail,
} from '../services/campaignService'

function CampaignConversations() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [campaigns, setCampaigns] = useState([])
  const [selectedCampaignId, setSelectedCampaignId] = useState(searchParams.get('campaignId') || '')
  const [threads, setThreads] = useState([])
  const [selectedThreadId, setSelectedThreadId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [composerSubject, setComposerSubject] = useState('')
  const [composerBody, setComposerBody] = useState('')

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === selectedCampaignId),
    [campaigns, selectedCampaignId],
  )

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.sent_email_id === selectedThreadId) || null,
    [threads, selectedThreadId],
  )

  const canCompose = Boolean(selectedCampaignId && selectedThread)
  const isSentThread = selectedThread?.outbound_status === 'sent'

  const handleAction = async (label, fn) => {
    setError('')
    setMessage('')
    setLoading(true)
    try {
      const data = await fn()
      setMessage(label)
      return data
    } catch (err) {
      setError(err.message || 'Action failed')
      return null
    } finally {
      setLoading(false)
    }
  }

  const loadCampaigns = async () => {
    const data = await listCampaigns()
    setCampaigns(data)
    if (!selectedCampaignId && data.length > 0) {
      setSelectedCampaignId(data[0].id)
    }
  }

  const loadThreads = async (campaignId) => {
    if (!campaignId) {
      setThreads([])
      setSelectedThreadId('')
      return
    }
    const data = await handleAction('Conversation threads updated', () => listReplyThreads(campaignId))
    if (!data) return

    setThreads(data)
    if (data.length === 0) {
      setSelectedThreadId('')
      return
    }

    const currentExists = data.some((thread) => thread.sent_email_id === selectedThreadId)
    if (!currentExists) {
      setSelectedThreadId(data[0].sent_email_id)
    }
  }

  const runReplySync = async () => {
    if (!selectedCampaignId) {
      setError('Pick a campaign first')
      return
    }
    const res = await handleAction('Reply sync completed', () => checkReplies(selectedCampaignId))
    if (res) {
      setMessage(`Reply sync completed: found ${res.replies_found || 0} new replies`)
    }
    await loadThreads(selectedCampaignId)
  }

  const sendSelectedEmail = async () => {
    if (!selectedCampaignId || !selectedThread) {
      setError('Select an email thread first')
      return
    }

    if (isSentThread) {
      setError('This thread email is already sent')
      return
    }

    const subject = (composerSubject || '').trim()
    const body = (composerBody || '').trim()
    if (!subject || !body) {
      setError('Subject and body are required before sending')
      return
    }

    const updatedDraft = await handleAction('Draft saved', () =>
      updateEmailDraft(selectedCampaignId, selectedThread.sent_email_id, { subject, body }),
    )
    if (!updatedDraft) return

    const updated = await handleAction('Email sent', () =>
      sendSingleEmail(selectedCampaignId, selectedThread.sent_email_id),
    )
    if (updated) {
      setMessage('Email sent successfully. Sync replies to fetch new responses.')
    }
    await loadThreads(selectedCampaignId)
  }

  const saveComposerDraft = async () => {
    if (!canCompose) {
      setError('Select a thread first')
      return
    }
    if (isSentThread) {
      setError('Sent emails are locked and cannot be edited')
      return
    }

    const subject = (composerSubject || '').trim()
    const body = (composerBody || '').trim()
    if (!subject || !body) {
      setError('Subject and body are required')
      return
    }

    const updated = await handleAction('Draft updated', () =>
      updateEmailDraft(selectedCampaignId, selectedThread.sent_email_id, { subject, body }),
    )
    if (!updated) return

    await loadThreads(selectedCampaignId)
  }

  useEffect(() => {
    handleAction('Loaded campaigns', loadCampaigns)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadThreads(selectedCampaignId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCampaignId])

  useEffect(() => {
    if (!selectedThread) {
      setComposerSubject('')
      setComposerBody('')
      return
    }
    setComposerSubject(selectedThread.outbound_subject || '')
    setComposerBody(selectedThread.outbound_body || '')
  }, [selectedThread])

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <section className="rounded-xl bg-opsly-card p-5 sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white sm:text-3xl">Email Conversations</h1>
              <p className="mt-1 text-sm text-gray-400">
                Open threads, edit drafts, send emails, and monitor replies in one conversation view.
              </p>
            </div>
            <button
              onClick={() => navigate('/campaign-ops')}
              className="rounded-lg border border-gray-700 bg-opsly-dark px-4 py-2 text-sm text-white hover:bg-gray-800"
            >
              Back to Campaign Ops
            </button>
          </div>

          {error && <p className="mt-4 rounded-lg border border-red-500/50 bg-red-500/20 px-3 py-2 text-sm text-red-200">{error}</p>}
          {message && <p className="mt-4 rounded-lg border border-green-500/50 bg-green-500/20 px-3 py-2 text-sm text-green-200">{message}</p>}
        </section>

        <section className="rounded-xl bg-opsly-card p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <select
              className="rounded-lg border border-gray-700 bg-opsly-dark px-3 py-2 text-sm text-white focus:border-opsly-purple focus:outline-none"
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
            >
              <option value="">Select campaign</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
              ))}
            </select>

            <button
              disabled={loading || !selectedCampaignId}
              onClick={() => loadThreads(selectedCampaignId)}
              className="rounded-lg border border-gray-700 bg-opsly-dark px-3 py-2 text-sm text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Refresh Threads
            </button>

            <button
              disabled={loading || !selectedCampaignId}
              onClick={runReplySync}
              className="rounded-lg border border-gray-700 bg-opsly-dark px-3 py-2 text-sm text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sync Replies
            </button>

            <button
              disabled={loading || !selectedThread || isSentThread}
              onClick={sendSelectedEmail}
              className="rounded-lg bg-opsly-purple px-3 py-2 text-sm font-medium text-white hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSentThread ? 'Already Sent' : 'Send From Composer'}
            </button>
          </div>

          <p className="mt-3 text-xs text-gray-400">
            Campaign: <span className="text-white">{selectedCampaign?.name || 'None selected'}</span>
          </p>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <aside className="space-y-2 lg:col-span-1">
            {threads.length === 0 && (
              <div className="rounded-xl border border-gray-700 bg-opsly-card p-4 text-sm text-gray-400">
                No email threads yet for this campaign.
              </div>
            )}
            {threads.map((thread) => {
              const active = thread.sent_email_id === selectedThreadId
              return (
                <button
                  key={thread.sent_email_id}
                  onClick={() => setSelectedThreadId(thread.sent_email_id)}
                  className={`w-full rounded-xl border p-3 text-left ${active ? 'border-opsly-purple bg-opsly-card' : 'border-gray-700 bg-opsly-dark hover:bg-gray-800/60'}`}
                >
                  <p className="truncate text-sm font-semibold text-white">{thread.prospect_name}</p>
                  <p className="truncate text-xs text-gray-400">{thread.prospect_email || 'No prospect email'}</p>
                  <p className="mt-1 truncate text-xs text-gray-200">{thread.outbound_subject}</p>
                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">{thread.outbound_status}</span>
                    <span className={thread.replies?.length > 0 ? 'text-emerald-300' : 'text-gray-400'}>
                      {thread.replies?.length || 0} replies
                    </span>
                  </div>
                </button>
              )
            })}
          </aside>

          <main className="lg:col-span-2">
            {!selectedThread && (
              <div className="rounded-xl border border-gray-700 bg-opsly-card p-5 text-sm text-gray-400">
                Select an email on the left to open the conversation.
              </div>
            )}

            {selectedThread && (
              <article className="rounded-xl border border-gray-700 bg-opsly-card p-5">
                <div className="mb-4 border-b border-gray-700 pb-3">
                  <h2 className="text-lg font-semibold text-white">{selectedThread.prospect_name}</h2>
                  <p className="text-xs text-gray-400">{selectedThread.prospect_email || 'No prospect email on record'}</p>
                  <p className="mt-1 text-xs text-gray-400">Original Subject: {selectedThread.outbound_subject}</p>
                </div>

                <div className="space-y-3">
                  <div className="ml-auto max-w-[85%] rounded-xl border border-purple-500/30 bg-purple-500/10 p-3">
                    <p className="text-[11px] text-purple-300">You</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-white">{selectedThread.outbound_body}</p>
                    <p className="mt-2 text-[11px] text-purple-300">
                      {selectedThread.outbound_status} | {selectedThread.outbound_sent_at || 'Not sent yet'}
                    </p>
                  </div>

                  {selectedThread.replies?.length === 0 && (
                    <div className="max-w-[85%] rounded-xl border border-gray-700 bg-opsly-dark p-3">
                      <p className="text-xs text-gray-300">No replies yet</p>
                    </div>
                  )}

                  {selectedThread.replies?.map((reply, index) => (
                    <div key={`${selectedThread.sent_email_id}-${index}`} className="max-w-[85%] rounded-xl border border-gray-700 bg-opsly-dark p-3">
                      <p className="text-[11px] text-gray-400">{reply.from_email || 'Unknown sender'}</p>
                      <p className="mt-1 text-xs font-semibold text-white">{reply.subject || '(no subject)'}</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-gray-200">{reply.snippet || '(empty reply snippet)'}</p>
                      <p className="mt-2 text-[11px] text-gray-400">{reply.received_at || 'Unknown time'}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 border-t border-gray-700 pt-4">
                  <h3 className="text-sm font-semibold text-white">Conversation Composer</h3>
                  <p className="mt-1 text-xs text-gray-400">
                    Edit this thread's draft and send directly from here.
                  </p>
                  {isSentThread && (
                    <p className="mt-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
                      This email has already been sent. Sent messages are locked.
                    </p>
                  )}
                  <div className="mt-3 space-y-3">
                    <input
                      value={composerSubject}
                      onChange={(e) => setComposerSubject(e.target.value)}
                      disabled={isSentThread || loading}
                      className="w-full rounded-lg border border-gray-700 bg-opsly-dark px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-opsly-purple focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                      placeholder="Email subject"
                    />
                    <textarea
                      value={composerBody}
                      onChange={(e) => setComposerBody(e.target.value)}
                      disabled={isSentThread || loading}
                      className="min-h-[150px] w-full rounded-lg border border-gray-700 bg-opsly-dark px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-opsly-purple focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                      placeholder="Write your email message..."
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={saveComposerDraft}
                        disabled={loading || isSentThread}
                        className="rounded-lg border border-gray-700 bg-opsly-dark px-3 py-2 text-sm text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Save Draft
                      </button>
                      <button
                        onClick={sendSelectedEmail}
                        disabled={loading || isSentThread}
                        className="rounded-lg bg-opsly-purple px-3 py-2 text-sm font-medium text-white hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Send Email
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            )}
          </main>
        </section>
      </div>
    </DashboardLayout>
  )
}

export default CampaignConversations
