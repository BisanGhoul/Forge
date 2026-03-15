import { pool } from './pool'
import fs from 'fs'
import path from 'path'

export async function runMigrations() {
  const sql = fs.readFileSync(
    path.join(__dirname, 'migrations/001_initial.sql'),
    'utf-8'
  )
  await pool.query(sql)
  console.log('migrations ran successfully')
}
