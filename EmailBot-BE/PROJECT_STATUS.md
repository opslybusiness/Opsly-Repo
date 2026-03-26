# EmailBot-BE — Project Status

## Sprint Execution Update (March 20, 2026)

### Completed in this pass

- Sprint 1 core stability happy-path endpoints are implemented and acceptance-tested:
        - create profile
        - create campaign
        - discover prospects
        - generate drafts
        - send
        - check replies
        - analytics
- Startup env validation now hard-fails on missing required values:
        - `DATABASE_URL`, `SUPABASE_JWT_SECRET`, `GOOGLE_API_KEY`, `SERPER_API_KEY`
        - SMTP fallback vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM_NAME`, `EMAIL_FROM_ADDRESS`)
- Input validation strengthened:
        - campaign field minimum lengths tightened (`target_industry`, `target_location`, `target_keywords`)
        - manual prospect email format validation persists on update
        - discovery `max_results` server guardrails enforced
- Idempotency protections hardened:
        - no duplicate drafts for same campaign+prospect
        - send only pending records (already-sent records are not resent)
        - reply events deduped with reply signature checks

- Sprint 2 quality and sending safety delivered:
        - new manual intake endpoint:
                - `POST /campaigns/{id}/prospects/manual` (JSON and CSV support)
        - discovery quality:
                - domain deduplication
                - email deduplication across campaign
                - junk domain skipping
        - pre-send safety checks:
                - SMTP config validation before batch send
                - recipient email syntax checks
                - empty subject/body rejection
        - per-user throttles added:
                - discovery per minute and per hour
                - send per minute and per day

- Sprint 3 reply tracking and analytics hardening delivered:
        - robust Message-ID normalization and reply header matching
        - improved `In-Reply-To`/`References` parsing
        - self/internal reply ignore behavior
        - analytics enriched with completeness summary:
                - total prospects, with email, drafted, sent, failed, replied, reply rate, recent snippets
        - event model consistency:
                - `send_attempt`, `sent`, `failed`, `replied` audit coverage
                - failure reasons persisted
                - reply details persisted (`from`, `subject`, `snippet`, `received_at`)

- Sprint 4 production-readiness baseline delivered:
        - compliance default footer appended during draft generation (unsubscribe instruction)
        - suppression list support:
                - `POST /campaigns/suppressions`
                - `GET /campaigns/suppressions`
                - `DELETE /campaigns/suppressions/{id}`
        - operational reliability:
                - background-job endpoints for discover/generate/send/check with job polling
                - retry behavior for transient discovery/send failures
        - security:
                - SMTP password encryption at rest via Fernet-backed helper
                - no secret values logged in new code paths

- Endpoint-level acceptance tests added and passing:
        - `tests/test_campaign_endpoints.py`

- Frontend workflow added in Opsly frontend:
        - new route: `/campaign-ops`
        - full UI flow for profile/campaign/discover/import/generate/send/replies/analytics
        - service integration file: `src/services/campaignService.js`

## What Was Built

### Overview
An **automated cold-email outreach system** built on top of the existing RAG chatbot backend (FastAPI + PostgreSQL + Gemini LLM). The system takes business details as input, discovers prospects, generates personalised cold emails using AI, sends them, and then tracks replies and engagement — fully automated.

---

### New Files Created

| File | Purpose |
|---|---|
| `app/models/campaign_models.py` | 5 PostgreSQL tables (auto-created on startup) |
| `app/models/__init__.py` | Model exports |
| `app/services/prospect_service.py` | Prospect discovery via Google Custom Search + website scraping + Hunter.io |
| `app/services/email_gen_service.py` | AI cold-email writer (subject + body) using Gemini LLM |
| `app/services/email_send_service.py` | SMTP email sending + IMAP reply checking |
| `app/services/campaign_service.py` | Full pipeline orchestrator (discovery → generate → send → replies → analytics) |

### Modified Files

| File | Changes |
|---|---|
| `app/schemas.py` | +10 Pydantic request/response models for the campaign system |
| `app/main.py` | +15 new API routes for the entire campaign pipeline |
| `requirements.txt` | Added `beautifulsoup4` (currently not required by runtime campaign flow) |
| `.env.example` | Added template for all required/optional environment variables |

---

### Database Tables (auto-created via SQLModel)

```
business_profiles   — stores sender identity + optional per-profile SMTP credentials
campaigns           — one campaign per outreach effort (target industry, location, keywords)
prospects           — businesses discovered as outreach targets
sent_emails         — generated email drafts + send status (pending / sent / failed)
email_events        — audit log (sent, replied, bounced events)
```

---

### Full API Route Map

```
# Business Profiles (sender identity)
POST   /campaigns/profiles              Create a business profile
GET    /campaigns/profiles              List all profiles for the user
DELETE /campaigns/profiles/{id}         Delete a profile

# Campaigns
POST   /campaigns                       Create a campaign
GET    /campaigns                       List all campaigns
GET    /campaigns/{id}                  Get a single campaign
DELETE /campaigns/{id}                  Delete a campaign + all data

# Step 1 — Prospect Discovery
POST   /campaigns/{id}/discover         Google Search → scrape emails → save prospects
GET    /campaigns/{id}/prospects        List discovered prospects
PATCH  /campaigns/{id}/prospects/{pid} Manually set/correct a prospect's email

# Step 2 — Email Generation (Gemini LLM)
POST   /campaigns/{id}/generate-emails  Generate personalised subject + body per prospect
GET    /campaigns/{id}/emails           Preview all draft emails

# Step 3 — Send
POST   /campaigns/{id}/send             Send all pending emails via SMTP

# Step 4 — Reply Checking
POST   /campaigns/{id}/check-replies    Poll IMAP inbox for replies (matched by Message-ID)

# Step 5 — Analytics
GET    /campaigns/{id}/analytics        Reply rate, sent/failed counts, reply snippets
```

---

### Required Environment Variables

```env
# ── Prospect Discovery ──────────────────────────────────────────
GOOGLE_CSE_API_KEY=          # Google Custom Search JSON API key
GOOGLE_CSE_ID=               # Programmable Search Engine ID (cx)
HUNTER_IO_API_KEY=           # Optional — improves email discovery (Hunter.io)

# ── Email Sending (global defaults; per-profile overrides stored in DB) ──
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASSWORD=               # Use a Gmail App Password, NOT your main password
EMAIL_FROM_NAME=Your Name
EMAIL_FROM_ADDRESS=you@gmail.com

# ── Reply Checking (IMAP) ────────────────────────────────────────
IMAP_HOST=imap.gmail.com     # Optional — auto-derived from SMTP_HOST by default
IMAP_PORT=993                # Optional

# ── Existing (already in the chatbot system) ─────────────────────
GOOGLE_API_KEY=              # Gemini LLM + embeddings
JINA_API_KEY=                # Jina AI embeddings (if EMBEDDING_PROVIDER=jina)
DATABASE_URL=                # PostgreSQL connection string
SUPABASE_JWT_SECRET=         # For route authentication
```

---

### How the Pipeline Flows

```
1.  POST /campaigns/profiles
        → Register your business (name, type, SMTP creds, etc.)

2.  POST /campaigns
        → Create a campaign (target industry + location + keywords)

3.  POST /campaigns/{id}/discover
        → Google Custom Search finds businesses matching the target
        → Scrapes each website for a contact email (homepage / /contact / /about)
        → Hunter.io domain search if API key is provided
        → Saves all prospects to DB

4.  PATCH /campaigns/{id}/prospects/{pid}   [optional]
        → Manually correct a missing or wrong email address

5.  POST /campaigns/{id}/generate-emails
        → Gemini LLM reads sender profile + each prospect's info
        → Writes a personalised subject line + email body
        → Saved as "pending" drafts in DB

6.  GET /campaigns/{id}/emails              [optional review]
        → Preview all drafted emails before sending

7.  POST /campaigns/{id}/send
        → Sends all pending emails via SMTP/STARTTLS
        → Records Message-IDs for reply matching

8.  POST /campaigns/{id}/check-replies
        → Polls IMAP inbox (last 30 days)
        → Matches In-Reply-To/References headers against sent Message-IDs
        → Records new replies as EmailEvent rows

9.  GET /campaigns/{id}/analytics
        → Returns: prospects found, emails sent/failed/pending,
                   reply count, reply rate %, reply snippets
```

---

## What Still Needs to Be Done

### 🔴 Critical / Must-Have

- [ ] **Add `.env` variables** — `GOOGLE_CSE_API_KEY`, `GOOGLE_CSE_ID`, and SMTP credentials must be set before anything works.
- [ ] **Test the full pipeline end-to-end** — Run a campaign manually through all 9 steps using real or test data to ensure each stage works correctly.
- [ ] **Fix the GitHub push** — The `EmailService` repo push failed with "Repository not found". Update the remote URL to the correct one and push:
  ```bash
  git remote set-url origin https://github.com/YOUR_CORRECT_USERNAME/EmailService.git
  git push -u origin main
  ```
- [ ] **Connect the EmailBot-BE to its own PostgreSQL database** — The models need a `DATABASE_URL` that points to a DB separate from the chatbot if you want them isolated, or confirm they share the same DB.

### 🟡 Important / Should-Have

- [ ] **Rate limiting on the `/discover` and `/send` routes** — Bulk discovery and sending can be slow or noisy; add a per-user limit or background task queue (Celery / ARQ / FastAPI BackgroundTasks).
- [ ] **Background task support** — `/discover`, `/generate-emails`, and `/send` are I/O-heavy and currently block the request. Move them to background tasks so they don't time out on large campaigns.
- [ ] **Email validation before sending** — Use a library like `email-validator` to sanity-check addresses before attempting SMTP delivery to reduce bounce rate.
- [ ] **Bounce / unsubscribe handling** — Currently only reply detection is implemented. Bounced-email detection (via inbox monitoring for MAILER-DAEMON replies) should be added.
- [x] **`.env.example` file** — Added `.env.example` with chatbot + campaign env variables.
- [ ] **Frontend integration** — Build or connect a UI to the campaign API routes so users can manage campaigns without calling the API directly.

### 🟢 Nice-to-Have / Future

- [ ] **Follow-up email sequences** — Automatically send a second or third email if no reply is received after N days.
- [ ] **Campaign scheduling** — Let users set a date/time for when emails should go out (e.g., Tuesday 9 AM).
- [ ] **Email template system** — Allow users to create reusable email templates with placeholders instead of always using AI generation.
- [ ] **Open tracking** — Embed a 1px tracking pixel to detect email opens (requires a tracking server endpoint).
- [ ] **Unsubscribe link** — Append a one-click unsubscribe URL to every email for legal compliance (CAN-SPAM / GDPR).
- [ ] **GDPR / CAN-SPAM compliance review** — Ensure the outreach system meets legal requirements for the target market.
- [ ] **Prospect deduplication** — Prevent the same email address from being contacted by multiple campaigns from the same user.
- [ ] **Admin dashboard / analytics charts** — Visualise reply rate, delivery rate, and pipeline funnel per campaign.
- [ ] **Webhook support** — Allow the system to push reply/bounce events to a frontend or third-party service in real time.

---

## Repository State

| Repo | Remote | Branch | Status |
|---|---|---|---|
| `chatbot-be` | `github.com/opslybusiness/chatbot-be` | `main` | Has uncommitted changes (campaign files added to parent folder — not yet committed) |
| `EmailBot-BE` | `github.com/opslybusiness/EmailService` | `main` | Committed locally — **push failed, needs correct remote URL** |

### Pending commit in `chatbot-be`
The following files were added/modified in the parent `chatbot-be` repo but not yet committed:
```
modified:   app/main.py
modified:   app/schemas.py
modified:   requirements.txt
untracked:  app/models/
untracked:  app/services/campaign_service.py
untracked:  app/services/email_gen_service.py
untracked:  app/services/email_send_service.py
untracked:  app/services/prospect_service.py
```
Run the following to commit these to the chatbot-be repo:
```bash
cd "d:\Codes\FYP 2026\Chatbot-BE\chatbot-be"
git add .
git commit -m "feat: add automated cold-email campaign system"
git push
```
