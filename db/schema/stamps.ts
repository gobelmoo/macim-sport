import { pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { idColumn } from './_common'
import { athletes } from './athletes'
import { events } from './events'
import { sponsors } from './sponsors'
import { stations } from './stations'

export const stampSourceEnum = pgEnum('stamp_source', [
  'check_in',
  'add_friend',
])

export const stamps = pgTable('stamps', {
  stampId: idColumn(),
  athleteId: text()
    .notNull()
    .references(() => athletes.athleteId, { onDelete: 'restrict' }),
  eventId: text()
    .notNull()
    .references(() => events.eventId, { onDelete: 'restrict' }),
  stationId: text().references(() => stations.stationId, {
    onDelete: 'set null',
  }),
  sponsorId: text()
    .notNull()
    .references(() => sponsors.sponsorId, { onDelete: 'restrict' }),
  stampSource: stampSourceEnum().notNull(),
  stampedAt: timestamp({ mode: 'date' }).defaultNow().notNull(),
})
