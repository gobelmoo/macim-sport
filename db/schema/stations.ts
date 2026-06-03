import { boolean, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { createdAtColumn, idColumn } from './_common'
import { events } from './events'

export const stationTypeEnum = pgEnum('station_type', [
  'air_recovery',
  'ice_bath',
  'other',
])

export const stationStatusEnum = pgEnum('station_status', ['active', 'inactive'])

export const stations = pgTable('stations', {
  stationId: idColumn(),
  eventId: text()
    .notNull()
    .references(() => events.eventId, { onDelete: 'cascade' }),
  stationType: stationTypeEnum().notNull(),
  stationName: text().notNull(),
  stampOnAddFriend: boolean().default(false).notNull(),
  status: stationStatusEnum().default('active').notNull(),
  createdAt: createdAtColumn(),
})
