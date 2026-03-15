# Forge - Project Decision Log

A running record of every architectural decision, naming choice, and technical direction taken during development. Use this to prepare for your project demo and discussion.

---

## Project Identity

**Name:** Forge
**Stack:** TypeScript, PostgreSQL, Docker, GitHub Actions

**Description:**
> Receives webhooks, runs AI processing actions on the payload, and fans out results to registered URLs. Think Zapier, but you built it yourself. Built with TypeScript, PostgreSQL, and Docker.

**Why this name:**
Forge was chosen because it reflects what the service does - raw material (webhook payload) comes in, gets shaped and refined through processing, and comes out as something more valuable.

---

## Architecture Decisions

### 1. Three-layer pipeline design
**Decision:** Source → Processing Action → Subscribers
**Why:** Clean separation of concerns - ingestion, processing, and delivery are fully independent layers. Each can fail, retry, or scale independently.

### 2. Async job queue via database (not Redis)
**Decision:** Webhook arrives → save job row with status pending → return 200 immediately. Worker picks it up separately.
**Why:** Simpler, no extra dependencies, sufficient for this scale. Status: pending → processing → done / failed.

### 3. Worker as a polling loop
**Decision:** setInterval every 5 seconds picks up pending jobs.
**Why:** Simple, transparent, easy to reason about. No external dependencies needed.

### 4. Action registry pattern
**Decision:** All processing actions registered in a central actionRegistry object.
**Why:** Adding a new action is one line. Type system enforces only registered actions can be used.

### 5. Discriminated union for action types
**Decision:** Action types defined as TypeScript discriminated union, not loose strings.
**Why:** TypeScript exhaustively checks which action is being used. Prevents invalid configs.

### 6. Zod for all validation
**Decision:** Every external input validated with Zod - request bodies, env vars, everything.
**Why:** Runtime safety on top of compile-time safety. App crashes at startup with a clear error if env vars are missing.

---

## AI Processing Actions

**Theme:** Content intelligence - processes text-based webhook payloads and makes them smarter.

### Action 1: Summarize
Calls OpenAI/Claude API, returns a concise summary of the text field.

### Action 2: Sentiment Analysis
Returns positive | negative | neutral plus a confidence score.

### Action 3: Tag Extraction
Pulls out 5 key topics/entities as structured tags.

**Why these three:** They form a coherent story. Any content pipeline would want all three. Shows the project was designed with a real use case in mind.

---

## Folder Structure

src/api - HTTP layer only (routes, middleware)
src/core - Business logic (actions, worker, delivery)
src/db - Data layer (repositories, migrations)
src/types - Shared TypeScript types

**Why:** Separates concerns by layer, not by feature. Each layer is independently testable.

---

## Commit Convention
Using Conventional Commits:
- feat: new feature
- fix: bug fix
- chore: setup, config, maintenance
- refactor: restructure without behavior change
- docs: documentation only
- build: dependencies, docker, build config
- ops: CI/CD, GitHub Actions
- test: tests

---

## Steps Taken

### Day 1
- [x] Created project folder forge
- [x] Initialized git repo and connected to GitHub
- [x] Created full folder structure
- [x] Configured tsconfig.json
- [x] Created src/config.ts with Zod env validation
- [x] Created src/index.ts with Express and /health endpoint
- [x] Created .env.example
- [x] Installed dependencies
- [x] First commit pushed to GitHub
- [x] Added DECISIONS.md to project

### Next: Day 2
- [ ] Write docker-compose.yml and Dockerfile
- [ ] Design DB schema (pipelines, jobs, delivery_attempts)
- [ ] Write migration SQL
- [ ] Set up DB connection pool
- [ ] Write pipeline repository
- [ ] Build pipeline CRUD routes

---

*Updated continuously throughout development.*
