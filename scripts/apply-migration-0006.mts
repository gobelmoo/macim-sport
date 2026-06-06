import { neon } from '@neondatabase/serverless'

const url = process.env.DATABASE_URL!
const sql = neon(url)

const statement = `ALTER TABLE "stations" DROP COLUMN "stampOnAddFriend"`

console.log('Executing:')
console.log(statement)

try {
  await sql.query(statement, [])
  console.log('\n✓ Migration 0006 applied — column "stampOnAddFriend" dropped from stations')
} catch (err: any) {
  if (
    err?.message?.includes('does not exist') ||
    err?.cause?.message?.includes('does not exist')
  ) {
    console.log('\n⚠ Skipped — column already dropped')
  } else {
    console.error('\n✗ ERROR:', err?.cause?.message || err?.message)
    throw err
  }
}
