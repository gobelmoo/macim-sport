import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'

config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL!)

const statements = [
  'CREATE INDEX "aer_event_id_idx" ON "athlete_event_registrations" USING btree ("eventId")',
  'CREATE INDEX "checkins_athlete_event_idx" ON "checkins" USING btree ("athleteId","eventId")',
  'CREATE INDEX "checkins_event_id_idx" ON "checkins" USING btree ("eventId")',
  'CREATE INDEX "checkins_checked_in_at_idx" ON "checkins" USING btree ("checkedInAt")',
  'CREATE INDEX "events_sponsor_id_idx" ON "events" USING btree ("sponsorId")',
  'CREATE INDEX "stamps_sponsor_id_idx" ON "stamps" USING btree ("sponsorId")',
  'CREATE INDEX "stamps_event_id_idx" ON "stamps" USING btree ("eventId")',
]

async function run() {
  for (const s of statements) {
    await sql.query(s)
    console.log('✅', s.slice(13, 80))
  }
  console.log('🎉 All indexes created.')
}

run().catch((err) => {
  console.error('❌', err.message)
  process.exit(1)
})
