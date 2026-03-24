import { pool } from '../pool'
import { DeliveryAttempt } from '../../types/job'

// Save a new delivery attempt to the DB
export async function createDeliveryAttempt(
    job_id: string,
    subscriber_id: string,
    attempt_number: number
): Promise<DeliveryAttempt> {
    const { rows } = await pool.query<DeliveryAttempt>(
        `INSERT INTO delivery_attempts (job_id, subscriber_id, attempt_number, status)
     VALUES ($1, $2, $3, 'pending')
     RETURNING *`,
        [job_id, subscriber_id, attempt_number]
    )
    return rows[0]
}

// Update a delivery attempt with the result
export async function updateDeliveryAttempt(
    id: string,
    status: string,
    response_code?: number,
    response_body?: string,
    error_message?: string
): Promise<DeliveryAttempt | null> {
    const { rows } = await pool.query<DeliveryAttempt>(
        `UPDATE delivery_attempts SET
      status = $1,
      response_code = COALESCE($2, response_code),
      response_body = COALESCE($3, response_body),
      error_message = COALESCE($4, error_message)
     WHERE id = $5
     RETURNING *`,
        [status, response_code ?? null, response_body ?? null, error_message ?? null, id]
    )
    return rows[0] ?? null
}

// Get all delivery attempts for a specific job
export async function getDeliveryAttemptsByJobId(
    job_id: string
): Promise<DeliveryAttempt[]> {
    const { rows } = await pool.query<DeliveryAttempt>(
        `SELECT * FROM delivery_attempts
     WHERE job_id = $1
     ORDER BY attempted_at ASC`,
        [job_id]
    )
    return rows
}