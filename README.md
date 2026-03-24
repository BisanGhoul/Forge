# Forge

A webhook-driven task processing pipeline service. You send a webhook, Forge queues it, processes it using an AI action, and delivers the result to every registered subscriber URL — with retry logic, signature verification, and rate limiting built in.

Think of it as a minimal Zapier: an inbound event triggers a processing step, and the result gets forwarded to one or more destinations.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Processing Actions](#processing-actions)
- [How the Worker Works](#how-the-worker-works)
- [Delivery & Retry Logic](#delivery--retry-logic)
- [Security: Webhook Signature Verification](#security-webhook-signature-verification)
- [Rate Limiting](#rate-limiting)
- [CI/CD Pipeline](#cicd-pipeline)
- [Design Decisions](#design-decisions)
- [Known Limitations & Future Work](#known-limitations--future-work)

---

## Overview

Forge lets you create **pipelines**. Each pipeline has:

1. **A source** — a unique token-based URL that accepts incoming webhooks
2. **An action** — one of three AI-powered processing steps (summarize, translate, tag extraction)
3. **Subscribers** — one or more URLs where the processed result is delivered after the job completes

The service never processes webhooks synchronously. Every incoming webhook is immediately queued as a job, and a background worker picks it up, runs the action, and delivers the result.

---

## Architecture

```
<img width="1536" height="1024" alt="architecture" src="https://github.com/user-attachments/assets/66533852-5e1a-47ba-8ebf-9b655ff259a4" />

```

The worker polls the DB every 5 seconds using `setInterval`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 |
| Language | TypeScript |
| Framework | Express 5 |
| Database | PostgreSQL 16 |
| DB Driver | `pg` (raw SQL, no ORM) |
| Validation | Zod |
| AI | OpenAI API (gpt-4o-mini) |
| Containerization | Docker + Docker Compose |
| CI | GitHub Actions |

---

## Project Structure

```
src/
├── index.ts                        # App entry point, wires everything together
├── config.ts                       # Env var validation using Zod
│
├── api/
│   ├── routes/
│   │   ├── pipelines.ts            # CRUD API for pipelines
│   │   ├── webhooks.ts             # Webhook ingestion (rate limiting + sig verification)
│   │   └── jobs.ts                 # Job status and delivery history
│   └── middleware/
│       ├── validate.ts             # Zod-based request body validation middleware
│       └── errorHandler.ts         # Global error handler
│
├── core/
│   ├── actions/
│   │   ├── index.ts                # Action registry — maps type strings to handler functions
│   │   ├── summarize.ts            # Summarize action (OpenAI)
│   │   ├── translate.ts            # Translate action (OpenAI)
│   │   ├── tagExtract.ts           # Tag extraction action (OpenAI)
│   │   ├── openaiClient.ts         # Shared OpenAI client instance
│   │   └── utils.ts                # JSON parsing and response extraction helpers
│   ├── worker/
│   │   └── worker.ts               # Background job processor (polling loop)
│   └── delivery/
│       └── deliver.ts              # HTTP delivery to subscribers with retry logic
│
├── db/
│   ├── pool.ts                     # Shared pg connection pool
│   ├── migrate.ts                  # Runs SQL migration files on startup
│   ├── migrations/
│   │   └── 001_initial.sql         # Creates all tables
│   └── repositories/
│       ├── pipelineRepo.ts         # DB queries for pipelines and subscribers
│       ├── jobRepo.ts              # DB queries for jobs
│       └── deliveryRepo.ts         # DB queries for delivery attempts
│
└── types/
    ├── pipeline.ts                 # Pipeline, Subscriber, Action types
    └── job.ts                      # Job, DeliveryAttempt types
```

---

## Getting Started

### Prerequisites

- Docker and Docker Compose installed
- An OpenAI API key

### Running with Docker Compose

```bash
# 1. Clone the repo
git clone https://github.com/BisanGhoul/Forge.git
cd Forge

# 2. Create your .env file
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# 3. Start everything (app + PostgreSQL)
docker compose up --build

# The service is now running at http://localhost:3000
```

Docker Compose starts two containers:
- `app` — the Forge Node.js service (port 3000)
- `db` — PostgreSQL 16 (port 5432)

The app waits for the DB to be healthy before starting, then automatically runs migrations on boot.

### Stopping

```bash
docker compose down          # stop containers
docker compose down -v       # stop + delete the database volume (full reset)
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No (default: 3000) | Port the HTTP server listens on |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `OPENAI_API_KEY` | Yes | Your OpenAI API key — used for all three actions |

When running via Docker Compose, `DATABASE_URL` is pre-configured in `docker-compose.yml`. You only need to provide `OPENAI_API_KEY` in your `.env`.

---

## API Reference

### Pipelines

#### Create a pipeline
```
POST /pipelines
```

Body:
```json
{
  "name": "My Summarizer",
  "action_type": "summarize",
  "action_config": { "maxLength": 200 },
  "subscriber_urls": ["https://webhook.site/your-unique-id"]
}
```

Response `201`:
```json
{
  "id": "uuid",
  "name": "My Summarizer",
  "source_token": "abc123def456...",
  "action_type": "summarize",
  "action_config": { "maxLength": 200 },
  "is_active": true,
  "created_at": "...",
  "updated_at": "...",
  "subscribers": [
    { "id": "uuid", "pipeline_id": "uuid", "url": "https://webhook.site/..." }
  ]
}
```

> **Important:** save the `source_token` — this is your webhook URL token and also your HMAC signing secret.

#### List all pipelines
```
GET /pipelines
```

#### Get a pipeline by ID
```
GET /pipelines/:id
```

#### Update a pipeline
```
PUT /pipelines/:id
```

Body (all fields optional):
```json
{
  "name": "Updated Name",
  "action_type": "translate",
  "action_config": { "targetLanguage": "French" },
  "is_active": false
}
```

#### Delete a pipeline
```
DELETE /pipelines/:id
```

Response `204` (no body).

---

### Webhooks

#### Send a webhook to a pipeline
```
POST /webhooks/:token
```

The `:token` is the `source_token` from the pipeline you created.

Body (must include `text`):
```json
{
  "text": "The text you want to process goes here."
}
```

Response `202`:
```json
{
  "message": "Webhook received and queued for processing",
  "job_id": "uuid"
}
```

**Optional: Signature verification**

Add the `X-Forge-Signature` header with an HMAC-SHA256 hex digest signed with the `source_token` as the secret. See [Security](#security-webhook-signature-verification) for details.

---

### Jobs

#### List all jobs
```
GET /jobs
GET /jobs?status=pending
GET /jobs?status=processing
GET /jobs?status=done
GET /jobs?status=failed
```

#### Get a single job
```
GET /jobs/:id
```

Response includes the `result` field once the job is done:
```json
{
  "id": "uuid",
  "pipeline_id": "uuid",
  "payload": { "text": "..." },
  "result": { "summary": "...", "original_length": 500, "summary_length": 180 },
  "status": "done",
  "error_message": null,
  "created_at": "...",
  "processed_at": "..."
}
```

#### Get delivery attempts for a job
```
GET /jobs/:id/deliveries
```

Shows every delivery attempt to every subscriber, including status, HTTP response code, and any error messages.

---

### Health

```
GET /health
```

Returns `{ "status": "ok", "service": "forge" }` — useful for checking if the service and DB are up.

---

## Processing Actions

All three actions use **gpt-4o-mini** via the OpenAI API. The model is prompted to return structured JSON only, which is then validated with Zod before being saved.

### summarize

Summarizes the input text.

`action_config`:
```json
{ "maxLength": 200 }
```

Result:
```json
{
  "summary": "A concise summary...",
  "original_length": 1200,
  "summary_length": 187
}
```

### translate

Translates the input text to the target language.

`action_config`:
```json
{ "targetLanguage": "French" }
```

Result:
```json
{
  "translatedText": "Bonjour le monde...",
  "targetLanguage": "French",
  "detectedLanguage": "English"
}
```

### tag_extract

Extracts the most important keywords, topics, and entities from the input text.

`action_config`:
```json
{ "maxTags": 5 }
```

Result:
```json
{
  "tags": ["machine learning", "neural networks", "GPU", "training", "Python"],
  "count": 5
}
```

---

## How the Worker Works

The worker starts on app boot and polls for pending jobs every 5 seconds using `setInterval`. On each tick:

1. Fetch up to 10 jobs with `status = 'pending'`, ordered by `created_at ASC` (oldest first)
2. For each job:
   - Mark it `processing` (prevents double-processing)
   - Fetch the pipeline config
   - Run the appropriate action via the action registry
   - Save the result and mark the job `done`
   - Deliver the result to all subscriber URLs in parallel
   - If anything throws, mark the job `failed` and save the error message
3. Jobs are processed one at a time within a tick to keep things simple and predictable

**Why polling instead of a proper queue?** See [Design Decisions](#design-decisions).

---

## Delivery & Retry Logic

After a job is marked `done`, the worker delivers the result to every subscriber URL by making a POST request with this body:

```json
{
  "job_id": "uuid",
  "pipeline_id": "uuid",
  "result": { ... }
}
```

Each delivery attempt is recorded in the `delivery_attempts` table with status, HTTP response code, response body, and any error message.

**Retry behaviour:**

- Up to **3 attempts** per subscriber
- Waits **1 second** before attempt 2, **2 seconds** before attempt 3
- A delivery is considered failed if the subscriber returns a non-2xx status or if the request times out (10 second timeout per attempt)
- All subscribers are delivered to **in parallel** (`Promise.allSettled`)
- One subscriber failing does not block others

View delivery history via `GET /jobs/:id/deliveries`.

---

## Security: Webhook Signature Verification

Forge supports HMAC-SHA256 webhook signature verification, the same pattern used by Stripe, GitHub, and other production webhook systems.

### How it works

When creating a pipeline, Forge generates a random `source_token`. This token serves two purposes:
1. It is the URL token — the webhook endpoint is `POST /webhooks/:source_token`
2. It is the HMAC secret — used to verify the signature

The sender computes:
```
signature = HMAC-SHA256(secret=source_token, message=JSON.stringify(body))
```

And includes it as a header:
```
X-Forge-Signature: <hex digest>
```

### Opt-in behaviour

- If the header is **absent** — request is accepted (backward compatible)
- If the header is **present and correct** — request is accepted
- If the header is **present and wrong** — `401 Invalid webhook signature`

### Why timingSafeEqual?

A naive string comparison (`===`) leaks timing information — an attacker can determine how many characters of the signature match by measuring response time. `crypto.timingSafeEqual` takes constant time regardless of where the strings differ.

### Computing a signature for testing

```bash
node -e "
const crypto = require('crypto')
const body = JSON.stringify({ text: 'hello world' })
const secret = 'YOUR_SOURCE_TOKEN_HERE'
const sig = crypto.createHmac('sha256', secret).update(body).digest('hex')
console.log(sig)
"
```

Then add the output as the `X-Forge-Signature` header in Postman or curl.

---

## Rate Limiting

The webhook endpoint is rate-limited to **30 requests per minute per IP address**. This is implemented using an in-memory sliding window counter with no external dependencies.

When the limit is exceeded, the server responds with:

```json
HTTP 429
{
  "error": "Too many requests — please slow down",
  "retryAfterMs": 45000
}
```

`retryAfterMs` tells the client exactly how long to wait before the current window resets.

**Why in-memory?** For this project, simplicity wins. A production system with multiple instances would use Redis for shared state across instances.

---

## CI/CD Pipeline

Every push to `main`, `dev`, or any `feat/**` branch triggers the GitHub Actions CI pipeline, which:

1. Checks out the code
2. Sets up Node.js 20
3. Installs dependencies
4. Runs TypeScript type checking (`tsc --noEmit`)
5. Runs ESLint

Pull requests to `main` or `dev` also trigger this pipeline. The goal is to catch type errors and lint issues before they reach the main branches.

---
