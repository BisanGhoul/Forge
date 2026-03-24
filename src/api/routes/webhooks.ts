import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import crypto from 'crypto'
import { getPipelineByToken } from '../../db/repositories/pipelineRepo'
import { createJob } from '../../db/repositories/jobRepo'

const router = Router()

const WebhookPayloadSchema = z.object({
  text: z.string().min(1),
}).loose();

// ---------------------------------------------------------------------------
// Rate Limiting (in-memory, per IP)
// Max 30 requests per minute per IP address
// ---------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute
const RATE_LIMIT_MAX = 30

const ipHitMap = new Map<string, { count: number; windowStart: number }>()

function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip ?? 'unknown'
  const now = Date.now()
  const entry = ipHitMap.get(ip)

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    // New window
    ipHitMap.set(ip, { count: 1, windowStart: now })
    next()
    return
  }

  entry.count++
  if (entry.count > RATE_LIMIT_MAX) {
    res.status(429).json({
      error: 'Too many requests — please slow down',
      retryAfterMs: RATE_LIMIT_WINDOW_MS - (now - entry.windowStart),
    })
    return
  }

  next()
}

// ---------------------------------------------------------------------------
// Signature Verification (HMAC-SHA256)
// Header: X-Forge-Signature: <hex digest>
// Secret: the pipeline's source_token
// Signed message: the raw JSON request body string
// ---------------------------------------------------------------------------
function verifySignature(
  rawBody: string,
  secret: string,
  signatureHeader: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')

  try {
    // timingSafeEqual prevents timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader),
      Buffer.from(expected)
    )
  } catch {
    // Buffers were different lengths — definitely not a match
    return false
  }
}

// ---------------------------------------------------------------------------
// POST /webhooks/:token
// ---------------------------------------------------------------------------
router.post('/:token', rateLimiter, async (req, res): Promise<void> => {
  try {
    const token = req.params['token'] as string

    const pipeline = await getPipelineByToken(token)
    if (!pipeline) {
      res.status(404).json({ error: 'Pipeline not found' })
      return
    }

    if (!pipeline.is_active) {
      res.status(409).json({ error: 'Pipeline is inactive' })
      return
    }

    // If X-Forge-Signature is present, verify it
    // If absent, we accept the request (opt-in security)
    const signatureHeader = req.headers['x-forge-signature'] as string | undefined
    if (signatureHeader !== undefined) {
      const rawBody = JSON.stringify(req.body)
      if (!verifySignature(rawBody, pipeline.source_token, signatureHeader)) {
        res.status(401).json({ error: 'Invalid webhook signature' })
        return
      }
    }

    const result = WebhookPayloadSchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({
        error: 'Invalid payload',
        details: result.error.flatten(),
      })
      return
    }

    const job = await createJob(pipeline.id, result.data)

    res.status(202).json({
      message: 'Webhook received and queued for processing',
      job_id: job.id,
    })
  } catch (_err) {
    res.status(500).json({ error: 'Failed to process webhook' })
  }
})

export default router
