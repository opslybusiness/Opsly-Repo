# EmailBot-BE FastAPI Backend

A FastAPI backend that combines:
- RAG chatbot capabilities (document upload, retrieval, conversational Q&A)
- automated cold-email campaign workflows (prospect discovery, AI email generation, sending, reply tracking, analytics)

## Features

- **Chat Endpoints**: Send messages, receive AI responses with RAG context
- **Session Management**: Create, retrieve, and clear chat sessions
- **Document Upload**: Upload files for embedding creation and storage
- **Document Search**: Vector similarity search across uploaded documents
- **Chat History**: Persistent chat history stored in PostgreSQL
- **Campaign Management**: Business profiles and outreach campaign CRUD
- **Prospect Discovery**: Google Custom Search + website email extraction + optional Hunter.io enrichment
- **AI Email Generation**: Personalized cold-email subject/body generation via Gemini
- **Email Delivery + Replies**: SMTP sending and IMAP-based reply matching
- **Campaign Analytics**: Delivery/reply metrics and reply snippets

## Project Structure

```
.
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application
│   ├── schemas.py           # Pydantic models
│   └── services/
│       ├── __init__.py
│       ├── chat_service.py  # Chatbot logic with RAG
│       └── document_service.py  # Document processing
├── chatbot.py               # Original chatbot (for reference)
├── chat_memory.py          # PostgreSQL chat history
├── embeddings_util.py      # Embedding utilities
├── retriever.py            # Document retrieval
├── ingest_doc.py           # Document ingestion script
└── requirements.txt        # Python dependencies
```

## Setup

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Environment Variables:**
  Copy `.env.example` to `.env` and fill values.

  Minimum variables for core chatbot:
   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/dbname
  EMBEDDING_PROVIDER=jina
  JINA_API_KEY=your_jina_api_key
  GOOGLE_API_KEY=your_google_api_key
  SUPABASE_JWT_SECRET=your_supabase_jwt_secret
   ```

  Additional variables required for campaign features:
  ```
  GOOGLE_CSE_API_KEY=your_google_cse_key
  GOOGLE_CSE_ID=your_programmable_search_engine_id

  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=you@example.com
  SMTP_PASSWORD=your_app_password
  EMAIL_FROM_NAME=Your Name
  EMAIL_FROM_ADDRESS=you@example.com

  # Optional
  HUNTER_IO_API_KEY=your_hunter_key
  IMAP_HOST=imap.gmail.com
  IMAP_PORT=993
  ```
   
   **Important**: The `DATABASE_URL` should use the format `postgresql://` (not `postgresql+asyncpg://`). 
   The code will automatically convert it to use the sync driver (`postgresql+psycopg://`).
   
   **Note**: See `EMBEDDING_USAGE.md` for details on switching between embedding providers.

3. **Database Setup:**
   Ensure PostgreSQL is running with pgvector extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE TABLE IF NOT EXISTS documents (
       id TEXT PRIMARY KEY,
       content TEXT,
       metadata JSONB,
       embedding vector(768),
       created_at TIMESTAMP DEFAULT NOW()
   );
   ```
   
   **Run the migration script** (`database_migration.sql`) to add `user_id` to the `chatmessage` table:
   ```sql
   -- See database_migration.sql for the full migration
   ALTER TABLE chatmessage ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
   CREATE INDEX idx_chatmessage_user_id ON chatmessage(user_id);
   ```

4. **Run the API:**
   ```bash
   python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

   Or:
   ```bash
   python app/main.py
   ```

## API Endpoints

### Health Check
- `GET /` - Root endpoint
- `GET /health` - Health check

### Chat Endpoints
- `POST /chat/message` - Send a message and receive AI response
  ```json
  {
    "message": "string",
    "session_id": "optional-client-id",  // Optional, ignored by server
    "use_rag": true
  }
  ```
  **Note**: All messages are matched by `user_id` from JWT token only. `session_id` is optional and only used for client-side reference.

- `POST /chat/session` - Get chat session info (session_id optional)
- `GET /chat/session` - Get chat history for authenticated user
- `DELETE /chat/session` - Clear all chat history for authenticated user

### Document Endpoints
- `POST /documents/upload` - Upload a single document file
- `POST /documents/upload-multiple` - Upload multiple documents
- `GET /documents/search?query=string&top_k=5` - Search documents
- `GET /documents/list` - List all uploaded documents
- `DELETE /documents/{document_id}` - Delete a document

### Campaign Endpoints

Business profiles:
- `POST /campaigns/profiles` - Create a business profile
- `GET /campaigns/profiles` - List business profiles
- `DELETE /campaigns/profiles/{profile_id}` - Delete a business profile

Campaigns:
- `POST /campaigns` - Create campaign
- `GET /campaigns` - List campaigns
- `GET /campaigns/{campaign_id}` - Get campaign details
- `DELETE /campaigns/{campaign_id}` - Delete campaign and related records

Prospects:
- `POST /campaigns/{campaign_id}/discover` - Discover prospects
- `GET /campaigns/{campaign_id}/prospects` - List discovered prospects
- `PATCH /campaigns/{campaign_id}/prospects/{prospect_id}` - Manually update prospect email

Email drafting and sending:
- `POST /campaigns/{campaign_id}/generate-emails` - Generate personalized draft emails
- `GET /campaigns/{campaign_id}/emails` - List generated/sent emails
- `POST /campaigns/{campaign_id}/send` - Send all pending campaign emails

Replies and analytics:
- `POST /campaigns/{campaign_id}/check-replies` - Poll IMAP inbox and record replies
- `GET /campaigns/{campaign_id}/analytics` - Get campaign analytics

## API Documentation

Once the server is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Example Usage

### Send a Chat Message
```bash
curl -X POST "http://localhost:8000/chat/message" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "message": "What are the pet policies?",
    "session_id": "optional-client-id",
    "use_rag": true
  }'
```

**Important Notes**:
- All chat endpoints require authentication (JWT token in `Authorization` header)
- All messages are matched by `user_id` from the JWT token only
- `session_id` is optional and ignored by the server - it's only returned for client-side reference
- Each user has one continuous conversation

### Upload a Document
```bash
curl -X POST "http://localhost:8000/documents/upload" \
  -F "file=@Rules.txt"
```

### Search Documents
```bash
curl "http://localhost:8000/documents/search?query=pets&top_k=3"
```

## Development

The API uses:
- **FastAPI** for the web framework
- **LangChain** for LLM integration and RAG
- **PostgreSQL + pgvector** for vector storage
- **Jina AI / Google Gemini** for embeddings (API-based)
- **Google Gemini** for the LLM

## Notes

- Chat sessions are persistent and stored in PostgreSQL
- Documents are automatically chunked and embedded on upload
- RAG retrieval uses cosine similarity on document embeddings
- The chatbot maintains conversation context across messages
- Campaign routes are synchronous at service level and currently run in executor wrappers for heavy operations
- SMTP credentials can be set globally via env vars or per business profile in the database

