import { boolean, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { createdAtColumn, idColumn, statusEnum } from './_common'

export const serviceTypeEnum = pgEnum('service_type', [
  'physical_and_digital',
  'digital_only',
])

export const sponsors = pgTable('sponsors', {
  sponsorId: idColumn(),
  sponsorName: text().notNull(),
  companyRegNumber: text().notNull(),
  addressNo: text(),
  addressMoo: text(),
  addressSoi: text(),
  addressRoad: text(),
  addressSubdistrict: text(),
  addressDistrict: text(),
  addressProvince: text(),
  addressPostcode: text(),
  isInternal: boolean().default(false).notNull(),
  serviceType: serviceTypeEnum().default('physical_and_digital').notNull(),
  contactName: text().notNull(),
  contactEmail: text().notNull(),
  logoUrl: text(),
  brandColor: text(),
  status: statusEnum().default('active').notNull(),
  createdAt: createdAtColumn(),
})
