import { pool } from '../pool'
import { Pipeline, PipelineWithSubscribers } from '../../types/pipeline'
import crypto from 'crypto'

export async function createPipeline(
  name: string,
  action_type: string,
  action_config: object,
  subscriberUrls: string[]
): Promise<PipelineWithSubscribers> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const source_token = crypto.randomBytes(16).toString('hex')

    const { rows } = await client.query<Pipeline>(
      `INSERT INTO pipelines (name, source_token, action_type, action_config)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, source_token, action_type, JSON.stringify(action_config)]
    )
    const pipeline = rows[0]

    const subscribers = []
    for (const url of subscriberUrls) {
      const { rows: subRows } = await client.query(
        'INSERT INTO subscribers (pipeline_id, url) VALUES ($1, $2) RETURNING *',
        [pipeline.id, url]
      )
      subscribers.push(subRows[0])
    }

    await client.query('COMMIT')
    return { ...pipeline, subscribers }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function getAllPipelines(): Promise<PipelineWithSubscribers[]> {
  const { rows: pipelines } = await pool.query<Pipeline>(
    'SELECT * FROM pipelines ORDER BY created_at DESC'
  )

  const result: PipelineWithSubscribers[] = []
  for (const pipeline of pipelines) {
    const { rows: subscribers } = await pool.query(
      'SELECT * FROM subscribers WHERE pipeline_id = $1',
      [pipeline.id]
    )
    result.push({ ...pipeline, subscribers })
  }
  return result
}

export async function getPipelineById(
  id: string
): Promise<PipelineWithSubscribers | null> {
  const { rows } = await pool.query<Pipeline>(
    'SELECT * FROM pipelines WHERE id = $1',
    [id]
  )
  if (rows.length === 0) return null

  const { rows: subscribers } = await pool.query(
    'SELECT * FROM subscribers WHERE pipeline_id = $1',
    [id]
  )
  return { ...rows[0], subscribers }
}

export async function getPipelineByToken(
  token: string
): Promise<PipelineWithSubscribers | null> {
  const { rows } = await pool.query<Pipeline>(
    'SELECT * FROM pipelines WHERE source_token = $1',
    [token]
  )
  if (rows.length === 0) return null

  const { rows: subscribers } = await pool.query(
    'SELECT * FROM subscribers WHERE pipeline_id = $1',
    [rows[0].id]
  )
  return { ...rows[0], subscribers }
}

export async function updatePipeline(
  id: string,
  updates: {
    name?: string
    action_type?: string
    action_config?: object
    is_active?: boolean
  }
): Promise<Pipeline | null> {
  const { rows } = await pool.query<Pipeline>(
    `UPDATE pipelines SET
      name = COALESCE($1, name),
      action_type = COALESCE($2, action_type),
      action_config = COALESCE($3, action_config),
      is_active = COALESCE($4, is_active),
      updated_at = NOW()
     WHERE id = $5 RETURNING *`,
    [
      updates.name,
      updates.action_type,
      updates.action_config ? JSON.stringify(updates.action_config) : null,
      updates.is_active,
      id,
    ]
  )
  return rows[0] ?? null
}

export async function deletePipeline(id: string): Promise<boolean> {
  const { rowCount } = await pool.query('DELETE FROM pipelines WHERE id = $1', [
    id,
  ])
  return (rowCount ?? 0) > 0
}
