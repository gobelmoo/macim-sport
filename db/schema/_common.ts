import { pgEnum, text, timestamp } from 'drizzle-orm/pg-core'

export const idColumn = () =>
  text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID())

export const createdAtColumn = () =>
  timestamp({ mode: 'date' }).defaultNow().notNull()

export const statusEnum = pgEnum('status', ['active', 'hidden', 'inactive'])
