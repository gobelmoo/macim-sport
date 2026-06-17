# Station Queue (จองคิว) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มระบบจองคิวที่หน้า station — นักกีฬาสแกน QR เปิด LINE LIFF เพื่อรับเลขคิว (พร้อมลงทะเบียน/สมัครสมาชิกถ้ายังไม่มี) ได้ flex message พร้อมลิงก์ดูสถานะคิว/เวลาประมาณการรอ และแอดมินคุมการเรียกคิวจากกระดานคุมคิว

**Architecture:** เพิ่ม 2 ตาราง (`queue_counters`, `queue_entries`) แยกจาก stations check-in โดยแต่ละ event มีได้หลายจุดบริการคิว (counter) แต่ละจุดมีลำดับเลขคิวของตัวเอง. แยก `displayNumber` (เลขที่โชว์ ไม่เปลี่ยน) ออกจาก `sortSeq` (ลำดับการเรียก แทรกคิวได้). dedup ด้วย partial unique index. ETA = rolling average ของเวลา serve จริง. หน้า status เป็น public route ที่ poll สถานะทุก ~7 วิ. Reuse: station-token pattern (JWT), `registerViaLine` helpers, LINE flex/push, RBAC, ConfirmActionButton.

**Tech Stack:** Next.js 16 (App Router) · React 19 · Drizzle ORM 0.45 + Neon (neon-http) · jose (JWT) · vitest · qrcode.react · shadcn/ui · LINE LIFF/Messaging API

---

## File Structure

สร้างใหม่:
- `db/schema/queue.ts` — ตาราง `queue_counters`, `queue_entries`, enum + index
- `lib/queue-core.ts` — ตรรกะบริสุทธิ์ (ETA, rolling average, sortSeq การแทรกคิว) — มี unit test
- `lib/queue-token.ts` — sign/verify JWT ของ counter (สำหรับ QR/LIFF)
- `db/queries/queue.ts` — query/mutation ทั้งหมด (counters CRUD, enqueue atomic+dedup, board, next/skip/requeue/reset, status)
- `app/(dashboard)/dashboard/events/[id]/queue/page.tsx` — หน้าจัดการ counters + QR
- `app/(dashboard)/dashboard/events/[id]/queue/actions.ts` — create/delete counter
- `app/(dashboard)/dashboard/events/[id]/queue/_components/counter-create-form.tsx`
- `app/(dashboard)/dashboard/events/[id]/queue/_components/queue-qr-button.tsx`
- `app/(dashboard)/dashboard/events/[id]/queue/[counterId]/board/page.tsx` — กระดานคุมคิว (server)
- `app/(dashboard)/dashboard/events/[id]/queue/[counterId]/board/actions.ts` — toggle/reset/next/skip/requeue/add
- `app/(dashboard)/dashboard/events/[id]/queue/[counterId]/board/_components/queue-board.tsx` — client (auto-refresh)
- `app/(liff)/queue/[token]/page.tsx` — LIFF ขอคิว
- `app/(liff)/queue/[token]/actions.ts` — `getQueueContext`, `requestQueue`
- `app/(liff)/queue/[token]/_components/queue-request.tsx` — client (LIFF init + form 3 เคส)
- `app/(queue-status)/q/[token]/page.tsx` — หน้า status (public)
- `app/(queue-status)/q/[token]/_components/status-view.tsx` — client (polling)
- `app/api/queue/status/[token]/route.ts` — GET คืน status JSON สำหรับ poll
- `tests/queue-core.test.ts` — unit test ของ `lib/queue-core.ts`

แก้ไข:
- `db/index.ts` — register schema `queue`
- `lib/rbac.ts` — เพิ่ม `QUEUE_MANAGE`, `QUEUE_OPERATE`
- `lib/line-messages.ts` — เพิ่ม `queueTicketMessage`
- `app/(dashboard)/dashboard/events/[id]/page.tsx` (หรือเมนู event detail) — เพิ่มลิงก์ "จัดการคิว"

> **หมายเหตุ pattern:** โปรเจกต์นี้ไม่มี unit test สำหรับ DB query หรือ React component (มีแค่ test ของ pure logic ใน `tests/`). แผนนี้จึงทำ TDD เฉพาะ `lib/queue-core.ts` (pure) ส่วน task อื่นตรวจด้วย `pnpm typecheck` + `pnpm lint` แล้วตรวจมือ ตาม pattern เดิมของ repo

---

## Task 1: Schema ตารางคิว

**Files:**
- Create: `db/schema/queue.ts`
- Modify: `db/index.ts`

- [ ] **Step 1: เขียน schema**

สร้าง `db/schema/queue.ts`:

```ts
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

export const queueEntryStatusEnum = pgEnum('queue_entry_status', [
  'waiting',
  'serving',
  'done',
  'skipped',
  'cancelled',
])

export const queueCounters = pgTable('queue_counters', {
  counterId: idColumn(),
  eventId: text()
    .notNull()
    .references(() => events.eventId, { onDelete: 'cascade' }),
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
})

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
```

- [ ] **Step 2: register schema ใน db client**

แก้ `db/index.ts` — เพิ่ม import และ spread เข้า `schema` (วางต่อจาก `line`):

```ts
import * as line from './schema/line'
import * as queue from './schema/queue'
```

และใน object `schema`:

```ts
    ...line,
    ...queue,
```

- [ ] **Step 3: generate migration**

Run: `pnpm db:generate`
Expected: สร้างไฟล์ SQL ใหม่ใน `db/migrations/` (เช่น `0007_*.sql`) ที่มี `CREATE TABLE queue_counters`, `CREATE TABLE queue_entries`, `CREATE TYPE queue_entry_status`

- [ ] **Step 4: ตรวจ partial unique index ใน SQL ที่ generate**

เปิดไฟล์ migration ใหม่ ตรวจว่ามี `CREATE UNIQUE INDEX ... WHERE (...)` สำหรับ `queue_entries_active_athlete_idx` และ `queue_entries_active_bib_idx` (มี `WHERE` clause จริง). ถ้า drizzle-kit ไม่ใส่ `WHERE` ให้เติม clause เองในไฟล์ SQL:

```sql
CREATE UNIQUE INDEX "queue_entries_active_athlete_idx" ON "queue_entries" ("counter_id","athlete_id")
  WHERE "entry_status" in ('waiting','serving','skipped') and "athlete_id" is not null;
CREATE UNIQUE INDEX "queue_entries_active_bib_idx" ON "queue_entries" ("counter_id","bib_number")
  WHERE "entry_status" in ('waiting','serving','skipped') and "bib_number" is not null;
```

- [ ] **Step 5: เขียน surgical apply script (⚠️ ห้ามใช้ `pnpm db:push`)**

> **อันตราย:** `pnpm db:push` ในโปรเจกต์นี้จะ **truncate `athlete_event_registrations`** (ข้อมูลลงทะเบียน production หาย). ต้อง apply migration แบบ surgical ทีละ statement เท่านั้น ตาม pattern `scripts/apply-migration-0002.mts`

สร้าง `scripts/apply-migration-queue.mts` (เปลี่ยน `<MIGRATION_FILE>` เป็นชื่อไฟล์ที่ `db:generate` สร้างใน Step 3 เช่น `0007_xxx.sql`):

```ts
import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'

const url = process.env.DATABASE_URL!
const sql = neon(url)

const migrationSql = readFileSync('./db/migrations/<MIGRATION_FILE>', 'utf-8')

const statements = migrationSql
  .split('--> statement-breakpoint')
  .map((s) => s.trim())
  .filter((s) => s.length > 0)

console.log(`Found ${statements.length} SQL statements to execute`)

for (let i = 0; i < statements.length; i++) {
  const statement = statements[i]
  console.log(`\n[${i + 1}/${statements.length}] Executing:`)
  console.log(statement.substring(0, 100) + (statement.length > 100 ? '...' : ''))
  try {
    await sql.query(statement, [])
    console.log('  ✓ OK')
  } catch (err: any) {
    if (
      err?.message?.includes('already exists') ||
      err?.cause?.message?.includes('already exists')
    ) {
      console.log('  ⚠ Skipped (already exists)')
    } else {
      console.error('  ✗ ERROR:', err?.cause?.message || err?.message)
      throw err
    }
  }
}

console.log('\n✓ Queue migration applied successfully')
```

- [ ] **Step 6: ตรวจ statement ก่อนรัน แล้วรัน surgical apply**

เปิดไฟล์ migration ที่ generate มา อ่านทุก statement — ต้องเป็น `CREATE TABLE/TYPE/INDEX` ของ queue เท่านั้น. **ถ้าเห็น `DROP`/`ALTER`/`TRUNCATE` ที่แตะตารางอื่น (โดยเฉพาะ `athlete_event_registrations`) ให้ลบ statement นั้นออกจากไฟล์ก่อน** แล้วรัน:

Run: `pnpm tsx --env-file=.env.local scripts/apply-migration-queue.mts`
Expected: ทุก statement ขึ้น `✓ OK` สร้าง `queue_counters`, `queue_entries`, type `queue_entry_status` + index ครบ

- [ ] **Step 7: ตรวจตารางถูกสร้าง**

Run: `pnpm tsx --env-file=.env.local -e "import('@neondatabase/serverless').then(async({neon})=>{const s=neon(process.env.DATABASE_URL);console.log(await s\`select count(*) from queue_counters\`)})"`
Expected: คืน `[{ count: '0' }]` (ตารางมีจริง ว่างเปล่า)

- [ ] **Step 8: typecheck**

Run: `pnpm typecheck`
Expected: ไม่มี error

- [ ] **Step 9: commit**

```bash
git add db/schema/queue.ts db/index.ts db/migrations scripts/apply-migration-queue.mts
git commit -m "feat(queue): add queue_counters and queue_entries schema"
```

---

## Task 2: Pure core logic (TDD)

**Files:**
- Create: `lib/queue-core.ts`
- Test: `tests/queue-core.test.ts`

- [ ] **Step 1: เขียน test ที่ fail**

สร้าง `tests/queue-core.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SERVICE_SECONDS,
  effectiveServiceSeconds,
  estimateWaitSeconds,
  nextRollingAverage,
  requeueSortSeq,
} from '@/lib/queue-core'

describe('effectiveServiceSeconds', () => {
  it('คืน avg เมื่อมีค่า', () => {
    expect(effectiveServiceSeconds(300)).toBe(300)
  })
  it('คืน default เมื่อ null', () => {
    expect(effectiveServiceSeconds(null)).toBe(DEFAULT_SERVICE_SECONDS)
  })
})

describe('estimateWaitSeconds', () => {
  it('peopleAhead × service', () => {
    expect(estimateWaitSeconds(3, 120)).toBe(360)
  })
  it('คิวข้างหน้า 0 → 0', () => {
    expect(estimateWaitSeconds(0, 120)).toBe(0)
  })
  it('ใช้ default เมื่อ avg null', () => {
    expect(estimateWaitSeconds(2, null)).toBe(2 * DEFAULT_SERVICE_SECONDS)
  })
})

describe('nextRollingAverage', () => {
  it('ค่าแรก (prev null) = sample', () => {
    expect(nextRollingAverage(null, 200)).toBe(200)
  })
  it('EMA: 0.3*sample + 0.7*prev', () => {
    // 0.3*200 + 0.7*100 = 60 + 70 = 130
    expect(nextRollingAverage(100, 200)).toBe(130)
  })
  it('ปัดเป็นจำนวนเต็ม', () => {
    // 0.3*101 + 0.7*100 = 30.3 + 70 = 100.3 → 100
    expect(nextRollingAverage(100, 101)).toBe(100)
  })
  it('ตัด sample ที่ผิดปกติ (ติดลบ/ใหญ่เกิน) ทิ้ง คืน prev', () => {
    expect(nextRollingAverage(100, -5)).toBe(100)
    expect(nextRollingAverage(100, 999999)).toBe(100)
  })
})

describe('requeueSortSeq', () => {
  it('ไม่มี waiting อื่น → ถัดจาก serving', () => {
    expect(requeueSortSeq(5, null)).toBe(6)
  })
  it('ไม่มี serving และไม่มี waiting → 0', () => {
    expect(requeueSortSeq(null, null)).toBe(0)
  })
  it('แทรกระหว่าง serving กับ waiting ตัวแรก', () => {
    // serving=5, minWaiting=10 → 7.5
    expect(requeueSortSeq(5, 10)).toBe(7.5)
  })
  it('serving null → ก่อน waiting ตัวแรก', () => {
    // serving=null, minWaiting=10 → 9
    expect(requeueSortSeq(null, 10)).toBe(9)
  })
})
```

- [ ] **Step 2: รัน test ให้เห็นว่า fail**

Run: `pnpm test queue-core`
Expected: FAIL — "Cannot find module '@/lib/queue-core'" / ฟังก์ชันไม่นิยาม

- [ ] **Step 3: เขียน implementation**

สร้าง `lib/queue-core.ts`:

```ts
/** ค่า default เวลา serve ต่อคิว (วินาที) ใช้ตอนยังไม่มีประวัติจริง */
export const DEFAULT_SERVICE_SECONDS = 600

/** น้ำหนัก EMA ของ sample ใหม่ */
const ROLLING_ALPHA = 0.3

/** ขอบเขต sample ที่สมเหตุสมผล (วินาที) — กันค่าผิดปกติทำลายค่าเฉลี่ย */
const MIN_SAMPLE_SECONDS = 1
const MAX_SAMPLE_SECONDS = 60 * 60

export function effectiveServiceSeconds(avg: number | null): number {
  return avg ?? DEFAULT_SERVICE_SECONDS
}

export function estimateWaitSeconds(
  peopleAhead: number,
  avg: number | null,
): number {
  return peopleAhead * effectiveServiceSeconds(avg)
}

/**
 * อัปเดต rolling average แบบ EMA.
 * - ครั้งแรก (prev null) คืน sample
 * - sample ที่อยู่นอกช่วงสมเหตุสมผล → ทิ้ง คืน prev เดิม (default ถ้า prev null)
 */
export function nextRollingAverage(
  prev: number | null,
  sampleSeconds: number,
): number {
  if (
    !Number.isFinite(sampleSeconds) ||
    sampleSeconds < MIN_SAMPLE_SECONDS ||
    sampleSeconds > MAX_SAMPLE_SECONDS
  ) {
    return prev ?? DEFAULT_SERVICE_SECONDS
  }
  if (prev === null) return Math.round(sampleSeconds)
  return Math.round(ROLLING_ALPHA * sampleSeconds + (1 - ROLLING_ALPHA) * prev)
}

/**
 * คำนวณ sortSeq สำหรับ "แทรกคิวที่ข้ามไปแล้วกลับมาเป็นลำดับถัดไป".
 * ต้องการให้คิวที่แทรกถูกเรียกหลัง serving ปัจจุบัน แต่ก่อน waiting ตัวอื่นทั้งหมด.
 */
export function requeueSortSeq(
  servingSortSeq: number | null,
  minWaitingSortSeq: number | null,
): number {
  if (minWaitingSortSeq === null) {
    return (servingSortSeq ?? -1) + 1
  }
  if (servingSortSeq === null) {
    return minWaitingSortSeq - 1
  }
  return (servingSortSeq + minWaitingSortSeq) / 2
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `pnpm test queue-core`
Expected: PASS ทุกเคส

- [ ] **Step 5: commit**

```bash
git add lib/queue-core.ts tests/queue-core.test.ts
git commit -m "feat(queue): add pure core logic (ETA, rolling avg, requeue sort) with tests"
```

---

## Task 3: Queue token (JWT สำหรับ counter)

**Files:**
- Create: `lib/queue-token.ts`

- [ ] **Step 1: เขียน implementation (mirror station-token)**

สร้าง `lib/queue-token.ts`:

```ts
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

export interface QueueTokenPayload extends JWTPayload {
  counterId: string
  eventId: string
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not set')
  return new TextEncoder().encode(secret)
}

export async function signQueueToken(
  payload: QueueTokenPayload,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(getSecret())
}

export async function verifyQueueToken(
  token: string,
): Promise<QueueTokenPayload | null> {
  try {
    const { payload } = await jwtVerify<QueueTokenPayload>(token, getSecret())
    if (!payload.counterId || !payload.eventId) return null
    return payload
  } catch {
    return null
  }
}
```

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck`
Expected: ไม่มี error

- [ ] **Step 3: commit**

```bash
git add lib/queue-token.ts
git commit -m "feat(queue): add queue JWT token sign/verify"
```

---

## Task 4: Query/mutation layer

**Files:**
- Create: `db/queries/queue.ts`

- [ ] **Step 1: เขียน types + counters CRUD**

สร้าง `db/queries/queue.ts`:

```ts
import { and, asc, eq, inArray, lt, sql } from 'drizzle-orm'
import { db } from '@/db'
import { athletes } from '@/db/schema/athletes'
import { queueCounters, queueEntries } from '@/db/schema/queue'
import { nextRollingAverage, requeueSortSeq, estimateWaitSeconds } from '@/lib/queue-core'

const ACTIVE_STATUSES = ['waiting', 'serving', 'skipped'] as const

export type CounterRow = {
  counterId: string
  eventId: string
  counterName: string
  isOpen: boolean
  sessionId: string
  lastDisplayNumber: number
  avgServiceSeconds: number | null
}

export type EntryView = {
  entryId: string
  displayNumber: number
  sortSeq: number
  entryStatus: 'waiting' | 'serving' | 'done' | 'skipped' | 'cancelled'
  bibNumber: string | null
  displayLabel: string | null
  isNonMember: boolean
  athleteName: string | null
}

export type BoardData = {
  counter: CounterRow
  serving: EntryView | null
  upcoming: EntryView[]
  skipped: EntryView[]
  waitingCount: number
}

export type QueueStatus = {
  counterName: string
  displayNumber: number
  entryStatus: EntryView['entryStatus']
  peopleAhead: number
  etaSeconds: number
  sessionValid: boolean
}

// ─── Counters ────────────────────────────────────────────────────────────────

export async function createCounter(input: {
  eventId: string
  counterName: string
}): Promise<{ counterId: string }> {
  const [row] = await db
    .insert(queueCounters)
    .values({ eventId: input.eventId, counterName: input.counterName })
    .returning({ counterId: queueCounters.counterId })
  return row
}

export async function listCountersByEvent(
  eventId: string,
): Promise<CounterRow[]> {
  return db
    .select({
      counterId: queueCounters.counterId,
      eventId: queueCounters.eventId,
      counterName: queueCounters.counterName,
      isOpen: queueCounters.isOpen,
      sessionId: queueCounters.sessionId,
      lastDisplayNumber: queueCounters.lastDisplayNumber,
      avgServiceSeconds: queueCounters.avgServiceSeconds,
    })
    .from(queueCounters)
    .where(
      and(eq(queueCounters.eventId, eventId), eq(queueCounters.status, 'active')),
    )
    .orderBy(asc(queueCounters.createdAt))
}

export async function getCounter(counterId: string): Promise<CounterRow | null> {
  const [row] = await db
    .select({
      counterId: queueCounters.counterId,
      eventId: queueCounters.eventId,
      counterName: queueCounters.counterName,
      isOpen: queueCounters.isOpen,
      sessionId: queueCounters.sessionId,
      lastDisplayNumber: queueCounters.lastDisplayNumber,
      avgServiceSeconds: queueCounters.avgServiceSeconds,
    })
    .from(queueCounters)
    .where(eq(queueCounters.counterId, counterId))
    .limit(1)
  return row ?? null
}

export async function deleteCounter(counterId: string): Promise<void> {
  await db.delete(queueCounters).where(eq(queueCounters.counterId, counterId))
}

export async function setCounterOpen(
  counterId: string,
  isOpen: boolean,
): Promise<void> {
  await db
    .update(queueCounters)
    .set({ isOpen })
    .where(eq(queueCounters.counterId, counterId))
}

export async function resetCounter(counterId: string): Promise<void> {
  // ยกเลิก entry ที่ค้างทั้งหมดของ counter
  await db
    .update(queueEntries)
    .set({ entryStatus: 'cancelled' })
    .where(
      and(
        eq(queueEntries.counterId, counterId),
        inArray(queueEntries.entryStatus, [...ACTIVE_STATUSES]),
      ),
    )
  // เริ่ม session ใหม่ + รีเซ็ตตัวนับ + ล้างค่าเฉลี่ย
  await db
    .update(queueCounters)
    .set({
      sessionId: crypto.randomUUID(),
      lastDisplayNumber: 0,
      avgServiceSeconds: null,
    })
    .where(eq(queueCounters.counterId, counterId))
}
```

- [ ] **Step 2: เพิ่ม enqueue (atomic + dedup) ต่อท้ายไฟล์เดิม**

```ts
// ─── Enqueue ─────────────────────────────────────────────────────────────────

export type EnqueueInput = {
  counterId: string
  athleteId?: string | null
  registrationId?: string | null
  bibNumber?: string | null
  lineUserId?: string | null
  isNonMember?: boolean
  displayLabel?: string | null
}

export type EnqueuedEntry = {
  entryId: string
  displayNumber: number
  statusToken: string
}

async function findActiveEntry(
  counterId: string,
  athleteId: string | null,
  bibNumber: string | null,
): Promise<EnqueuedEntry | null> {
  if (!athleteId && !bibNumber) return null
  const match = athleteId
    ? eq(queueEntries.athleteId, athleteId)
    : eq(queueEntries.bibNumber, bibNumber as string)
  const [row] = await db
    .select({
      entryId: queueEntries.entryId,
      displayNumber: queueEntries.displayNumber,
      statusToken: queueEntries.statusToken,
    })
    .from(queueEntries)
    .where(
      and(
        eq(queueEntries.counterId, counterId),
        inArray(queueEntries.entryStatus, [...ACTIVE_STATUSES]),
        match,
      ),
    )
    .limit(1)
  return row ?? null
}

/**
 * ออกเลขคิวใหม่. ป้องกันเลขซ้ำด้วยการ increment lastDisplayNumber แบบ atomic
 * และกันคิวซ้ำต่อ athlete/bib ด้วย partial unique index (คืน entry เดิมถ้าซ้ำ).
 */
export async function enqueue(
  input: EnqueueInput,
): Promise<{ entry: EnqueuedEntry; created: boolean }> {
  const athleteId = input.athleteId ?? null
  const bibNumber = input.bibNumber ?? null

  const existing = await findActiveEntry(input.counterId, athleteId, bibNumber)
  if (existing) return { entry: existing, created: false }

  // increment ตัวนับแบบ atomic แล้วใช้ค่าที่ได้เป็น displayNumber + sortSeq
  const [counter] = await db
    .update(queueCounters)
    .set({ lastDisplayNumber: sql`${queueCounters.lastDisplayNumber} + 1` })
    .where(eq(queueCounters.counterId, input.counterId))
    .returning({
      n: queueCounters.lastDisplayNumber,
      sessionId: queueCounters.sessionId,
    })

  try {
    const [entry] = await db
      .insert(queueEntries)
      .values({
        counterId: input.counterId,
        sessionId: counter.sessionId,
        displayNumber: counter.n,
        sortSeq: counter.n,
        entryStatus: 'waiting',
        athleteId,
        registrationId: input.registrationId ?? null,
        bibNumber,
        lineUserId: input.lineUserId ?? null,
        isNonMember: input.isNonMember ?? false,
        displayLabel: input.displayLabel ?? null,
      })
      .returning({
        entryId: queueEntries.entryId,
        displayNumber: queueEntries.displayNumber,
        statusToken: queueEntries.statusToken,
      })
    return { entry, created: true }
  } catch (err) {
    // ชน partial unique index = มีคนขอคิวเดียวกันพร้อมกัน → คืนตัวที่มีอยู่
    const dup = await findActiveEntry(input.counterId, athleteId, bibNumber)
    if (dup) return { entry: dup, created: false }
    throw err
  }
}
```

- [ ] **Step 3: เพิ่ม board + operations (next/skip/requeue) ต่อท้าย**

```ts
// ─── Board + operations ──────────────────────────────────────────────────────

const ENTRY_VIEW_COLUMNS = {
  entryId: queueEntries.entryId,
  displayNumber: queueEntries.displayNumber,
  sortSeq: queueEntries.sortSeq,
  entryStatus: queueEntries.entryStatus,
  bibNumber: queueEntries.bibNumber,
  displayLabel: queueEntries.displayLabel,
  isNonMember: queueEntries.isNonMember,
  athleteName: athletes.firstName,
} as const

function toEntryView(row: {
  entryId: string
  displayNumber: number
  sortSeq: number
  entryStatus: EntryView['entryStatus']
  bibNumber: string | null
  displayLabel: string | null
  isNonMember: boolean
  athleteName: string | null
}): EntryView {
  return row
}

async function entriesByStatus(
  counterId: string,
  sessionId: string,
  status: EntryView['entryStatus'],
  limit?: number,
): Promise<EntryView[]> {
  const q = db
    .select(ENTRY_VIEW_COLUMNS)
    .from(queueEntries)
    .leftJoin(athletes, eq(queueEntries.athleteId, athletes.athleteId))
    .where(
      and(
        eq(queueEntries.counterId, counterId),
        eq(queueEntries.sessionId, sessionId),
        eq(queueEntries.entryStatus, status),
      ),
    )
    .orderBy(asc(queueEntries.sortSeq))
  const rows = limit ? await q.limit(limit) : await q
  return rows.map(toEntryView)
}

export async function getBoard(counterId: string): Promise<BoardData | null> {
  const counter = await getCounter(counterId)
  if (!counter) return null
  const [servingList, upcoming, skipped, waitingAll] = await Promise.all([
    entriesByStatus(counterId, counter.sessionId, 'serving', 1),
    entriesByStatus(counterId, counter.sessionId, 'waiting', 3),
    entriesByStatus(counterId, counter.sessionId, 'skipped'),
    entriesByStatus(counterId, counter.sessionId, 'waiting'),
  ])
  return {
    counter,
    serving: servingList[0] ?? null,
    upcoming,
    skipped,
    waitingCount: waitingAll.length,
  }
}

/** ปิดคิวที่กำลัง serve (done) + อัปเดตค่าเฉลี่ย แล้วเรียก waiting ตัวถัดไป */
export async function nextQueue(counterId: string): Promise<void> {
  const counter = await getCounter(counterId)
  if (!counter) return

  // ปิด serving ปัจจุบัน
  const [serving] = await db
    .select({
      entryId: queueEntries.entryId,
      calledAt: queueEntries.calledAt,
    })
    .from(queueEntries)
    .where(
      and(
        eq(queueEntries.counterId, counterId),
        eq(queueEntries.sessionId, counter.sessionId),
        eq(queueEntries.entryStatus, 'serving'),
      ),
    )
    .limit(1)

  if (serving) {
    const now = new Date()
    await db
      .update(queueEntries)
      .set({ entryStatus: 'done', completedAt: now })
      .where(eq(queueEntries.entryId, serving.entryId))
    if (serving.calledAt) {
      const sample = (now.getTime() - serving.calledAt.getTime()) / 1000
      const avg = nextRollingAverage(counter.avgServiceSeconds, sample)
      await db
        .update(queueCounters)
        .set({ avgServiceSeconds: avg })
        .where(eq(queueCounters.counterId, counterId))
    }
  }

  // เรียก waiting ตัวแรก (sortSeq น้อยสุด)
  const [next] = await db
    .select({ entryId: queueEntries.entryId })
    .from(queueEntries)
    .where(
      and(
        eq(queueEntries.counterId, counterId),
        eq(queueEntries.sessionId, counter.sessionId),
        eq(queueEntries.entryStatus, 'waiting'),
      ),
    )
    .orderBy(asc(queueEntries.sortSeq))
    .limit(1)

  if (next) {
    await db
      .update(queueEntries)
      .set({ entryStatus: 'serving', calledAt: new Date() })
      .where(eq(queueEntries.entryId, next.entryId))
  }
}

export async function skipEntry(entryId: string): Promise<void> {
  await db
    .update(queueEntries)
    .set({ entryStatus: 'skipped' })
    .where(eq(queueEntries.entryId, entryId))
}

/** แทรกคิวที่ถูกข้ามกลับมาเป็นลำดับถัดไป */
export async function requeueEntry(entryId: string): Promise<void> {
  const [entry] = await db
    .select({
      counterId: queueEntries.counterId,
      sessionId: queueEntries.sessionId,
    })
    .from(queueEntries)
    .where(eq(queueEntries.entryId, entryId))
    .limit(1)
  if (!entry) return

  const [serving] = await db
    .select({ sortSeq: queueEntries.sortSeq })
    .from(queueEntries)
    .where(
      and(
        eq(queueEntries.counterId, entry.counterId),
        eq(queueEntries.sessionId, entry.sessionId),
        eq(queueEntries.entryStatus, 'serving'),
      ),
    )
    .limit(1)

  const [minWaiting] = await db
    .select({ sortSeq: queueEntries.sortSeq })
    .from(queueEntries)
    .where(
      and(
        eq(queueEntries.counterId, entry.counterId),
        eq(queueEntries.sessionId, entry.sessionId),
        eq(queueEntries.entryStatus, 'waiting'),
      ),
    )
    .orderBy(asc(queueEntries.sortSeq))
    .limit(1)

  const newSeq = requeueSortSeq(
    serving?.sortSeq ?? null,
    minWaiting?.sortSeq ?? null,
  )
  await db
    .update(queueEntries)
    .set({ entryStatus: 'waiting', sortSeq: newSeq })
    .where(eq(queueEntries.entryId, entryId))
}
```

- [ ] **Step 4: เพิ่ม getQueueStatus (สำหรับหน้า status/poll) ต่อท้าย**

```ts
// ─── Status (public poll) ────────────────────────────────────────────────────

export async function getQueueStatus(
  statusToken: string,
): Promise<QueueStatus | null> {
  const [entry] = await db
    .select({
      counterId: queueEntries.counterId,
      sessionId: queueEntries.sessionId,
      displayNumber: queueEntries.displayNumber,
      sortSeq: queueEntries.sortSeq,
      entryStatus: queueEntries.entryStatus,
    })
    .from(queueEntries)
    .where(eq(queueEntries.statusToken, statusToken))
    .limit(1)
  if (!entry) return null

  const counter = await getCounter(entry.counterId)
  if (!counter) return null

  const sessionValid = entry.sessionId === counter.sessionId

  if (!sessionValid || entry.entryStatus !== 'waiting') {
    return {
      counterName: counter.counterName,
      displayNumber: entry.displayNumber,
      entryStatus: entry.entryStatus,
      peopleAhead: 0,
      etaSeconds: 0,
      sessionValid,
    }
  }

  const [ahead] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(queueEntries)
    .where(
      and(
        eq(queueEntries.counterId, entry.counterId),
        eq(queueEntries.sessionId, entry.sessionId),
        eq(queueEntries.entryStatus, 'waiting'),
        lt(queueEntries.sortSeq, entry.sortSeq),
      ),
    )
  const peopleAhead = ahead?.count ?? 0

  return {
    counterName: counter.counterName,
    displayNumber: entry.displayNumber,
    entryStatus: entry.entryStatus,
    peopleAhead,
    etaSeconds: estimateWaitSeconds(peopleAhead, counter.avgServiceSeconds),
    sessionValid,
  }
}
```

- [ ] **Step 5: typecheck**

Run: `pnpm typecheck`
Expected: ไม่มี error

- [ ] **Step 6: commit**

```bash
git add db/queries/queue.ts
git commit -m "feat(queue): add queue queries (counters, enqueue, board, ops, status)"
```

---

## Task 5: RBAC permissions

**Files:**
- Modify: `lib/rbac.ts`

- [ ] **Step 1: เพิ่ม permission constants**

ใน `lib/rbac.ts` ใน object `PERMISSIONS` ต่อจาก `CHECKIN_CREATE: 'checkin:create',`:

```ts
  // Queue
  QUEUE_MANAGE: 'queue:manage',
  QUEUE_OPERATE: 'queue:operate',
```

- [ ] **Step 2: ให้สิทธิ์ manager + staff**

ใน array `MACIM_MANAGER_PERMS` ต่อจาก `PERMISSIONS.CHECKIN_CREATE,`:

```ts
  PERMISSIONS.QUEUE_MANAGE,
  PERMISSIONS.QUEUE_OPERATE,
```

และใน `ROLE_PERMISSIONS` แก้ `sponsor_staff` ให้รวม operate:

```ts
  sponsor_staff: [PERMISSIONS.CHECKIN_CREATE, PERMISSIONS.QUEUE_OPERATE],
```

- [ ] **Step 3: typecheck**

Run: `pnpm typecheck`
Expected: ไม่มี error

- [ ] **Step 4: commit**

```bash
git add lib/rbac.ts
git commit -m "feat(queue): add QUEUE_MANAGE/QUEUE_OPERATE permissions"
```

---

## Task 6: Flex message เลขคิว

**Files:**
- Modify: `lib/line-messages.ts`

- [ ] **Step 1: เพิ่ม builder**

ต่อท้าย `lib/line-messages.ts`:

```ts
// ─── Queue Ticket Flex ───────────────────────────────────────────────────────

export function queueTicketMessage(input: {
  counterName: string
  displayNumber: number
  statusUrl: string
}): LineMessage {
  return {
    type: 'flex',
    altText: `คิวของคุณคือหมายเลข ${input.displayNumber} (${input.counterName})`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1D86E8',
        paddingAll: 'md',
        contents: [
          {
            type: 'text',
            text: '🎫 รับคิวสำเร็จ',
            color: '#ffffff',
            weight: 'bold',
            size: 'sm',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          { type: 'text', text: input.counterName, size: 'sm', color: '#555555' },
          {
            type: 'text',
            text: String(input.displayNumber),
            weight: 'bold',
            size: '5xl',
            align: 'center',
            color: '#1D86E8',
          },
          {
            type: 'text',
            text: 'หมายเลขคิวของคุณ',
            size: 'xs',
            color: '#888888',
            align: 'center',
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            action: {
              type: 'uri',
              label: 'ดูสถานะคิว / เวลารอ',
              uri: input.statusUrl,
            },
          },
        ],
      },
    },
  }
}
```

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck`
Expected: ไม่มี error

- [ ] **Step 3: commit**

```bash
git add lib/line-messages.ts
git commit -m "feat(queue): add queue ticket flex message"
```

---

## Task 7: หน้า admin จัดการ counters + QR

**Files:**
- Create: `app/(dashboard)/dashboard/events/[id]/queue/actions.ts`
- Create: `app/(dashboard)/dashboard/events/[id]/queue/_components/counter-create-form.tsx`
- Create: `app/(dashboard)/dashboard/events/[id]/queue/_components/queue-qr-button.tsx`
- Create: `app/(dashboard)/dashboard/events/[id]/queue/page.tsx`

> Auth pattern (ตรวจกับหน้า stations แล้ว ใช้ได้จริง): `import { auth } from '@/auth'`; `const session = await auth()`; ถ้า `!session?.user` → `redirect('/sign-in')`; `session.user` มี `{ role, permissions, sponsorId }`. `canAccess(perm, authz)` รับ `authz: { role, permissions }` — ส่ง `session.user` เข้าได้ตรงๆ เพราะ structural typing (canAccess อ่านแค่ role/permissions). โค้ดด้านล่างใช้รูปแบบนี้

- [ ] **Step 1: เขียน actions**

สร้าง `app/(dashboard)/dashboard/events/[id]/queue/actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS } from '@/lib/rbac'
import { createCounter, deleteCounter } from '@/db/queries/queue'

const createSchema = z.object({
  counterName: z.string().trim().min(1, 'กรุณากรอกชื่อจุดบริการ').max(60),
})

export type CounterFormState = { error?: string } | null

export async function createCounterAction(
  eventId: string,
  _prev: CounterFormState,
  formData: FormData,
): Promise<CounterFormState> {
  const session = await auth()
  if (!session?.user) return { error: 'ไม่ได้รับอนุญาต' }
  if (!canAccess(PERMISSIONS.QUEUE_MANAGE, session.user)) {
    return { error: 'ไม่มีสิทธิ์จัดการคิว' }
  }
  const parsed = createSchema.safeParse({
    counterName: formData.get('counterName'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }
  }
  await createCounter({ eventId, counterName: parsed.data.counterName })
  revalidatePath(`/dashboard/events/${eventId}/queue`)
  return null
}

export async function deleteCounterAction(
  eventId: string,
  counterId: string,
): Promise<{ message?: string } | void> {
  const session = await auth()
  if (!session?.user) return { message: 'ไม่ได้รับอนุญาต' }
  if (!canAccess(PERMISSIONS.QUEUE_MANAGE, session.user)) {
    return { message: 'ไม่มีสิทธิ์จัดการคิว' }
  }
  await deleteCounter(counterId)
  revalidatePath(`/dashboard/events/${eventId}/queue`)
}
```

- [ ] **Step 2: เขียนฟอร์มสร้าง counter**

สร้าง `app/(dashboard)/dashboard/events/[id]/queue/_components/counter-create-form.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  createCounterAction,
  type CounterFormState,
} from '../actions'

export function CounterCreateForm({ eventId }: { eventId: string }) {
  const action = createCounterAction.bind(null, eventId)
  const [state, formAction, isPending] = useActionState<
    CounterFormState,
    FormData
  >(action, null)

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
      <Input
        name="counterName"
        placeholder="ชื่อจุดบริการ เช่น จุดนวด 1"
        className="sm:max-w-xs"
        required
      />
      <Button type="submit" disabled={isPending}>
        {isPending ? 'กำลังเพิ่ม...' : 'เพิ่มจุดบริการ'}
      </Button>
      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
    </form>
  )
}
```

- [ ] **Step 3: เขียนปุ่ม QR**

สร้าง `app/(dashboard)/dashboard/events/[id]/queue/_components/queue-qr-button.tsx`
(โครงสร้างเดียวกับ `station-qr-button.tsx`):

```tsx
'use client'

import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  counterName: string
  liffUrl: string
}

export function QueueQrButton({ counterName, liffUrl }: Props) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(liffUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard ใช้ไม่ได้ — เงียบไว้
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        QR Code
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{counterName}</DialogTitle>
            <DialogDescription>นักกีฬาสแกน QR เพื่อรับคิว</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-2">
            <QRCodeSVG value={liffUrl} size={220} level="M" />
          </div>
          <p className="break-all text-center text-xs text-muted-foreground">
            {liffUrl}
          </p>
          <Button variant="outline" className="w-full" onClick={handleCopy}>
            {copied ? 'คัดลอกแล้ว ✓' : 'คัดลอก URL'}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 4: เขียนหน้า page**

สร้าง `app/(dashboard)/dashboard/events/[id]/queue/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { Button } from '@/components/ui/button'
import { canAccess, PERMISSIONS } from '@/lib/rbac'
import { listCountersByEvent } from '@/db/queries/queue'
import { signQueueToken } from '@/lib/queue-token'
import { ConfirmActionButton } from '@/app/_components/confirm-action-button'
import { CounterCreateForm } from './_components/counter-create-form'
import { QueueQrButton } from './_components/queue-qr-button'
import { deleteCounterAction } from './actions'

export const dynamic = 'force-dynamic'

const LIFF_BASE = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}`

interface Props {
  params: Promise<{ id: string }>
}

export default async function QueuePage({ params }: Props) {
  const { id: eventId } = await params
  const session = await auth()
  if (!session?.user) redirect('/sign-in')
  if (!canAccess(PERMISSIONS.QUEUE_MANAGE, session.user)) notFound()

  const counters = await listCountersByEvent(eventId)
  const withTokens = await Promise.all(
    counters.map(async (c) => ({
      ...c,
      liffUrl: `${LIFF_BASE}/queue/${await signQueueToken({
        counterId: c.counterId,
        eventId,
      })}`,
    })),
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">จัดการคิว</h1>
        <p className="text-sm text-muted-foreground">
          แต่ละจุดบริการมีลำดับเลขคิวแยกกัน
        </p>
      </div>

      <CounterCreateForm eventId={eventId} />

      <ul className="space-y-2">
        {withTokens.length === 0 && (
          <li className="text-sm text-muted-foreground">ยังไม่มีจุดบริการคิว</li>
        )}
        {withTokens.map((c) => (
          <li
            key={c.counterId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
          >
            <div>
              <p className="font-medium">{c.counterName}</p>
              <p className="text-xs text-muted-foreground">
                {c.isOpen ? 'เปิดรับคิว' : 'ปิดรับคิว'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <QueueQrButton counterName={c.counterName} liffUrl={c.liffUrl} />
              <Button asChild size="sm">
                <Link
                  href={`/dashboard/events/${eventId}/queue/${c.counterId}/board`}
                >
                  กระดานคิว
                </Link>
              </Button>
              <ConfirmActionButton
                triggerLabel="ลบ"
                pendingLabel="กำลังลบ..."
                title="ยืนยันการลบจุดบริการ"
                description={
                  <>
                    ลบ <strong>{c.counterName}</strong> และคิวทั้งหมดของจุดนี้?
                  </>
                }
                actionLabel="ยืนยันลบ"
                triggerVariant="destructive"
                onConfirm={async () => {
                  'use server'
                  return deleteCounterAction(eventId, c.counterId)
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

> หมายเหตุ: `ConfirmActionButton.onConfirm` ถูกเรียกฝั่ง client — การส่ง inline `'use server'` closure แบบด้านบนใช้ได้กับ Next 16 server action. ถ้า pattern ในโปรเจกต์ใช้การ bind action แยก (ดูตัวอย่าง DeleteStationButton ในหน้า stations) ให้ทำตามนั้นแทน เพื่อความสม่ำเสมอ

- [ ] **Step 5: typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: ไม่มี error (ถ้า `auth` import path หรือรูป `session.user` ต่างจริง ให้แก้ให้ตรงหน้า stations)

- [ ] **Step 6: commit**

```bash
git add "app/(dashboard)/dashboard/events/[id]/queue"
git commit -m "feat(queue): admin counter management page with QR"
```

---

## Task 8: กระดานคุมคิว (admin board)

**Files:**
- Create: `app/(dashboard)/dashboard/events/[id]/queue/[counterId]/board/actions.ts`
- Create: `app/(dashboard)/dashboard/events/[id]/queue/[counterId]/board/_components/queue-board.tsx`
- Create: `app/(dashboard)/dashboard/events/[id]/queue/[counterId]/board/page.tsx`

- [ ] **Step 1: เขียน board actions**

สร้าง `app/(dashboard)/dashboard/events/[id]/queue/[counterId]/board/actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS } from '@/lib/rbac'
import {
  enqueue,
  getCounter,
  nextQueue,
  requeueEntry,
  resetCounter,
  setCounterOpen,
  skipEntry,
} from '@/db/queries/queue'
import { getRegistrationByBibAndEvent } from '@/db/queries/line'
import { isValidBib } from '@/lib/line-state'

type Result = { ok: true } | { ok: false; message: string }

async function authorize(): Promise<boolean> {
  const session = await auth()
  return !!session?.user && canAccess(PERMISSIONS.QUEUE_OPERATE, session.user)
}

function revalidateBoard(eventId: string, counterId: string) {
  revalidatePath(`/dashboard/events/${eventId}/queue/${counterId}/board`)
}

export async function toggleOpenAction(
  eventId: string,
  counterId: string,
  isOpen: boolean,
): Promise<Result> {
  if (!(await authorize())) return { ok: false, message: 'ไม่มีสิทธิ์' }
  await setCounterOpen(counterId, isOpen)
  revalidateBoard(eventId, counterId)
  return { ok: true }
}

export async function resetCounterAction(
  eventId: string,
  counterId: string,
): Promise<Result> {
  if (!(await authorize())) return { ok: false, message: 'ไม่มีสิทธิ์' }
  await resetCounter(counterId)
  revalidateBoard(eventId, counterId)
  return { ok: true }
}

export async function nextQueueAction(
  eventId: string,
  counterId: string,
): Promise<Result> {
  if (!(await authorize())) return { ok: false, message: 'ไม่มีสิทธิ์' }
  await nextQueue(counterId)
  revalidateBoard(eventId, counterId)
  return { ok: true }
}

export async function skipEntryAction(
  eventId: string,
  counterId: string,
  entryId: string,
): Promise<Result> {
  if (!(await authorize())) return { ok: false, message: 'ไม่มีสิทธิ์' }
  await skipEntry(entryId)
  revalidateBoard(eventId, counterId)
  return { ok: true }
}

export async function requeueEntryAction(
  eventId: string,
  counterId: string,
  entryId: string,
): Promise<Result> {
  if (!(await authorize())) return { ok: false, message: 'ไม่มีสิทธิ์' }
  await requeueEntry(entryId)
  revalidateBoard(eventId, counterId)
  return { ok: true }
}

/** เพิ่มคิวแทนนักกีฬาด้วย BIB (ต้องลงทะเบียน event แล้ว) */
export async function addByBibAction(
  eventId: string,
  counterId: string,
  rawBib: string,
): Promise<Result> {
  if (!(await authorize())) return { ok: false, message: 'ไม่มีสิทธิ์' }
  const bib = rawBib.trim().toUpperCase()
  if (!isValidBib(bib)) return { ok: false, message: 'BIB ไม่ถูกต้อง' }
  const reg = await getRegistrationByBibAndEvent(bib, eventId)
  if (!reg) return { ok: false, message: 'ไม่พบ BIB นี้ในงาน' }
  await enqueue({
    counterId,
    athleteId: reg.athleteId,
    registrationId: reg.registrationId,
    bibNumber: reg.bibNumber,
    lineUserId: reg.athleteLineUserId,
  })
  revalidateBoard(eventId, counterId)
  return { ok: true }
}

/** เพิ่มคิวให้คนที่ไม่ใช่ member / ไม่ได้ลงทะเบียน */
export async function addNonMemberAction(
  eventId: string,
  counterId: string,
  rawLabel: string,
): Promise<Result> {
  if (!(await authorize())) return { ok: false, message: 'ไม่มีสิทธิ์' }
  const label = rawLabel.trim()
  if (!label) return { ok: false, message: 'กรุณาระบุชื่อ/ป้ายกำกับ' }
  await enqueue({
    counterId,
    isNonMember: true,
    displayLabel: label,
  })
  revalidateBoard(eventId, counterId)
  return { ok: true }
}
```

> หมายเหตุ: คิวที่เพิ่มด้วย BIB หรือ non-member อาจไม่มี `lineUserId` → ส่ง flex ไม่ได้ แอดมินต้องแจ้งเลขคิวด้วยปากเอง (UI แสดงข้อความเตือนใน Step 2)

- [ ] **Step 2: เขียน client board component**

สร้าง `app/(dashboard)/dashboard/events/[id]/queue/[counterId]/board/_components/queue-board.tsx`:

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmActionButton } from '@/app/_components/confirm-action-button'
import type { BoardData, EntryView } from '@/db/queries/queue'
import {
  addByBibAction,
  addNonMemberAction,
  nextQueueAction,
  requeueEntryAction,
  resetCounterAction,
  skipEntryAction,
  toggleOpenAction,
} from '../actions'

function entryLabel(e: EntryView): string {
  if (e.isNonMember) return `${e.displayLabel ?? 'ไม่ระบุ'} (ไม่ใช่สมาชิก)`
  const name = e.athleteName ?? ''
  const bib = e.bibNumber ? `#${e.bibNumber}` : ''
  return [name, bib].filter(Boolean).join(' ') || 'ไม่ทราบชื่อ'
}

export function QueueBoard({
  eventId,
  board,
}: {
  eventId: string
  board: BoardData
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [bib, setBib] = useState('')
  const [guest, setGuest] = useState('')
  const counterId = board.counter.counterId

  // auto-refresh ทุก 7 วิ เพื่อเห็นคิวที่ขอเข้ามาใหม่
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 7000)
    return () => clearInterval(t)
  }, [router])

  function run(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn()
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{board.counter.counterName}</h1>
          <p className="text-sm text-muted-foreground">
            {board.counter.isOpen ? 'กำลังเปิดรับคิว' : 'ปิดรับคิวอยู่'} ·
            รอทั้งหมด {board.waitingCount} คิว
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={board.counter.isOpen ? 'outline' : 'default'}
            disabled={isPending}
            onClick={() =>
              run(() =>
                toggleOpenAction(eventId, counterId, !board.counter.isOpen),
              )
            }
          >
            {board.counter.isOpen ? 'หยุดรับคิว' : 'เริ่มรับคิว'}
          </Button>
          <ConfirmActionButton
            triggerLabel="รีเซ็ตคิว"
            pendingLabel="กำลังรีเซ็ต..."
            title="ยืนยันการรีเซ็ตคิว"
            description="คิวที่ค้างอยู่ทั้งหมดจะถูกล้าง และเริ่มนับเลขใหม่จาก 1 — การกระทำนี้ย้อนกลับไม่ได้"
            actionLabel="ยืนยันรีเซ็ต"
            triggerVariant="destructive"
            onConfirm={async () => {
              const r = await resetCounterAction(eventId, counterId)
              router.refresh()
              if (!r.ok) return { message: r.message }
            }}
          />
        </div>
      </div>

      {/* คิวที่กำลังเรียก */}
      <div className="rounded-xl border p-4">
        <p className="text-xs text-muted-foreground">กำลังเรียก</p>
        {board.serving ? (
          <div className="flex items-center justify-between">
            <div>
              <span className="text-4xl font-bold text-primary">
                {board.serving.displayNumber}
              </span>
              <span className="ml-3 text-sm">{entryLabel(board.serving)}</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  run(() =>
                    skipEntryAction(eventId, counterId, board.serving!.entryId),
                  )
                }
              >
                ข้าม
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">— ยังไม่มีคิวที่เรียก —</p>
        )}
        <Button
          className="mt-3 w-full"
          disabled={isPending}
          onClick={() => run(() => nextQueueAction(eventId, counterId))}
        >
          เรียกคิวถัดไป →
        </Button>
      </div>

      {/* คิวถัดไป 3 ลำดับ */}
      <div>
        <p className="mb-2 text-sm font-medium">คิวถัดไป</p>
        <ul className="space-y-1">
          {board.upcoming.length === 0 && (
            <li className="text-sm text-muted-foreground">— ไม่มีคิวรอ —</li>
          )}
          {board.upcoming.map((e) => (
            <li
              key={e.entryId}
              className="flex items-center justify-between rounded-lg border px-3 py-2"
            >
              <span>
                <strong className="mr-2">{e.displayNumber}</strong>
                {entryLabel(e)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() =>
                  run(() => skipEntryAction(eventId, counterId, e.entryId))
                }
              >
                ข้าม
              </Button>
            </li>
          ))}
        </ul>
      </div>

      {/* คิวที่ถูกข้าม — แทรกกลับได้ */}
      {board.skipped.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">คิวที่ถูกข้าม</p>
          <ul className="space-y-1">
            {board.skipped.map((e) => (
              <li
                key={e.entryId}
                className="flex items-center justify-between rounded-lg border border-dashed px-3 py-2"
              >
                <span>
                  <strong className="mr-2">{e.displayNumber}</strong>
                  {entryLabel(e)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() =>
                    run(() => requeueEntryAction(eventId, counterId, e.entryId))
                  }
                >
                  แทรกเป็นคิวถัดไป
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* เพิ่มคิวด้วยตนเอง */}
      <div className="space-y-3 rounded-xl border p-4">
        <p className="text-sm font-medium">เพิ่มคิวแทนนักกีฬา</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={bib}
            onChange={(e) => setBib(e.target.value)}
            placeholder="BIB (ลงทะเบียนแล้ว)"
            className="sm:max-w-[200px]"
          />
          <Button
            variant="secondary"
            disabled={isPending || !bib.trim()}
            onClick={() =>
              run(async () => {
                const r = await addByBibAction(eventId, counterId, bib)
                if (r.ok) setBib('')
                else alert(r.message)
              })
            }
          >
            เพิ่มด้วย BIB
          </Button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={guest}
            onChange={(e) => setGuest(e.target.value)}
            placeholder="ชื่อ/ป้ายกำกับ (ไม่ใช่สมาชิก)"
            className="sm:max-w-[200px]"
          />
          <Button
            variant="secondary"
            disabled={isPending || !guest.trim()}
            onClick={() =>
              run(async () => {
                const r = await addNonMemberAction(eventId, counterId, guest)
                if (r.ok) setGuest('')
                else alert(r.message)
              })
            }
          >
            เพิ่ม (ไม่ใช่สมาชิก)
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          หมายเหตุ: คิวที่เพิ่มเองไม่มี LINE จึงไม่ได้รับ flex แจ้งเลขคิว
          กรุณาแจ้งเลขคิวกับนักกีฬาโดยตรง
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: เขียนหน้า board page (server)**

สร้าง `app/(dashboard)/dashboard/events/[id]/queue/[counterId]/board/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS } from '@/lib/rbac'
import { getBoard } from '@/db/queries/queue'
import { QueueBoard } from './_components/queue-board'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string; counterId: string }>
}

export default async function BoardPage({ params }: Props) {
  const { id: eventId, counterId } = await params
  const session = await auth()
  if (!session?.user) redirect('/sign-in')
  if (!canAccess(PERMISSIONS.QUEUE_OPERATE, session.user)) notFound()

  const board = await getBoard(counterId)
  if (!board || board.counter.eventId !== eventId) notFound()

  return <QueueBoard eventId={eventId} board={board} />
}
```

- [ ] **Step 4: typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: ไม่มี error

- [ ] **Step 5: commit**

```bash
git add "app/(dashboard)/dashboard/events/[id]/queue/[counterId]"
git commit -m "feat(queue): admin queue board (next/skip/requeue/reset/add)"
```

---

## Task 9: LIFF ขอคิว (3 เคส)

**Files:**
- Create: `app/(liff)/queue/[token]/actions.ts`
- Create: `app/(liff)/queue/[token]/_components/queue-request.tsx`
- Create: `app/(liff)/queue/[token]/page.tsx`

> อ้างอิง pattern LIFF init จาก `app/(liff)/register/page.tsx` (liff.init + liff.login + getIDToken)

- [ ] **Step 1: เขียน actions**

สร้าง `app/(liff)/queue/[token]/actions.ts`:

```ts
'use server'

import { verifyQueueToken } from '@/lib/queue-token'
import { verifyLiffIdToken, pushMessage } from '@/lib/line-client'
import { queueTicketMessage } from '@/lib/line-messages'
import { isValidBib } from '@/lib/line-state'
import { enqueue, getCounter } from '@/db/queries/queue'
import {
  getAthleteByLineUserId,
  getRegistrationByAthleteAndEvent,
  createAthleteAndRegistration,
  createRegistrationForExistingAthlete,
  insertAthleteConsent,
} from '@/db/queries/line'

const APP_BASE = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000'

export type QueueContext =
  | { ok: false; reason: 'invalid' | 'closed' }
  | {
      ok: true
      counterName: string
      // ready = ลงทะเบียนแล้ว ขอคิวได้เลย
      // need_bib = เป็นสมาชิกแต่ยังไม่ลงทะเบียน event นี้
      // need_profile = ยังไม่เป็นสมาชิก
      mode: 'ready' | 'need_bib' | 'need_profile'
    }

export async function getQueueContext(
  token: string,
  liffIdToken: string,
): Promise<QueueContext> {
  const payload = await verifyQueueToken(token)
  if (!payload) return { ok: false, reason: 'invalid' }
  const counter = await getCounter(payload.counterId)
  if (!counter || counter.eventId !== payload.eventId) {
    return { ok: false, reason: 'invalid' }
  }
  if (!counter.isOpen) return { ok: false, reason: 'closed' }

  let lineUserId: string
  try {
    lineUserId = await verifyLiffIdToken(liffIdToken)
  } catch {
    return { ok: false, reason: 'invalid' }
  }

  const athlete = await getAthleteByLineUserId(lineUserId)
  if (!athlete) {
    return { ok: true, counterName: counter.counterName, mode: 'need_profile' }
  }
  const reg = await getRegistrationByAthleteAndEvent(
    athlete.athleteId,
    payload.eventId,
  )
  return {
    ok: true,
    counterName: counter.counterName,
    mode: reg ? 'ready' : 'need_bib',
  }
}

export type QueueResult =
  | { ok: false; error: string }
  | { ok: true; displayNumber: number; statusToken: string; counterName: string }

export async function requestQueue(
  _prev: QueueResult | null,
  formData: FormData,
): Promise<QueueResult> {
  const token = formData.get('token') as string
  const liffIdToken = formData.get('liffIdToken') as string

  const payload = await verifyQueueToken(token)
  if (!payload) return { ok: false, error: 'ลิงก์ไม่ถูกต้อง' }
  const counter = await getCounter(payload.counterId)
  if (!counter || counter.eventId !== payload.eventId) {
    return { ok: false, error: 'ไม่พบจุดบริการ' }
  }
  if (!counter.isOpen) return { ok: false, error: 'ขณะนี้ปิดรับคิว' }

  let lineUserId: string
  try {
    lineUserId = await verifyLiffIdToken(liffIdToken)
  } catch {
    return { ok: false, error: 'ยืนยันตัวตนไม่สำเร็จ กรุณาเปิดผ่าน LINE ใหม่' }
  }

  // เตรียม athlete/registration ตามเคส
  let athleteId: string | null = null
  let registrationId: string | null = null
  let bibNumber: string | null = null

  const athlete = await getAthleteByLineUserId(lineUserId)
  if (athlete) {
    athleteId = athlete.athleteId
    const reg = await getRegistrationByAthleteAndEvent(
      athlete.athleteId,
      payload.eventId,
    )
    if (reg) {
      // เคส 1 — ลงทะเบียนแล้ว
      registrationId = reg.registrationId
      bibNumber = reg.bibNumber
    } else {
      // เคส 2 — สมาชิกแต่ยังไม่ลงทะเบียน → ต้องมี bib
      const bib = ((formData.get('bib') as string) ?? '').trim().toUpperCase()
      if (!isValidBib(bib)) return { ok: false, error: 'กรุณากรอก BIB ให้ถูกต้อง' }
      await createRegistrationForExistingAthlete({
        athleteId: athlete.athleteId,
        eventId: payload.eventId,
        bibNumber: bib,
      })
      bibNumber = bib
    }
  } else {
    // เคส 3 — ยังไม่เป็นสมาชิก → กรอกข้อมูล + bib
    const bib = ((formData.get('bib') as string) ?? '').trim().toUpperCase()
    const firstName = ((formData.get('firstName') as string) ?? '').trim()
    const lastName = ((formData.get('lastName') as string) ?? '').trim()
    const dateOfBirth = (formData.get('dateOfBirth') as string) ?? ''
    const rawGender = (formData.get('gender') as string) ?? ''
    const gender = (rawGender === 'lgbtq' ? 'other' : rawGender) as
      | 'male'
      | 'female'
      | 'other'
    if (!isValidBib(bib) || !firstName || !lastName || !dateOfBirth || !gender) {
      return { ok: false, error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      return { ok: false, error: 'วันเกิดไม่ถูกต้อง' }
    }
    const created = await createAthleteAndRegistration({
      lineUserId,
      eventId: payload.eventId,
      bibNumber: bib,
      firstName,
      lastName,
      dateOfBirth,
      gender,
    })
    await insertAthleteConsent(created.athleteId)
    athleteId = created.athleteId
    bibNumber = bib
  }

  // ออกเลขคิว (dedup ภายใน)
  const { entry } = await enqueue({
    counterId: counter.counterId,
    athleteId,
    registrationId,
    bibNumber,
    lineUserId,
  })

  // ส่ง flex แจ้งเลขคิว + ลิงก์สถานะ
  const statusUrl = `${APP_BASE}/q/${entry.statusToken}`
  try {
    await pushMessage(lineUserId, [
      queueTicketMessage({
        counterName: counter.counterName,
        displayNumber: entry.displayNumber,
        statusUrl,
      }),
    ])
  } catch {
    console.error('[requestQueue] pushMessage failed for', lineUserId)
  }

  return {
    ok: true,
    displayNumber: entry.displayNumber,
    statusToken: entry.statusToken,
    counterName: counter.counterName,
  }
}
```

- [ ] **Step 2: เขียน client component**

สร้าง `app/(liff)/queue/[token]/_components/queue-request.tsx`:

```tsx
'use client'

import { useActionState, useEffect, useState } from 'react'
import liff from '@line/liff'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getQueueContext, requestQueue, type QueueContext } from '../actions'

export function QueueRequest({ token }: { token: string }) {
  const [idToken, setIdToken] = useState<string | null>(null)
  const [ctx, setCtx] = useState<QueueContext | null>(null)
  const [initError, setInitError] = useState<string | null>(null)
  const [state, formAction, isPending] = useActionState(requestQueue, null)

  useEffect(() => {
    async function init() {
      try {
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! })
        if (!liff.isLoggedIn()) {
          liff.login()
          return
        }
        const t = liff.getIDToken()
        if (!t) {
          setInitError('ไม่พบ ID Token กรุณาเปิดผ่าน LINE ใหม่')
          return
        }
        setIdToken(t)
        setCtx(await getQueueContext(token, t))
      } catch {
        setInitError('เปิด LIFF ไม่สำเร็จ กรุณาลองใหม่')
      }
    }
    init()
  }, [token])

  if (state?.ok) {
    return (
      <div className="space-y-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">{state.counterName}</p>
        <p className="text-6xl font-bold text-primary">{state.displayNumber}</p>
        <p className="text-sm">หมายเลขคิวของคุณ</p>
        <a
          className="text-sm text-blue-600 underline"
          href={`/q/${state.statusToken}`}
        >
          ดูสถานะคิว / เวลารอ
        </a>
        <p className="text-xs text-muted-foreground">
          เราได้ส่งเลขคิวให้ทาง LINE แล้ว
        </p>
      </div>
    )
  }

  if (initError) {
    return <p className="p-6 text-center text-destructive">{initError}</p>
  }
  if (!ctx) {
    return <p className="p-6 text-center text-muted-foreground">กำลังโหลด...</p>
  }
  if (!ctx.ok) {
    const msg =
      ctx.reason === 'closed'
        ? 'ขณะนี้ยังไม่เปิด หรือปิดรับคิวแล้ว'
        : 'ลิงก์ไม่ถูกต้อง'
    return <p className="p-6 text-center text-muted-foreground">{msg}</p>
  }

  return (
    <form action={formAction} className="space-y-3 p-6">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="liffIdToken" value={idToken ?? ''} />
      <h1 className="text-lg font-bold">รับคิว — {ctx.counterName}</h1>

      {ctx.mode !== 'ready' && (
        <div>
          <label className="text-sm">หมายเลข BIB</label>
          <Input name="bib" required placeholder="เช่น A123" />
        </div>
      )}

      {ctx.mode === 'need_profile' && (
        <>
          <div>
            <label className="text-sm">ชื่อ</label>
            <Input name="firstName" required />
          </div>
          <div>
            <label className="text-sm">นามสกุล</label>
            <Input name="lastName" required />
          </div>
          <div>
            <label className="text-sm">วันเกิด</label>
            <Input name="dateOfBirth" type="date" required />
          </div>
          <div>
            <label className="text-sm">เพศ</label>
            <select
              name="gender"
              required
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">เลือก</option>
              <option value="male">ชาย</option>
              <option value="female">หญิง</option>
              <option value="lgbtq">LGBTQ+</option>
              <option value="other">อื่นๆ</option>
            </select>
          </div>
        </>
      )}

      {state && !state.ok && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <Button type="submit" className="w-full" disabled={isPending || !idToken}>
        {isPending ? 'กำลังขอคิว...' : 'ขอเลขคิว'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: เขียนหน้า page**

สร้าง `app/(liff)/queue/[token]/page.tsx`:

```tsx
import { QueueRequest } from './_components/queue-request'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ token: string }>
}

export default async function QueueLiffPage({ params }: Props) {
  const { token } = await params
  return <QueueRequest token={token} />
}
```

- [ ] **Step 4: typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: ไม่มี error

- [ ] **Step 5: commit**

```bash
git add "app/(liff)/queue"
git commit -m "feat(queue): LIFF queue request flow (3 cases) with flex ticket"
```

---

## Task 10: หน้า status (public) + poll API

**Files:**
- Create: `app/api/queue/status/[token]/route.ts`
- Create: `app/(queue-status)/q/[token]/_components/status-view.tsx`
- Create: `app/(queue-status)/q/[token]/page.tsx`

- [ ] **Step 1: เขียน poll API**

สร้าง `app/api/queue/status/[token]/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { getQueueStatus } from '@/db/queries/queue'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const status = await getQueueStatus(token)
  if (!status) return NextResponse.json({ found: false }, { status: 404 })
  return NextResponse.json({ found: true, ...status })
}
```

- [ ] **Step 2: เขียน client status view (polling)**

สร้าง `app/(queue-status)/q/[token]/_components/status-view.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import type { QueueStatus } from '@/db/queries/queue'

type Payload = ({ found: true } & QueueStatus) | { found: false }

function formatEta(seconds: number): string {
  if (seconds <= 0) return 'ใกล้ถึงคิวคุณแล้ว'
  const mins = Math.round(seconds / 60)
  if (mins < 1) return 'น้อยกว่า 1 นาที'
  return `ประมาณ ${mins} นาที`
}

export function StatusView({ token }: { token: string }) {
  const [data, setData] = useState<Payload | null>(null)

  useEffect(() => {
    let active = true
    async function poll() {
      try {
        const res = await fetch(`/api/queue/status/${token}`, {
          cache: 'no-store',
        })
        const json: Payload = res.ok
          ? await res.json()
          : { found: false }
        if (active) setData(json)
      } catch {
        // network error ชั่วคราว — รอรอบถัดไป
      }
    }
    poll()
    const t = setInterval(poll, 7000)
    return () => {
      active = false
      clearInterval(t)
    }
  }, [token])

  if (!data) {
    return <p className="p-6 text-center text-muted-foreground">กำลังโหลด...</p>
  }
  if (!data.found) {
    return <p className="p-6 text-center text-muted-foreground">ไม่พบคิวนี้</p>
  }
  if (!data.sessionValid) {
    return (
      <p className="p-6 text-center text-muted-foreground">
        คิวถูกรีเซ็ตแล้ว กรุณาขอคิวใหม่
      </p>
    )
  }

  const statusText: Record<QueueStatus['entryStatus'], string> = {
    waiting: 'กำลังรอ',
    serving: 'ถึงคิวคุณแล้ว เชิญที่จุดบริการ',
    done: 'เสร็จสิ้นแล้ว',
    skipped: 'คิวของคุณถูกข้าม กรุณาติดต่อเจ้าหน้าที่',
    cancelled: 'คิวถูกยกเลิก',
  }

  return (
    <div className="space-y-4 p-6 text-center">
      <p className="text-sm text-muted-foreground">{data.counterName}</p>
      <p className="text-6xl font-bold text-primary">{data.displayNumber}</p>
      <p className="text-base font-medium">{statusText[data.entryStatus]}</p>
      {data.entryStatus === 'waiting' && (
        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">มีคิวรอก่อนหน้าคุณ</p>
          <p className="text-3xl font-bold">{data.peopleAhead} คิว</p>
          <p className="mt-1 text-sm">{formatEta(data.etaSeconds)}</p>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        หน้านี้อัปเดตอัตโนมัติทุก ~7 วินาที
      </p>
    </div>
  )
}
```

- [ ] **Step 3: เขียนหน้า page**

สร้าง `app/(queue-status)/q/[token]/page.tsx`:

```tsx
import { StatusView } from './_components/status-view'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ token: string }>
}

export default async function QueueStatusPage({ params }: Props) {
  const { token } = await params
  return (
    <main className="mx-auto max-w-md">
      <StatusView token={token} />
    </main>
  )
}
```

> หมายเหตุ: ถ้า route group `(queue-status)` ต้องการ layout (html/body) ของตัวเอง ให้ตรวจว่ามี root layout ครอบอยู่แล้วหรือไม่ — ถ้า group อื่น (เช่น `(self-checkin)`) มี `layout.tsx` เฉพาะ ให้คัดลอกโครงมาวางที่ `app/(queue-status)/layout.tsx` ตาม pattern เดิม

- [ ] **Step 4: typecheck + lint + build**

Run: `pnpm typecheck && pnpm lint`
Expected: ไม่มี error

- [ ] **Step 5: commit**

```bash
git add "app/api/queue" "app/(queue-status)"
git commit -m "feat(queue): public status page with polling + status API"
```

---

## Task 11: ลิงก์เข้าเมนูจัดการคิว

**Files:**
- Modify: `app/(dashboard)/dashboard/events/[id]/page.tsx`

> หน้า event detail แสดง stations แบบ inline ใน `stationsContent` (ไม่ใช่เมนูแยก). วางปุ่ม "จัดการคิว" ไว้แถบหัวของ section นี้ ติดกับปุ่มเพิ่ม Station

- [ ] **Step 1: ตรวจว่า `Link` ถูก import แล้ว**

ไฟล์ import `Link from 'next/link'` อยู่แล้ว (บรรทัดต้นไฟล์) และมี `Button` จาก `@/components/ui/button`. ถ้ายังไม่ได้ import `Button` ให้เพิ่ม

- [ ] **Step 2: เพิ่มปุ่มลิงก์ใน `stationsContent`**

แก้บล็อกหัวของ `stationsContent` (ราว `app/(dashboard)/dashboard/events/[id]/page.tsx:140-145`) จาก:

```tsx
    <div className="space-y-4">
      {canFullEdit && (
        <div className="flex justify-end">
          <AddStationDialog action={boundCreateStation} />
        </div>
      )}
```

เป็น:

```tsx
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/dashboard/events/${id}/queue`}>จัดการคิว</Link>
        </Button>
        {canFullEdit && <AddStationDialog action={boundCreateStation} />}
      </div>
```

(ตัวแปร event id ในไฟล์นี้ชื่อ `id`)

- [ ] **Step 3: typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: ไม่มี error

- [ ] **Step 4: commit**

```bash
git add "app/(dashboard)/dashboard/events/[id]"
git commit -m "feat(queue): add queue management link to event detail"
```

---

## Task 12: ตรวจสอบรวม (build + manual smoke)

**Files:** ไม่มี (verification)

- [ ] **Step 1: build เต็ม**

Run: `pnpm build`
Expected: build ผ่าน ไม่มี type error / ไม่มี route ที่ render ไม่ได้

- [ ] **Step 2: รัน test ทั้งหมด**

Run: `pnpm test`
Expected: PASS ทั้งหมด (รวม `queue-core`)

- [ ] **Step 3: manual smoke (dev)**

Run: `pnpm dev` แล้วตรวจตามลำดับ:
1. `/dashboard/events/<id>/queue` → เพิ่ม counter ได้ เห็น QR
2. เปิด `/dashboard/events/<id>/queue/<counterId>/board` → กด "เริ่มรับคิว"
3. เพิ่มคิวด้วย BIB ที่ลงทะเบียนแล้ว → ขึ้นในคิวถัดไป
4. เพิ่มคิว non-member → มีป้าย "ไม่ใช่สมาชิก"
5. กด "เรียกคิวถัดไป" → คิวเลื่อน; กด "ข้าม" แล้ว "แทรกเป็นคิวถัดไป" → กลับมาเป็นลำดับถัดไป
6. ขอคิวผ่าน LIFF (ทดสอบใน LINE จริง/หรือผ่าน idToken) → ได้ flex + ลิงก์ `/q/<token>`
7. เปิด `/q/<token>` → เห็นเลขคิว/คิวข้างหน้า/เวลา และอัปเดตเมื่อกด next บน board
8. กด "รีเซ็ตคิว" (ยืนยัน) → คิวค้างหาย เริ่มนับ 1 ใหม่ และหน้า `/q/<token>` เดิมขึ้น "คิวถูกรีเซ็ต"

- [ ] **Step 4: commit (ถ้ามีแก้จาก smoke)**

```bash
git add -A
git commit -m "fix(queue): adjustments from smoke test"
```

---

## Self-Review Notes (สำหรับผู้ทำตามแผน)

- **Atomicity:** neon-http ไม่รองรับ interactive transaction — `enqueue` พึ่ง atomic `UPDATE ... RETURNING` (เลขคิวไม่ซ้ำ) + partial unique index (กันคิวซ้ำ); การ insert ที่ชน index ถูก catch แล้วคืน entry เดิม
- **ลำดับ vs เลขโชว์:** `displayNumber` คงที่; การเรียงใช้ `sortSeq`; แทรกคิวที่ข้ามคำนวณด้วย `requeueSortSeq`
- **ข้อจำกัด push:** คิวที่ไม่มี `lineUserId` (add by bib / non-member) ส่ง flex ไม่ได้ — UI เตือนแล้ว
- **Reset:** เปลี่ยน `sessionId` → entry/ลิงก์เดิม `sessionValid=false` → หน้า status แสดง "คิวถูกรีเซ็ต"
- **Auth pattern (verified):** `auth` จาก `@/auth`, `session.user` มี `{ role, permissions, sponsorId }`, redirect ไป `/sign-in`, `canAccess(perm, { role, permissions })` — ส่ง `session.user` เข้าได้ตรงๆ (structural typing)
- **⚠️ ห้าม `db:push`:** จะ truncate `athlete_event_registrations`. ใช้ surgical apply script (Task 1 Step 5-6) เท่านั้น — `db:generate` สร้าง SQL ได้ (ไม่แตะ DB) แต่การ apply ต้องรันทีละ statement และตรวจว่าไม่มี statement แตะตารางอื่น (โดยเฉพาะ partial unique index ต้องมี `WHERE`)
```
