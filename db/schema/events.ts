import { boolean, date, index, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { createdAtColumn, idColumn, statusEnum } from './_common'
import { sponsors } from './sponsors'

export const eventTypeEnum = pgEnum('event_type', [
  'run',
  'triathlon',
  'other',
])

export const eventStatusEnum = pgEnum('event_status', [
  'draft',
  'published',
  'active',
  'closed',
  'archived',
])

export const events = pgTable('events', {
  eventId: idColumn(),
  sponsorId: text()
    .notNull()
    .references(() => sponsors.sponsorId, { onDelete: 'restrict' }),
  eventName: text().notNull(),
  eventLocation: text().notNull(),
  eventCity: text().notNull(),
  eventType: eventTypeEnum().default('run').notNull(),
  organizerName: text().notNull(),
  startDate: date().notNull(),
  endDate: date().notNull(),
  isPublic: boolean().default(false).notNull(),
  hasParticipantImport: boolean().default(false).notNull(),
  status: eventStatusEnum().default('draft').notNull(),
  createdAt: createdAtColumn(),
}, (t) => [
  index('events_sponsor_id_idx').on(t.sponsorId),
])
