import { boolean, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { idColumn } from './_common'
import { athletes } from './athletes'
import { events } from './events'
import { stations } from './stations'

export const checkins = pgTable('checkins', {
  checkinId: idColumn(),
  athleteId: text()
    .notNull()
    .references(() => athletes.athleteId, { onDelete: 'restrict' }),
  stationId: text()
    .notNull()
    .references(() => stations.stationId, { onDelete: 'restrict' }),
  eventId: text()
    .notNull()
    .references(() => events.eventId, { onDelete: 'restrict' }),
  bibNumber: text().notNull(),
  checkedInAt: timestamp({ mode: 'date' }).defaultNow().notNull(),
  isNewAthlete: boolean().default(false).notNull(),
  isDuplicate: boolean().default(false).notNull(),
}, (t) => [
  index('checkins_athlete_event_idx').on(t.athleteId, t.eventId),
  index('checkins_event_id_idx').on(t.eventId),
  index('checkins_checked_in_at_idx').on(t.checkedInAt),
])
