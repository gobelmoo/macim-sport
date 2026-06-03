// POST-MVP Tables (9–24)
// สร้างไว้ใน Database ตั้งแต่แรก รอ activate Feature ทีหลัง
// รายละเอียด fields ครบถ้วนอยู่ใน MACIM_SPORT_System_Design_v4.docx

import { boolean, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { createdAtColumn, idColumn, statusEnum } from './_common'
import { athletes } from './athletes'
import { events } from './events'
import { sponsors } from './sponsors'
import { stations } from './stations'
import { users } from './users'

// Table 9: subscription_tiers
// โครงสร้าง Tier — ปัจจุบันทุก Sponsor ใช้ Level 1
export const subscriptionTiers = pgTable('subscription_tiers', {
  tierId: idColumn(),
  name: text().notNull(),
  level: integer().notNull(),
  description: text(),
  maxEvents: integer(),
  maxStations: integer(),
  features: jsonb(),
  status: statusEnum().default('active').notNull(),
  createdAt: createdAtColumn(),
})

// Table 10: event_sponsors
// Stamp Configuration ต่อ Sponsor ต่องาน
export const eventSponsors = pgTable('event_sponsors', {
  eventSponsorId: idColumn(),
  eventId: text()
    .notNull()
    .references(() => events.eventId, { onDelete: 'cascade' }),
  sponsorId: text()
    .notNull()
    .references(() => sponsors.sponsorId, { onDelete: 'cascade' }),
  stampScope: text().default('per_event').notNull(),
  stampRule: text().default('first_only').notNull(),
  maxStampsPerAthlete: integer(),
  config: jsonb(),
  createdAt: createdAtColumn(),
})

// Table 11: notification_preferences
// การตั้งค่า Notification ของนักกีฬา
export const notificationPreferences = pgTable('notification_preferences', {
  prefId: idColumn(),
  athleteId: text()
    .notNull()
    .references(() => athletes.athleteId, { onDelete: 'cascade' }),
  receiveCheckinNotif: boolean().default(true).notNull(),
  receiveStampNotif: boolean().default(true).notNull(),
  receiveRewardNotif: boolean().default(true).notNull(),
  receiveEventNotif: boolean().default(true).notNull(),
  updatedAt: timestamp({ mode: 'date' }).defaultNow().notNull(),
})

// Table 12: athlete_sponsors
// ความสัมพันธ์นักกีฬากับ Sponsor
export const athleteSponsors = pgTable('athlete_sponsors', {
  athleteSponsorId: idColumn(),
  athleteId: text()
    .notNull()
    .references(() => athletes.athleteId, { onDelete: 'cascade' }),
  sponsorId: text()
    .notNull()
    .references(() => sponsors.sponsorId, { onDelete: 'cascade' }),
  firstInteractionAt: timestamp({ mode: 'date' }).defaultNow().notNull(),
  totalStamps: integer().default(0).notNull(),
  createdAt: createdAtColumn(),
})

// Table 13: rewards
// Reward ที่ได้รับเมื่อสะสม Stamp ครบ Milestone
export const rewards = pgTable('rewards', {
  rewardId: idColumn(),
  athleteId: text()
    .notNull()
    .references(() => athletes.athleteId, { onDelete: 'restrict' }),
  sponsorId: text()
    .notNull()
    .references(() => sponsors.sponsorId, { onDelete: 'restrict' }),
  eventId: text().references(() => events.eventId, { onDelete: 'set null' }),
  milestoneId: text(),
  rewardType: text().notNull(),
  rewardDetail: jsonb(),
  claimedAt: timestamp({ mode: 'date' }),
  status: statusEnum().default('active').notNull(),
  createdAt: createdAtColumn(),
})

// Table 14: sponsor_blacklists
// Blacklist ระดับ Sponsor
export const sponsorBlacklists = pgTable('sponsor_blacklists', {
  blacklistId: idColumn(),
  sponsorId: text()
    .notNull()
    .references(() => sponsors.sponsorId, { onDelete: 'cascade' }),
  athleteId: text()
    .notNull()
    .references(() => athletes.athleteId, { onDelete: 'cascade' }),
  reason: text(),
  createdBy: text().references(() => users.userId, { onDelete: 'set null' }),
  createdAt: createdAtColumn(),
})

// Table 15: staff_event_assignments
// กำหนดงานที่ Staff ดูแล
export const staffEventAssignments = pgTable('staff_event_assignments', {
  assignmentId: idColumn(),
  userId: text()
    .notNull()
    .references(() => users.userId, { onDelete: 'cascade' }),
  eventId: text()
    .notNull()
    .references(() => events.eventId, { onDelete: 'cascade' }),
  stationId: text().references(() => stations.stationId, {
    onDelete: 'set null',
  }),
  assignedAt: createdAtColumn(),
})

// Table 16: notification_logs
// ประวัติ Notification ทั้งหมด
export const notificationLogs = pgTable('notification_logs', {
  logId: idColumn(),
  recipientId: text().notNull(),
  recipientType: text().notNull(),
  channel: text().notNull(),
  type: text().notNull(),
  content: text(),
  metadata: jsonb(),
  sentAt: timestamp({ mode: 'date' }).defaultNow().notNull(),
  status: text().default('sent').notNull(),
})

// Table 17: audit_logs
// บันทึกทุก Action ในระบบ
export const auditLogs = pgTable('audit_logs', {
  auditId: idColumn(),
  userId: text().references(() => users.userId, { onDelete: 'set null' }),
  action: text().notNull(),
  targetTable: text(),
  targetId: text(),
  before: jsonb(),
  after: jsonb(),
  ipAddress: text(),
  createdAt: createdAtColumn(),
})

// Table 18: assets
// ชุดอุปกรณ์ทางกายภาพของ MACIM
export const assets = pgTable('assets', {
  assetId: idColumn(),
  assetName: text().notNull(),
  assetType: text().notNull(),
  serialNumber: text(),
  description: text(),
  status: statusEnum().default('active').notNull(),
  createdAt: createdAtColumn(),
})

// Table 19: asset_bookings
// การจอง Asset สำหรับแต่ละงาน
export const assetBookings = pgTable('asset_bookings', {
  bookingId: idColumn(),
  assetId: text()
    .notNull()
    .references(() => assets.assetId, { onDelete: 'restrict' }),
  eventId: text()
    .notNull()
    .references(() => events.eventId, { onDelete: 'cascade' }),
  notes: text(),
  status: statusEnum().default('active').notNull(),
  createdAt: createdAtColumn(),
})

// Table 20: reward_milestones
// Milestone และของรางวัลตาม Sponsor
export const rewardMilestones = pgTable('reward_milestones', {
  milestoneId: idColumn(),
  sponsorId: text()
    .notNull()
    .references(() => sponsors.sponsorId, { onDelete: 'cascade' }),
  stampCount: integer().notNull(),
  rewardTitle: text().notNull(),
  rewardDescription: text(),
  rewardType: text().notNull(),
  rewardDetail: jsonb(),
  status: statusEnum().default('active').notNull(),
  createdAt: createdAtColumn(),
})

// Table 21: system_settings
// ค่า Default ของระบบ
export const systemSettings = pgTable('system_settings', {
  key: text().primaryKey(),
  value: text().notNull(),
  description: text(),
  updatedAt: timestamp({ mode: 'date' }).defaultNow().notNull(),
})

// Table 22: sponsor_settings
// การตั้งค่าของแต่ละ Sponsor
export const sponsorSettings = pgTable('sponsor_settings', {
  settingId: idColumn(),
  sponsorId: text()
    .notNull()
    .references(() => sponsors.sponsorId, { onDelete: 'cascade' }),
  key: text().notNull(),
  value: text().notNull(),
  updatedAt: timestamp({ mode: 'date' }).defaultNow().notNull(),
})

// Table 23: sponsor_consent_templates
// Privacy Policy และ PDPA ต่อ Sponsor
export const sponsorConsentTemplates = pgTable('sponsor_consent_templates', {
  templateId: idColumn(),
  sponsorId: text()
    .notNull()
    .references(() => sponsors.sponsorId, { onDelete: 'cascade' }),
  type: text().notNull(),
  content: text().notNull(),
  version: text().notNull(),
  isActive: boolean().default(false).notNull(),
  createdAt: createdAtColumn(),
})

// Table 24: message_templates
// Template ข้อความอัตโนมัติ
export const messageTemplates = pgTable('message_templates', {
  templateId: idColumn(),
  sponsorId: text().references(() => sponsors.sponsorId, {
    onDelete: 'cascade',
  }),
  triggerPoint: text().notNull(),
  channel: text().default('line').notNull(),
  content: text().notNull(),
  variables: jsonb(),
  isActive: boolean().default(false).notNull(),
  status: statusEnum().default('active').notNull(),
  createdAt: createdAtColumn(),
})
