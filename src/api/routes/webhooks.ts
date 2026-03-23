import { Router } from 'express'
import { z } from 'zod'
import { getPipelineByToken } from '../../db/repositories/pipelineRepo'
import { createJob } from '../../db/repositories/jobRepo'

const router = Router()

const WebhookPayloadSchema = z
  .object({
    text: z.string().min(1),
  })
  .passthrough()

router.post('/:token', async (req, res): Promise<void> => {
  try {
    const token = req.params['token'] as string

    const result = WebhookPayloadSchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({
        error: 'Invalid payload',
        details: result.error.flatten(),
      })
      return
    }

    const pipeline = await getPipelineByToken(token)
    if (!pipeline) {
      res.status(404).json({ error: 'Pipeline not found' })
      return
    }

    if (!pipeline.is_active) {
      res.status(409).json({ error: 'Pipeline is inactive' })
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
