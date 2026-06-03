import { pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'
import { idColumn, statusEnum } from './_common'
import { athletes } from './athletes'
import { events } from './events'

export const athleteEventRegistrations = pgTable(
  'athlete_event_registrations',
  {
    registrationId: idColumn(),
    athleteId: text().references(() => athletes.athleteId, {
      onDelete: 'set null',
    }),
    eventId: text()
      .notNull()
      .references(() => events.eventId, { onDelete: 'cascade' }),
    bibNumber: text().notNull(),
    profileImageUrl: text(),
    registeredAt: timestamp({ mode: 'date' }).defaultNow().notNull(),
    status: statusEnum().default('active').notNull(),
  },
  (t) => [unique().on(t.bibNumber, t.eventId)],
)
