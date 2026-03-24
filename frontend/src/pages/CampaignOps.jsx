import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import {
  checkReplies,
  createCampaign,
  createProfile,
  discoverProspects,
  generateEmails,
  getAnalytics,
  importManualProspects,
  listCampaigns,
  listProfiles,
  sendEmails,
  listProspects,
  listEmails,
  updateEmailDraft,
} from '../services/campaignService'

const initialProfile = {
  name: '',
  type: '',
  area_of_work: '',
  location: '',
  website: '',
  description: '',
  contact_email: '',
  contact_name: '',
}

const initialCampaign = {
  name: '',
  target_industry: '',
  target_location: '',
  target_keywords: '',
}

const profileFields = [
  { key: 'name', label: 'Business Name', placeholder: 'Acme Marketing' },
  { key: 'type', label: 'Business Type', placeholder: 'Agency, SaaS, Retail...' },
  { key: 'area_of_work', label: 'Area of Work', placeholder: 'Digital marketing services' },
  { key: 'location', label: 'Location', placeholder: 'Karachi, Pakistan' },
  { key: 'website', label: 'Website', placeholder: 'https://yourbusiness.com' },
  { key: 'description', label: 'Description', placeholder: 'Short business description' },
  { key: 'contact_email', label: 'Contact Email', placeholder: 'hello@yourbusiness.com' },
  { key: 'contact_name', label: 'Contact Name', placeholder: 'Rohan Khan' },
]

const campaignFields = [
  { key: 'name', label: 'Campaign Name', placeholder: 'Q2 Lead Outreach' },
  { key: 'target_industry', label: 'Target Industry', placeholder: 'E-commerce' },
  { key: 'target_location', label: 'Target Location', placeholder: 'Pakistan' },
  { key: 'target_keywords', label: 'Target Keywords', placeholder: 'online store, growth marketing' },
]

function CampaignOps() {
  const navigate = useNavigate()
  const manualCsvFileInputRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [profiles, setProfiles] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [selectedCampaignId, setSelectedCampaignId] = useState('')

  const [profileForm, setProfileForm] = useState(initialProfile)
  const [campaignForm, setCampaignForm] = useState(initialCampaign)

  const [prospects, setProspects] = useState([])
  const [drafts, setDrafts] = useState([])
  const [editingDraftId, setEditingDraftId] = useState('')
  const [draftEditor, setDraftEditor] = useState({ subject: '', body: '' })
  const [analytics, setAnalytics] = useState(null)
  const [manualCsv, setManualCsv] = useState('business_name,email,website,location,description\n')

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === selectedCampaignId),
    [campaigns, selectedCampaignId],
  )

  const hasCampaignSelected = Boolean(selectedCampaignId)

  const handleAction = async (label, fn) => {
    setError('')
    setMessage('')
    setLoading(true)
    try {
      const result = await fn()
      setMessage(label)
      return result
    } catch (err) {
      setError(err.message || 'Action failed')
      return null
    } finally {
      setLoading(false)
    }
  }

  const refreshCore = async () => {
    const [profileData, campaignData] = await Promise.all([listProfiles(), listCampaigns()])
    setProfiles(profileData)
    setCampaigns(campaignData)
    if (!selectedCampaignId && campaignData.length > 0) {
      setSelectedCampaignId(campaignData[0].id)
    }
  }

  useEffect(() => {
    handleAction('Loaded campaign workspace', refreshCore)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load prospects and drafts when campaign is selected
  useEffect(() => {
    if (!selectedCampaignId) {
      setProspects([])
      setDrafts([])
      setAnalytics(null)
      return
    }
    
    const loadData = async () => {
      try {
        const [prospectData, emailData] = await Promise.all([
          listProspects(selectedCampaignId).catch(() => []),
          listEmails(selectedCampaignId).catch(() => []),
        ])
        setProspects(prospectData || [])
        setDrafts(emailData || [])
      } catch (err) {
        console.error('Failed to load campaign data:', err)
      }
    }
    
    loadData()
  }, [selectedCampaignId])

  const runAnalytics = async () => {
    if (!selectedCampaignId) {
      setError('Pick a campaign first')
      return
    }
    const data = await handleAction('Analytics updated', () => getAnalytics(selectedCampaignId))
    if (data) setAnalytics(data)
  }

  const runDiscovery = async () => {
    if (!selectedCampaignId) {
      setError('Pick a campaign first')
      return
    }
    const data = await handleAction('Discovery completed', () => discoverProspects(selectedCampaignId, 20))
    if (data) setProspects(data)
    await runAnalytics()
  }

  const runManualImport = async (csvOverride) => {
    if (!selectedCampaignId) {
      setError('Pick a campaign first')
      return
    }
    const csvToImport = typeof csvOverride === 'string' ? csvOverride : manualCsv
    const lines = csvToImport
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    if (lines.length < 2) {
      setError('Paste CSV header + at least one prospect row before importing')
      return
    }

    const data = await handleAction('Manual prospects imported', () => importManualProspects(selectedCampaignId, csvToImport))
    if (data) {
      const created = Number(data.created || 0)
      const skipped = Number(data.skipped || 0)
      setMessage(`Manual import finished: created ${created}, skipped ${skipped}`)
      const updatedProspects = await listProspects(selectedCampaignId).catch(() => null)
      if (updatedProspects) setProspects(updatedProspects)
    }
    await runAnalytics()
  }

  const openManualImportPicker = () => {
    if (!selectedCampaignId) {
      setError('Pick a campaign first')
      return
    }
    manualCsvFileInputRef.current?.click()
  }

  const onManualCsvFileSelected = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const csvText = await file.text()
    setManualCsv(csvText)
    await runManualImport(csvText)

    // Reset input so the same file can be selected again.
    event.target.value = ''
  }

  const runGenerate = async () => {
    if (!selectedCampaignId) {
      setError('Pick a campaign first')
      return
    }
    const data = await handleAction('Draft generation completed', () => generateEmails(selectedCampaignId))
    if (data) setDrafts(data)
    await runAnalytics()
  }

  const startDraftEdit = (draft) => {
    if (!draft) return
    setEditingDraftId(draft.id)
    setDraftEditor({
      subject: draft.subject || '',
      body: draft.body || '',
    })
  }

  const cancelDraftEdit = () => {
    setEditingDraftId('')
    setDraftEditor({ subject: '', body: '' })
  }

  const saveDraftEdit = async (draft) => {
    if (!selectedCampaignId || !draft?.id) return
    const subject = (draftEditor.subject || '').trim()
    const body = (draftEditor.body || '').trim()
    if (!subject || !body) {
      setError('Draft subject and body are required')
      return
    }

    const updated = await handleAction('Draft updated', () =>
      updateEmailDraft(selectedCampaignId, draft.id, { subject, body }),
    )
    if (!updated) return

    setDrafts((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
    cancelDraftEdit()
  }

  const runSend = async () => {
    if (!selectedCampaignId) {
      setError('Pick a campaign first')
      return
    }
    await handleAction('Send batch completed', () => sendEmails(selectedCampaignId))
    await runAnalytics()
  }

  const runReplies = async () => {
    if (!selectedCampaignId) {
      setError('Pick a campaign first')
      return
    }
    await handleAction('Reply check completed', () => checkReplies(selectedCampaignId))
    await runAnalytics()
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="rounded-xl bg-opsly-card p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white sm:text-3xl">Campaign Operations</h1>
              <p className="mt-1 text-sm text-gray-400">
                Create a profile, launch a campaign, generate emails, and track replies in one flow.
              </p>
            </div>
            <button
              disabled={!hasCampaignSelected}
              onClick={() => navigate(`/campaign-ops/conversations?campaignId=${selectedCampaignId}`)}
              className="rounded-lg bg-opsly-purple px-4 py-2 text-sm font-semibold text-white hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Open Conversations
            </button>
          </div>

          {error && <p className="mt-4 rounded-lg border border-red-500/50 bg-red-500/20 px-3 py-2 text-sm text-red-200">{error}</p>}
          {message && <p className="mt-4 rounded-lg border border-green-500/50 bg-green-500/20 px-3 py-2 text-sm text-green-200">{message}</p>}

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Metric label="Prospects" value={prospects.length} />
            <Metric label="Draft Emails" value={drafts.length} />
            <Metric label="Selected Campaign" value={selectedCampaign?.name || 'None'} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <section className="rounded-xl bg-opsly-card p-5">
            <h2 className="text-lg font-semibold text-white">Step 1: Create Business Profile</h2>
            <p className="mt-1 text-sm text-gray-400">Add sender details used for campaign identity and email metadata.</p>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {profileFields.map((field) => (
                <label key={field.key} className="block">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400">{field.label}</span>
                  <input
                    className="w-full rounded-lg border border-gray-700 bg-opsly-dark px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-opsly-purple focus:outline-none"
                    placeholder={field.placeholder}
                    value={profileForm[field.key]}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
            <button
              disabled={loading}
              onClick={() => handleAction('Profile created', async () => {
                await createProfile(profileForm)
                setProfileForm(initialProfile)
                await refreshCore()
              })}
              className="mt-4 rounded-lg bg-opsly-purple px-4 py-2 text-sm font-semibold text-white hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Saving...' : 'Save Profile'}
            </button>
          </section>

          <section className="rounded-xl bg-opsly-card p-5">
            <h2 className="text-lg font-semibold text-white">Step 2: Create Campaign</h2>
            <p className="mt-1 text-sm text-gray-400">Select a profile and define your campaign target criteria.</p>
            <label className="mt-4 block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400">Business Profile</span>
              <select
                className="w-full rounded-lg border border-gray-700 bg-opsly-dark px-3 py-2 text-sm text-white focus:border-opsly-purple focus:outline-none"
                value={campaignForm.business_profile_id || ''}
                onChange={(e) => setCampaignForm((prev) => ({ ...prev, business_profile_id: e.target.value }))}
              >
                <option value="">Select profile</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <div className="mt-3 grid grid-cols-1 gap-3">
              {campaignFields.map((field) => (
                <label key={field.key} className="block">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400">{field.label}</span>
                  <input
                    className="w-full rounded-lg border border-gray-700 bg-opsly-dark px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-opsly-purple focus:outline-none"
                    placeholder={field.placeholder}
                    value={campaignForm[field.key]}
                    onChange={(e) => setCampaignForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
            <button
              disabled={loading}
              onClick={() => handleAction('Campaign created', async () => {
                await createCampaign(campaignForm)
                setCampaignForm(initialCampaign)
                await refreshCore()
              })}
              className="mt-4 rounded-lg bg-opsly-purple px-4 py-2 text-sm font-semibold text-white hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Saving...' : 'Save Campaign'}
            </button>
          </section>
        </div>

        <section className="rounded-xl bg-opsly-card p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Steps 3-7: Run Campaign Pipeline</h2>
              <p className="mt-1 text-sm text-gray-400">Choose a campaign, then run actions in order for best results.</p>
            </div>
            <select
              className="rounded-lg border border-gray-700 bg-opsly-dark px-3 py-2 text-sm text-white focus:border-opsly-purple focus:outline-none"
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
            >
              <option value="">Select campaign</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-6">
            <button
              onClick={runDiscovery}
              disabled={loading || !hasCampaignSelected}
              className="rounded-lg bg-opsly-purple px-3 py-2 text-sm font-medium text-white hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Discover
            </button>
            <button
              onClick={openManualImportPicker}
              disabled={loading || !hasCampaignSelected}
              className="rounded-lg border border-gray-700 bg-opsly-dark px-3 py-2 text-sm text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Import CSV
            </button>
            <button
              onClick={runGenerate}
              disabled={loading || !hasCampaignSelected}
              className="rounded-lg border border-gray-700 bg-opsly-dark px-3 py-2 text-sm text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Generate
            </button>
            <button
              onClick={runSend}
              disabled={loading || !hasCampaignSelected}
              className="rounded-lg border border-gray-700 bg-opsly-dark px-3 py-2 text-sm text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
            </button>
            <button
              onClick={runReplies}
              disabled={loading || !hasCampaignSelected}
              className="rounded-lg border border-gray-700 bg-opsly-dark px-3 py-2 text-sm text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Check Replies
            </button>
            <button
              onClick={runAnalytics}
              disabled={loading || !hasCampaignSelected}
              className="rounded-lg border border-gray-700 bg-opsly-dark px-3 py-2 text-sm text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Analytics
            </button>
          </div>

          <input
            ref={manualCsvFileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={onManualCsvFileSelected}
            className="hidden"
          />

          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400">Manual CSV (optional)</label>
            <textarea
              className="min-h-[120px] w-full rounded-lg border border-gray-700 bg-opsly-dark p-3 text-xs text-gray-200 placeholder:text-gray-500 focus:border-opsly-purple focus:outline-none"
              value={manualCsv}
              onChange={(e) => setManualCsv(e.target.value)}
              placeholder="Paste CSV with header: business_name,email,website,location,description"
            />
          </div>
        </section>

        {prospects.length > 0 && (
          <section className="rounded-xl bg-opsly-card p-5">
            <h2 className="mb-4 text-lg font-semibold text-white">Prospects ({prospects.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="px-3 py-2 text-left text-gray-400">Business Name</th>
                    <th className="px-3 py-2 text-left text-gray-400">Email</th>
                    <th className="px-3 py-2 text-left text-gray-400">Website</th>
                    <th className="px-3 py-2 text-left text-gray-400">Location</th>
                    <th className="px-3 py-2 text-left text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {prospects.map((p) => (
                    <tr key={p.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="px-3 py-2 text-white">{p.business_name}</td>
                      <td className="px-3 py-2 text-gray-300">{p.email || '—'}</td>
                      <td className="truncate px-3 py-2 text-gray-300">{p.website || '—'}</td>
                      <td className="px-3 py-2 text-gray-300">{p.location || '—'}</td>
                      <td className="px-3 py-2">
                        <span className="rounded border border-gray-700 bg-opsly-dark px-2 py-1 text-xs text-gray-200">{p.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {drafts.length > 0 && (
          <section className="rounded-xl bg-opsly-card p-5">
            <h2 className="mb-4 text-lg font-semibold text-white">Email Drafts ({drafts.length})</h2>
            <div className="grid grid-cols-1 gap-3">
              {drafts.map((d) => (
                <div key={d.id} className="rounded-lg border border-gray-700 bg-opsly-dark p-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <p className="font-semibold text-white text-sm">{d.prospect_id || 'Unknown'}</p>
                    <span className={`rounded px-2 py-1 text-xs ${d.status === 'sent' ? 'bg-green-500/20 text-green-300' : d.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-gray-700 text-gray-300'}`}>
                      {d.status}
                    </span>
                  </div>
                  {editingDraftId === d.id ? (
                    <div className="space-y-2">
                      <input
                        className="w-full rounded border border-gray-700 bg-[#111111] px-3 py-2 text-sm text-white focus:border-opsly-purple focus:outline-none"
                        value={draftEditor.subject}
                        onChange={(e) => setDraftEditor((prev) => ({ ...prev, subject: e.target.value }))}
                        placeholder="Subject"
                      />
                      <textarea
                        className="min-h-[140px] w-full rounded border border-gray-700 bg-[#111111] px-3 py-2 text-xs text-gray-200 focus:border-opsly-purple focus:outline-none"
                        value={draftEditor.body}
                        onChange={(e) => setDraftEditor((prev) => ({ ...prev, body: e.target.value }))}
                        placeholder="Email body"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveDraftEdit(d)}
                          disabled={loading}
                          className="rounded bg-opsly-purple px-3 py-1 text-xs text-white hover:bg-purple-600 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelDraftEdit}
                          disabled={loading}
                          className="rounded bg-gray-700 px-3 py-1 text-xs text-white hover:bg-gray-600 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="mb-1 text-sm font-semibold text-white">Subject: {d.subject}</p>
                      <p className="line-clamp-3 text-xs text-gray-300">{d.body}</p>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => startDraftEdit(d)}
                          disabled={loading || d.status === 'sent'}
                          className="rounded bg-opsly-purple px-3 py-1 text-xs text-white hover:bg-purple-600 disabled:opacity-50"
                        >
                          Edit Draft
                        </button>
                        {d.status === 'sent' && <span className="text-xs text-gray-400">Sent emails are locked</span>}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-xl bg-opsly-card p-5">
          <h2 className="text-lg font-semibold text-white">Analytics</h2>
          {!analytics && <p className="mt-2 text-sm text-gray-400">Run pipeline actions and refresh analytics.</p>}
          {analytics && (
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric label="Total Prospects" value={analytics.summary?.total_prospects ?? analytics.prospects?.total ?? 0} />
              <Metric label="With Email" value={analytics.summary?.with_email ?? analytics.prospects?.with_email ?? 0} />
              <Metric label="Drafted" value={analytics.summary?.drafted ?? analytics.emails?.drafted ?? 0} />
              <Metric label="Sent" value={analytics.summary?.sent ?? analytics.emails?.sent ?? 0} />
              <Metric label="Failed" value={analytics.summary?.failed ?? analytics.emails?.failed ?? 0} />
              <Metric label="Replied" value={analytics.summary?.replied ?? analytics.engagement?.replied ?? 0} />
              <Metric label="Reply Rate" value={`${analytics.summary?.reply_rate ?? analytics.engagement?.reply_rate_percent ?? 0}%`} />
              <Metric label="Recent Snippets" value={analytics.summary?.recent_reply_snippets?.length ?? 0} />
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  )
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-opsly-dark p-3">
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-2 truncate text-xl font-bold text-white">{value}</p>
    </div>
  )
}

export default CampaignOps
