import { pool } from '../pool'
import { Job } from '../../types/job'

export async function createJob(
    pipeline_id: string,
    payload: Record<string, unknown>
): Promise<Job> {
    const { rows } = await pool.query<Job>(
        `INSERT INTO jobs (pipeline_id, payload, status)
     VALUES ($1, $2, 'pending')
     RETURNING *`,
        [pipeline_id, JSON.stringify(payload)]
    )
    return rows[0]
}

export async function getJobById(id: string): Promise<Job | null> {
    const { rows } = await pool.query<Job>(
        'SELECT * FROM jobs WHERE id = $1',
        [id]
    )
    return rows[0] ?? null
}

export async function getAllJobs(status?: string): Promise<Job[]> {
    if (status) {
        const { rows } = await pool.query<Job>(
            'SELECT * FROM jobs WHERE status = $1 ORDER BY created_at DESC',
            [status]
        )
        return rows
    }
    const { rows } = await pool.query<Job>(
        'SELECT * FROM jobs ORDER BY created_at DESC'
    )
    return rows
}

export async function getPendingJobs(): Promise<Job[]> {
    const { rows } = await pool.query<Job>(
        `SELECT * FROM jobs
     WHERE status = 'pending'
     ORDER BY created_at ASC
     LIMIT 10`
    )
    return rows
}

export async function updateJobStatus(
    id: string,
    status: string,
    result?: Record<string, unknown>,
    error_message?: string
): Promise<Job | null> {
    const { rows } = await pool.query<Job>(
        `UPDATE jobs SET
      status = $1,
      result = COALESCE($2, result),
      error_message = COALESCE($3, error_message),
      processed_at = CASE WHEN $1 IN ('done', 'failed') THEN NOW() ELSE processed_at END
     WHERE id = $4
     RETURNING *`,
        [
            status,
            result ? JSON.stringify(result) : null,
            error_message ?? null,
            id,
        ]
    )
    return rows[0] ?? null
}