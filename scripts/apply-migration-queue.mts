import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'

const url = process.env.DATABASE_URL!
const sql = neon(url)

const migrationSql = readFileSync('./db/migrations/0009_thankful_shotgun.sql', 'utf-8')

const statements = migrationSql
  .split('--> statement-breakpoint')
  .map((s) => s.trim())
  .filter((s) => s.length > 0)

console.log(`Found ${statements.length} SQL statements to execute`)

for (let i = 0; i < statements.length; i++) {
  const statement = statements[i]
  console.log(`\n[${i + 1}/${statements.length}] Executing:`)
  console.log(statement.substring(0, 100) + (statement.length > 100 ? '...' : ''))
  try {
    await sql.query(statement, [])
    console.log('  ✓ OK')
  } catch (err: any) {
    if (
      err?.message?.includes('already exists') ||
      err?.cause?.message?.includes('already exists')
    ) {
      console.log('  ⚠ Skipped (already exists)')
    } else {
      console.error('  ✗ ERROR:', err?.cause?.message || err?.message)
      throw err
    }
  }
}

console.log('\n✓ Queue migration applied successfully')
