export type JobStatus = 'pending' | 'processing' | 'done' | 'failed'

export interface Job {
    id: string
    pipeline_id: string
    payload: Record<string, unknown>
    result: Record<string, unknown> | null
    status: JobStatus
    error_message: string | null
    created_at: Date
    processed_at: Date | null
}

export interface DeliveryAttempt {
    id: string
    job_id: string
    subscriber_id: string
    status: string
    attempt_number: number
    response_code: number | null
    response_body: string | null
    error_message: string | null
    attempted_at: Date
}