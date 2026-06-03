import { date, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { createdAtColumn, idColumn, statusEnum } from './_common'

export const genderEnum = pgEnum('gender', ['male', 'female', 'other'])

export const athletes = pgTable('athletes', {
  athleteId: idColumn(),
  firstName: text().notNull(),
  lastName: text().notNull(),
  dateOfBirth: date().notNull(),
  gender: genderEnum().notNull(),
  lineUserId: text(),
  // POST-MVP fields (nullable — activate later)
  phoneNumber: text(),
  addressNo: text(),
  addressMoo: text(),
  addressSoi: text(),
  addressRoad: text(),
  addressSubdistrict: text(),
  addressDistrict: text(),
  addressProvince: text(),
  addressPostcode: text(),
  status: statusEnum().default('active').notNull(),
  createdAt: createdAtColumn(),
})
