import { Subscriber } from '../../types/pipeline'
import { Job } from '../../types/job'
import {
    createDeliveryAttempt,
    updateDeliveryAttempt,
} from '../../db/repositories/deliveryRepo'

const MAX_ATTEMPTS = 3
const RETRY_DELAYS_MS = [1000, 2000] // wait 1s before attempt 2, 2s before attempt 3

// Wait for a given number of milliseconds
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

// Deliver the job result to a single subscriber URL
// Retries up to MAX_ATTEMPTS times with delays between attempts
export async function deliverToSubscriber(
    job: Job,
    subscriber: Subscriber
): Promise<void> {
    // The payload we POST to the subscriber
    const body = JSON.stringify({
        job_id: job.id,
        pipeline_id: job.pipeline_id,
        result: job.result,
    })

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        // Wait before retrying (no wait on first attempt)
        if (attempt > 1) {
            const delay = RETRY_DELAYS_MS[attempt - 2]
            console.log(`delivery: retrying subscriber ${subscriber.url} (attempt ${attempt}, waiting ${delay}ms)`)
            await sleep(delay)
        }

        // Record this attempt in the DB
        const deliveryAttempt = await createDeliveryAttempt(
            job.id,
            subscriber.id,
            attempt
        )

        try {
            // POST the result to the subscriber URL
            const response = await fetch(subscriber.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
                signal: AbortSignal.timeout(10000), // 10 second timeout
            })

            const responseBody = await response.text()

            if (response.ok) {
                // Delivery succeeded
                await updateDeliveryAttempt(
                    deliveryAttempt.id,
                    'success',
                    response.status,
                    responseBody
                )
                console.log(`delivery: successfully delivered to ${subscriber.url} (${response.status})`)
                return // done, no more retries needed
            }

            // Subscriber returned a non-2xx status — treat as failure
            await updateDeliveryAttempt(
                deliveryAttempt.id,
                'failed',
                response.status,
                responseBody,
                `Subscriber returned ${response.status}`
            )
            console.error(`delivery: subscriber ${subscriber.url} returned ${response.status}`)

        } catch (err) {
            // Network error, timeout, etc.
            const message = err instanceof Error ? err.message : 'Unknown error'
            await updateDeliveryAttempt(
                deliveryAttempt.id,
                'failed',
                undefined,
                undefined,
                message
            )
            console.error(`delivery: failed to reach ${subscriber.url} — ${message}`)
        }
    }

    // All attempts exhausted
    console.error(`delivery: gave up delivering to ${subscriber.url} after ${MAX_ATTEMPTS} attempts`)
}

// Deliver to all subscribers of a job in parallel
export async function deliverToAllSubscribers(
    job: Job,
    subscribers: Subscriber[]
): Promise<void> {
    if (subscribers.length === 0) return

    console.log(`delivery: delivering job ${job.id} to ${subscribers.length} subscriber(s)`)

    // Deliver to all subscribers at the same time (parallel)
    await Promise.allSettled(
        subscribers.map((subscriber) => deliverToSubscriber(job, subscriber))
    )
}