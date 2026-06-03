import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'
import { randomUUID } from 'crypto'

config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL!)
const EVENT_ID = '9267655c-f3de-49a8-8195-e214a833b229'

async function run() {
  const athleteId = randomUUID()

  // Insert athlete
  await sql`
    INSERT INTO athletes ("athleteId","firstName","lastName","dateOfBirth","gender","status","createdAt")
    VALUES (${athleteId},'สมชาย','ใจดี','1990-01-01','male','active',NOW())
  `
  console.log('✅ Created athlete:', athleteId)

  // Register in event with BIB 1001
  const regId = randomUUID()
  await sql`
    INSERT INTO athlete_event_registrations ("registrationId","athleteId","eventId","bibNumber","status","registeredAt")
    VALUES (${regId},${athleteId},${EVENT_ID},'1001','active',NOW())
  `
  console.log('✅ Registered athlete with BIB 1001 in event', EVENT_ID)
}

run().catch((e) => { console.error(e); process.exit(1) })
