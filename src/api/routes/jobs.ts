import { Router } from 'express'
import { getAllJobs, getJobById } from '../../db/repositories/jobRepo'
import { getDeliveryAttemptsByJobId } from '../../db/repositories/deliveryRepo'

const router = Router()

// GET /jobs?status=pending|processing|done|failed
// Returns all jobs, optionally filtered by status
router.get('/', async (req, res): Promise<void> => {
    try {
        const status = req.query['status'] as string | undefined
        const jobs = await getAllJobs(status)
        res.json(jobs)
    } catch (_err) {
        res.status(500).json({ error: 'Failed to fetch jobs' })
    }
})

// GET /jobs/:id
// Returns a single job by ID
router.get('/:id', async (req, res): Promise<void> => {
    try {
        const job = await getJobById(req.params['id'] as string)
        if (!job) {
            res.status(404).json({ error: 'Job not found' })
            return
        }
        res.json(job)
    } catch (_err) {
        res.status(500).json({ error: 'Failed to fetch job' })
    }
})

// GET /jobs/:id/deliveries
// Returns all delivery attempts for a specific job
router.get('/:id/deliveries', async (req, res): Promise<void> => {
    try {
        const job = await getJobById(req.params['id'] as string)
        if (!job) {
            res.status(404).json({ error: 'Job not found' })
            return
        }

        const attempts = await getDeliveryAttemptsByJobId(req.params['id'] as string)
        res.json(attempts)
    } catch (_err) {
        res.status(500).json({ error: 'Failed to fetch delivery attempts' })
    }
})

export default router