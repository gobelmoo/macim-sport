import { boolean, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { events } from './events'
import { athletes } from './athletes'

export const lineStateEnum = pgEnum('line_state', [
  'idle',
  'awaiting_event',
  'awaiting_bib',
  'awaiting_confirm',
  'awaiting_consent',
  'done',
])

export const lineSessions = pgTable('line_sessions', {
  lineUserId: text().primaryKey(),
  state: lineStateEnum().notNull().default('idle'),
  eventId: text().references(() => events.eventId, { onDelete: 'set null' }),
  bibNumber: text(),
  updatedAt: timestamp({ mode: 'date' }).defaultNow().notNull(),
})

export const athleteConsents = pgTable('athlete_consents', {
  consentId: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  athleteId: text()
    .notNull()
    .references(() => athletes.athleteId, { onDelete: 'cascade' }),
  consentVersion: text().notNull(),
  pdpaAccepted: boolean().notNull(),
  marketingAccepted: boolean().notNull().default(false),
  consentedAt: timestamp({ mode: 'date' }).defaultNow().notNull(),
})
