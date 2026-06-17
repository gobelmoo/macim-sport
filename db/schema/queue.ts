import { sql } from 'drizzle-orm'
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { createdAtColumn, idColumn, statusEnum } from './_common'
import { athletes } from './athletes'
import { athleteEventRegistrations } from './athlete_event_registrations'
import { events } from './events'
import { stations } from './stations'

export const queueEntryStatusEnum = pgEnum('queue_entry_status', [
  'waiting',
  'serving',
  'done',
  'skipped',
  'cancelled',
])

export const queueCounters = pgTable(
  'queue_counters',
  {
    counterId: idColumn(),
    eventId: text()
      .notNull()
      .references(() => events.eventId, { onDelete: 'cascade' }),
    // 1 station = 1 counter — ผูก counter เข้ากับ station เสมอ
    stationId: text()
      .notNull()
      .references(() => stations.stationId, { onDelete: 'cascade' }),
    counterName: text().notNull(),
    isOpen: boolean().default(false).notNull(),
    // เปลี่ยนทุกครั้งที่ reset → ทำให้ entry/ลิงก์สถานะของ session เก่าใช้ไม่ได้
    sessionId: text()
      .notNull()
      .$defaultFn(() => crypto.randomUUID()),
    // ตัวนับเลขคิวล่าสุด — เพิ่มแบบ atomic ตอน enqueue
    lastDisplayNumber: integer().default(0).notNull(),
    // rolling average ของเวลา serve (วินาที); null = ยังไม่มีประวัติ
    avgServiceSeconds: integer(),
    status: statusEnum().default('active').notNull(),
    createdAt: createdAtColumn(),
  },
  (t) => [uniqueIndex('queue_counters_station_idx').on(t.stationId)],
)

export const queueEntries = pgTable(
  'queue_entries',
  {
    entryId: idColumn(),
    counterId: text()
      .notNull()
      .references(() => queueCounters.counterId, { onDelete: 'cascade' }),
    sessionId: text().notNull(),
    // เลขคิวที่โชว์ ไม่เปลี่ยนตลอดอายุ entry
    displayNumber: integer().notNull(),
    // ลำดับการเรียก แยกจาก displayNumber (float ให้แทรกค่ากลางได้)
    sortSeq: doublePrecision().notNull(),
    entryStatus: queueEntryStatusEnum().default('waiting').notNull(),
    athleteId: text().references(() => athletes.athleteId, {
      onDelete: 'set null',
    }),
    registrationId: text().references(
      () => athleteEventRegistrations.registrationId,
      { onDelete: 'set null' },
    ),
    bibNumber: text(),
    // มีเฉพาะคิวที่ขอผ่าน LIFF → ใช้ตัดสินว่าส่ง flex/push ได้ไหม
    lineUserId: text(),
    isNonMember: boolean().default(false).notNull(),
    displayLabel: text(),
    // token สุ่มเดาไม่ได้ ใส่ในลิงก์ flex (กันเดา id ดูคิวคนอื่น)
    statusToken: text()
      .notNull()
      .$defaultFn(() => crypto.randomUUID()),
    enqueuedAt: timestamp({ mode: 'date' }).defaultNow().notNull(),
    calledAt: timestamp({ mode: 'date' }),
    completedAt: timestamp({ mode: 'date' }),
    createdAt: createdAtColumn(),
  },
  (t) => [
    index('queue_entries_counter_status_idx').on(t.counterId, t.entryStatus),
    uniqueIndex('queue_entries_status_token_idx').on(t.statusToken),
    // dedup: 1 active entry ต่อ athlete ต่อ counter
    uniqueIndex('queue_entries_active_athlete_idx')
      .on(t.counterId, t.athleteId)
      .where(
        sql`${t.entryStatus} in ('waiting','serving','skipped') and ${t.athleteId} is not null`,
      ),
    // dedup: 1 active entry ต่อ bib ต่อ counter
    uniqueIndex('queue_entries_active_bib_idx')
      .on(t.counterId, t.bibNumber)
      .where(
        sql`${t.entryStatus} in ('waiting','serving','skipped') and ${t.bibNumber} is not null`,
      ),
  ],
)
