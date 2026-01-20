# Content Factory - AI Agent Instructions

## Project Overview

Multi-channel marketing automation platform for **Crystal Tax** (offshore company registration services).

**Pipeline**: Research → Content Generation → Distribution

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | FastAPI + SQLAlchemy (async) + Pydantic |
| Database | SQLite (dev) / PostgreSQL (prod) |
| AI Providers | OpenAI, Anthropic (switchable) |
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| State | TanStack React Query |
| Security | Fernet encryption for API keys/credentials |

## Current Architecture

```
backend/
├── main.py              # FastAPI app, CORS, routes
├── config.py            # Pydantic Settings
├── database.py          # Async SQLAlchemy setup
├── models.py            # ORM models (Campaign, Research, Content, Account, Post, ApiKey)
├── crypto.py            # Fernet encryption utils
├── agents/
│   ├── researcher.py    # Market analysis agent
│   ├── writer.py        # Content generation agent
│   └── poster.py        # Distribution agent (MVP: manual mode)
└── api/
    ├── research.py      # /api/research endpoints
    ├── content.py       # /api/content endpoints
    ├── distribution.py  # /api/distribution endpoints
    └── settings.py      # /api/settings endpoints

frontend/src/
├── App.tsx              # Router setup
├── api.ts               # API client (fetch wrapper)
├── components/
│   └── Sidebar.tsx      # Navigation
└── pages/
    ├── Dashboard.tsx    # Stats overview
    ├── Research.tsx     # Market analysis UI
    ├── Content.tsx      # Content generation UI
    ├── Distribute.tsx   # Post scheduling UI
    └── Settings.tsx     # API keys & accounts management
```

## Implementation Status

### Phase 1: MVP [CURRENT]

| Feature | Status | Notes |
|---------|--------|-------|
| Database models | ✅ Done | Campaign, Research, Content, Account, Post, ApiKey |
| Research Agent | ✅ Done | Analyzes niche, audience, competitors, content angles |
| Writer Agent | ✅ Done | Generates platform-specific content |
| Poster Agent | ⚠️ MVP | Manual mode (copy-paste), OAuth not implemented |
| Settings API | ✅ Done | Encrypted API keys, account management |
| Dashboard | ✅ Done | Basic stats and recent campaigns |
| Research Page | ✅ Done | Input niche, view analysis results |
| Content Page | ✅ Done | Generate content, platform tabs, copy button |
| Distribute Page | ✅ Done | Schedule posts, select accounts |
| Settings Page | ✅ Done | Manage API keys and social accounts |

### Phase 2: Intelligence [TODO]

| Feature | Status | Priority |
|---------|--------|----------|
| Celery + Redis queue | ❌ | High |
| Trend monitoring | ❌ | High |
| Content gap analysis | ❌ | Medium |
| Competitor tracking | ❌ | Medium |
| Viral pattern recognition | ❌ | Low |

### Phase 3: Scale [TODO]

| Feature | Status | Priority |
|---------|--------|----------|
| OAuth integrations (LinkedIn, Twitter) | ❌ | High |
| Background scheduled posting | ❌ | High |
| Anti-detection (delays, proxies) | ❌ | Medium |
| A/B testing variants | ❌ | Medium |
| Analytics dashboard | ❌ | Medium |
| User authentication | ❌ | High |

## API Endpoints

### Research
```
POST /api/research/campaigns          # Create campaign
GET  /api/research/campaigns          # List campaigns
GET  /api/research/campaigns/{id}     # Get campaign with research
POST /api/research/analyze            # Run market analysis
```

### Content
```
POST /api/content/generate            # Generate content for campaign
GET  /api/content/campaign/{id}       # Get content by campaign
```

### Distribution
```
POST /api/distribution/accounts       # Add social account
GET  /api/distribution/accounts       # List accounts
POST /api/distribution/schedule       # Schedule post
POST /api/distribution/post-now       # Post immediately (MVP: returns formatted content)
GET  /api/distribution/posts          # List posts
```

### Settings
```
GET    /api/settings/api-keys              # List API keys (masked)
POST   /api/settings/api-keys              # Add API key
DELETE /api/settings/api-keys/{id}         # Delete API key
PUT    /api/settings/api-keys/{id}/default # Set default provider
GET    /api/settings/accounts              # List social accounts
POST   /api/settings/accounts              # Add social account
DELETE /api/settings/accounts/{id}         # Delete account
```

## Database Models

```python
Campaign:       id, name, niche, description, status, created_at
Research:       id, campaign_id, data (JSON), created_at
Content:        id, campaign_id, topic, content_type, raw_content, platform_versions (JSON), created_at
Account:        id, platform, username, credentials_encrypted, status, created_at
Post:           id, content_id, account_id, platform, scheduled_time, posted_at, status, external_id, metrics
ApiKey:         id, provider, key_encrypted, is_default, created_at
```

## AI Agent Prompts

### Researcher Agent
Returns JSON with:
- `market_overview`: string
- `target_audience`: array of personas with pain_points, goals, demographics
- `competitors`: array with name, positioning, strengths, weaknesses
- `content_angles`: array of content ideas
- `recommended_platforms`: array with platform, priority, reasoning

### Writer Agent
Returns JSON with:
- `raw_content`: main content piece
- `platform_versions`: object with linkedin, twitter, instagram, youtube, facebook adaptations

## Configuration

Environment variables (`.env`):
```
DATABASE_URL=sqlite+aiosqlite:///./content_factory.db
AI_PROVIDER=anthropic  # or openai
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
ENCRYPTION_KEY=...  # Fernet key, auto-generated if missing
```

## Development Commands

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev  # Port 5173

# Docker (full stack)
docker-compose up --build
```

## Next Steps (Recommended Order)

1. **Commit current changes** - много незакоммиченных файлов
2. **Add Celery + Redis** - для background tasks и scheduled posting
3. **Implement OAuth** - начать с LinkedIn (самый важный для B2B)
4. **Add user auth** - JWT tokens
5. **Trend monitoring** - scraping + API для анализа трендов
6. **Analytics** - собирать метрики постов

## Code Style

- Async everywhere (SQLAlchemy async, httpx async)
- Pydantic for validation
- Type hints required
- Error handling with proper HTTP status codes
- Encrypted storage for sensitive data

## Known Issues

1. CORS is `allow_origins=["*"]` - restrict in production
2. No rate limiting on API
3. Encryption key in env var - use KMS/Vault in production
4. No input sanitization for AI prompts (potential injection)

---

*Last updated: 2026-01-20*
