import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as athletes from './schema/athletes'
import * as athleteEventRegistrations from './schema/athlete_event_registrations'
import * as checkins from './schema/checkins'
import * as events from './schema/events'
import * as postMvp from './schema/post-mvp'
import * as sponsors from './schema/sponsors'
import * as stamps from './schema/stamps'
import * as stations from './schema/stations'
import * as users from './schema/users'
import * as line from './schema/line'

const url = process.env.DATABASE_URL
if (!url) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example → .env.local and fill in the Neon connection string.',
  )
}

const sql = neon(url)

export const db = drizzle(sql, {
  schema: {
    ...sponsors,
    ...users,
    ...events,
    ...stations,
    ...athletes,
    ...athleteEventRegistrations,
    ...checkins,
    ...stamps,
    ...postMvp,
    ...line,
  },
})

export type DB = typeof db
