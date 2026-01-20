# Content Factory - Project Instructions

## Quick Context
Marketing automation platform for Crystal Tax. Pipeline: Research → Content → Distribution.

## Current Focus
<!-- UPDATE THIS SECTION WHEN SWITCHING TASKS -->
**Working on**: MVP completion
**Last session**: Initial setup complete, all pages working
**Next task**: Commit changes, then add Celery for background tasks

## Session Log
<!-- Add brief notes after each session -->

### 2026-01-20
- Reviewed project structure
- Created AGENTS.md with full documentation
- Status: MVP functional, needs commit

---

## Architecture Decisions
- SQLite for dev, PostgreSQL for prod
- Fernet encryption for API keys
- Manual posting MVP (OAuth later)
- Switchable AI providers (OpenAI/Anthropic)

## Don't Forget
- [ ] Commit all current changes
- [ ] Add Celery + Redis
- [ ] LinkedIn OAuth integration
- [ ] User authentication

## Commands
```bash
# Start backend
cd backend && uvicorn main:app --reload

# Start frontend
cd frontend && npm run dev
```
