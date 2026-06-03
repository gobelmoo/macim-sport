import { boolean, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { createdAtColumn, idColumn, statusEnum } from './_common'
import { events } from './events'

export const stationTypeEnum = pgEnum('station_type', [
  'air_recovery',
  'ice_bath',
  'other',
])

export const stations = pgTable('stations', {
  stationId: idColumn(),
  eventId: text()
    .notNull()
    .references(() => events.eventId, { onDelete: 'cascade' }),
  stationType: stationTypeEnum().notNull(),
  stationName: text().notNull(),
  stampOnAddFriend: boolean().default(false).notNull(),
  status: statusEnum().default('active').notNull(),
  createdAt: createdAtColumn(),
})
