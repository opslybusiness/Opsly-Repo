# Running Both Backends (Local Setup)

This guide shows how to run both backend services in this repo with separate virtual environments.

- `backend` (core Opsly backend) runs on `http://127.0.0.1:8000`
- `EmailBot-BE` (email/campaign backend) runs on `http://127.0.0.1:8001`

## Prerequisites

- Python 3.10+ installed
- `pip` available
- PostgreSQL running (both services require DB access)

---

## 1) Run `backend` service

Open a terminal at repo root, then:

```bash
cd backend
python -m venv .venv
```

Activate venv:

- Windows PowerShell:
```powershell
.\.venv\Scripts\Activate.ps1
```

- macOS/Linux:
```bash
source .venv/bin/activate
```

Install dependencies:

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Set environment variables (`backend/.env`) as needed by your setup (for example DB/auth/social API keys).

(Optional) create/update tables:

```bash
python app/create_tables.py
```

Run server:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

## 2) Run `EmailBot-BE` service

Open a **second terminal** at repo root, then:

```bash
cd EmailBot-BE
python -m venv .venv
```

Activate venv:

- Windows PowerShell:
```powershell
.\.venv\Scripts\Activate.ps1
```

- macOS/Linux:
```bash
source .venv/bin/activate
```

Install dependencies:

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Set environment variables in `EmailBot-BE/.env`.

Minimum required keys from app startup checks:

```env
DATABASE_URL=
SUPABASE_JWT_SECRET=
GOOGLE_API_KEY=
SERPER_API_KEY=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM_NAME=
EMAIL_FROM_ADDRESS=
```

Run server:

```bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

---

## 3) Verify both are running

- Core backend: `http://127.0.0.1:8000`
- Email backend: `http://127.0.0.1:8001`

If needed, open docs:

- `http://127.0.0.1:8000/docs`
- `http://127.0.0.1:8001/docs`

---

## 4) Stop / deactivate

- Stop server: `Ctrl + C`
- Deactivate venv:

```bash
deactivate
```
