import express from 'express'
import { config } from './config'
import { pool } from './db/pool'
import { runMigrations } from './db/migrate'
import pipelineRoutes from './api/routes/pipelines'
import webhookRoutes from './api/routes/webhooks'
import jobRoutes from './api/routes/jobs'
import { errorHandler } from './api/middleware/errorHandler'
import { startWorker } from './core/worker/worker'

const app = express()
app.use(express.json())

app.use('/pipelines', pipelineRoutes)
app.use('/webhooks', webhookRoutes)
app.use('/jobs', jobRoutes)

app.get('/health', async (_req, res) => {
  await pool.query('SELECT 1')
  res.json({ status: 'ok', service: 'forge' })
})

app.use(errorHandler)

async function start() {
  await runMigrations()

  // Start the background worker loop
  startWorker()

  // Start accepting HTTP requests
  app.listen(config.PORT, () => {
    console.log('forge running on port ' + config.PORT)
  })
}

start()
