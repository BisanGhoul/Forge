import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middleware/validate'
import * as pipelineRepo from '../../db/repositories/pipelineRepo'

const router = Router()

const CreatePipelineSchema = z.object({
  name: z.string().min(1),
  action_type: z.enum(['summarize', 'translate', 'tag_extract']),
  action_config: z.record(z.string(), z.unknown()).default({}),
  subscriber_urls: z.array(z.url()).min(1),
})

const UpdatePipelineSchema = z.object({
  name: z.string().min(1).optional(),
  action_type: z.enum(['summarize', 'translate', 'tag_extract']).optional(),
  action_config: z.record(z.string(), z.unknown()).optional(),
  is_active: z.boolean().optional(),
})

router.post(
  '/',
  validate(CreatePipelineSchema),
  async (req, res): Promise<void> => {
    try {
      const { name, action_type, action_config, subscriber_urls } = req.body
      const pipeline = await pipelineRepo.createPipeline(
        name,
        action_type,
        action_config,
        subscriber_urls
      )
      res.status(201).json(pipeline)
    } catch (err) {
      res.status(500).json({ error: 'Failed to create pipeline' })
    }
  }
)

router.get('/', async (_req, res): Promise<void> => {
  try {
    const pipelines = await pipelineRepo.getAllPipelines()
    res.json(pipelines)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pipelines' })
  }
})

router.get('/:id', async (req, res): Promise<void> => {
  try {
    const pipeline = await pipelineRepo.getPipelineById(
      req.params['id'] as string
    )
    if (!pipeline) {
      res.status(404).json({ error: 'Pipeline not found' })
      return
    }
    res.json(pipeline)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pipeline' })
  }
})

router.put(
  '/:id',
  validate(UpdatePipelineSchema),
  async (req, res): Promise<void> => {
    try {
      const id = req.params['id'] as string
      const pipeline = await pipelineRepo.updatePipeline(id, req.body)
      if (!pipeline) {
        res.status(404).json({ error: 'Pipeline not found' })
        return
      }
      res.json(pipeline)
    } catch (err) {
      res.status(500).json({ error: 'Failed to update pipeline' })
    }
  }
)

router.delete('/:id', async (req, res): Promise<void> => {
  try {
    const deleted = await pipelineRepo.deletePipeline(
      req.params['id'] as string
    )
    if (!deleted) {
      res.status(404).json({ error: 'Pipeline not found' })
      return
    }
    res.status(204).send()
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete pipeline' })
  }
})

export default router
