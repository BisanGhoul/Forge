import express from 'express'
import { config } from './config'
import { pool } from './db/pool'
import { runMigrations } from './db/migrate'

const app = express()
app.use(express.json())

app.get('/health', async (_req, res) => {
  await pool.query('SELECT 1')
  res.json({ status: 'ok', service: 'forge' })
})

async function start() {
  await runMigrations()
  app.listen(config.PORT, () => {
    console.log('forge running on port ' + config.PORT)
  })
}

start()