import { pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { createdAtColumn, idColumn, statusEnum } from './_common'
import { sponsors } from './sponsors'

export const userRoleEnum = pgEnum('user_role', [
  'super_admin_owner',
  'super_admin_manager',
  'super_admin_viewer',
  'sponsor_admin',
  'sponsor_staff',
])

export const users = pgTable('users', {
  userId: idColumn(),
  email: text().unique().notNull(),
  passwordHash: text().notNull(),
  phoneNumber: text(),
  role: userRoleEnum().notNull(),
  sponsorId: text().references((): AnyPgColumn => sponsors.sponsorId, {
    onDelete: 'set null',
  }),
  lineUserId: text(),
  status: statusEnum().default('active').notNull(),
  createdAt: createdAtColumn(),
  lastLoginAt: timestamp({ mode: 'date' }),
  ipAddress: text(),
})
