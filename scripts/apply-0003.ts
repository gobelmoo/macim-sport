import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'

config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL!)

async function run() {
  await sql.query("ALTER TYPE \"public\".\"status\" ADD VALUE 'inactive'")
  console.log('✅ migration 0003 applied — inactive added to status enum')
}

run().catch((err) => {
  console.error('❌ Failed:', err.message)
  process.exit(1)
})
