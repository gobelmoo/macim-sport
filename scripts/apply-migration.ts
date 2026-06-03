import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'

config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL!)

async function applyMigrations() {
  const migrationsDir = join(process.cwd(), 'db/migrations')
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    console.log(`Applying migration: ${file}`)
    const content = readFileSync(join(migrationsDir, file), 'utf8')
    // Split on statement-level; neon HTTP driver runs one statement at a time
    const statements = content
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean)

    for (const statement of statements) {
      await sql.query(statement)
    }
    console.log(`✅ ${file} applied`)
  }

  console.log('🎉 All migrations applied.')
}

applyMigrations().catch((err) => {
  console.error('❌ Migration failed:', err)
  process.exit(1)
})
