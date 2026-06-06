import { index, integer, pgTable, text } from 'drizzle-orm/pg-core'
import { createdAtColumn, idColumn } from './_common'
import { events } from './events'

export const eventGalleryImages = pgTable('event_gallery_images', {
  imageId: idColumn(),
  eventId: text()
    .notNull()
    .references(() => events.eventId, { onDelete: 'cascade' }),
  imageUrl: text().notNull(),
  caption: text(),
  sortOrder: integer().default(0).notNull(),
  createdAt: createdAtColumn(),
}, (t) => [
  index('gallery_images_event_id_idx').on(t.eventId),
])
