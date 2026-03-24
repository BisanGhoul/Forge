import { getPendingJobs, updateJobStatus } from '../../db/repositories/jobRepo'
import { getPipelineById } from '../../db/repositories/pipelineRepo'
import { runAction, RegisteredActionType } from '../actions/index'
import { ActionConfigMap } from '../../types/pipeline'
import { deliverToAllSubscribers } from '../delivery/deliver'

// Processes a single job from start to finish
// Separated from the main loop so errors per-job are isolated
async function processOneJob(
    jobId: string,
    pipelineId: string,
    payload: Record<string, unknown>
): Promise<void> {
    // Step 1: Mark as processing so the worker doesn't pick it up again
    await updateJobStatus(jobId, 'processing')

    // Step 2: Get the pipeline to know which action to run and with what config
    const pipeline = await getPipelineById(pipelineId)
    if (!pipeline) {
        await updateJobStatus(jobId, 'failed', undefined, 'Pipeline not found')
        return
    }

    // Step 3: Run the correct action based on pipeline configuration
    const actionType = pipeline.action_type as RegisteredActionType
    const actionConfig = pipeline.action_config as ActionConfigMap[typeof actionType]

    console.log(`worker: running action "${actionType}" for job ${jobId}`)

    const result = await runAction(actionType, payload, actionConfig)

    // Step 4: Save the result and mark job as done
    await updateJobStatus(jobId, 'done', result)
    console.log(`worker: job ${jobId} completed successfully`)

    // Step 5: Deliver the result to all subscriber URLs
    const updatedJob = {
        id: jobId,
        pipeline_id: pipelineId,
        payload,
        result,
        status: 'done' as const,
        error_message: null,
        created_at: new Date(),
        processed_at: new Date(),
    }
    await deliverToAllSubscribers(updatedJob, pipeline.subscribers)
}

// Runs on every tick — fetches pending jobs and processes them one by one
async function tick(): Promise<void> {
    const jobs = await getPendingJobs()

    if (jobs.length === 0) return

    console.log(`worker: found ${jobs.length} pending job(s)`)

    for (const job of jobs) {
        try {
            await processOneJob(job.id, job.pipeline_id, job.payload)
        } catch (err) {
            // If one job fails, save the error and continue to the next job
            const message = err instanceof Error ? err.message : 'Unknown error'
            console.error(`worker: job ${job.id} failed — ${message}`)
            await updateJobStatus(job.id, 'failed', undefined, message)
        }
    }
}

// Called once on app startup — starts the polling loop
export function startWorker(): void {
    console.log('worker: started, polling every 5 seconds')

    // Run once immediately on startup to process any jobs left from before
    tick()

    // Then run every 5 seconds
    setInterval(tick, 5000)
}
