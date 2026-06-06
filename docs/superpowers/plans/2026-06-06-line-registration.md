# LINE Self-Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้นักกีฬาลงทะเบียนเองผ่าน LINE OA ด้วย Hybrid Webhook + LIFF รองรับ 3 flows และ multi-event

**Architecture:** Webhook รับข้อความ → State Machine (line_sessions ใน DB) → ส่ง Flex/QuickReply กลับ → LIFF form สำหรับกรอกข้อมูล → Server Action บันทึก + push success message

**Tech Stack:** Next.js 16 App Router, Drizzle ORM + Neon, LINE Messaging API, @line/liff, Vitest

---

## File Map

| File | Action | หน้าที่ |
|------|--------|---------|
| `db/schema/line.ts` | Create | line_sessions + athlete_consents tables |
| `db/index.ts` | Modify | เพิ่ม line schema |
| `db/migrations/0004_line_registration.sql` | Generate | migration SQL |
| `db/queries/line.ts` | Create | DB queries ทั้งหมดสำหรับ LINE feature |
| `lib/line-client.ts` | Create | verifySignature + replyMessage + pushMessage |
| `lib/line-messages.ts` | Create | Flex/QuickReply message builders |
| `lib/line-state.ts` | Create | state machine: startFlow, handleText, handleBib, handlePostback |
| `app/api/line/webhook/route.ts` | Create | POST handler: verify sig → dispatch |
| `app/(liff)/layout.tsx` | Create | minimal layout ไม่มี nav/auth |
| `app/(liff)/register/[eventId]/page.tsx` | Create | LIFF form (client component) |
| `app/(liff)/register/[eventId]/actions.ts` | Create | registerViaLine server action |
| `app/(dashboard)/dashboard/events/[id]/_components/copy-liff-link-button.tsx` | Create | client component copy to clipboard |
| `app/(dashboard)/dashboard/events/[id]/page.tsx` | Modify | เพิ่ม CopyLiffLinkButton |
| `tests/line-state.test.ts` | Create | unit test isValidBib |
| `tests/line-messages.test.ts` | Create | unit test message builders |
| `.env.local` | Modify | เพิ่ม LINE env vars |
| `.env.example` | Modify | เพิ่ม LINE env var templates |

---

## Task 1: Environment Setup

**Files:**
- Modify: `.env.local`
- Modify: `.env.example`

- [ ] **Step 1: เพิ่ม LINE vars ใน .env.local**

เปิดไฟล์ `.env.local` และเพิ่มที่ท้ายไฟล์:
```
# ── LINE Messaging API ───────────────────────────────────────
LINE_CHANNEL_SECRET=82bdd3949a39247b3a4402c9b612bca3
LINE_CHANNEL_ACCESS_TOKEN=2zKP667yJUM5zOmaU5g07pJOD2Yic/RTJmUrWZWftLgZgukmP28ApeWOcwZ4TQUYwGnppiHaMBfvP/mCFKXdsJ59lGcQckcoPL9xWleQpKzza8Kb9m9/82ZzD/N695GAzvm7eBA+y/Ps6cRYJozGmAdB04t89/1O/w1cDnyilFU=
NEXT_PUBLIC_LIFF_ID=2010313814-yt06X2oB
```

- [ ] **Step 2: เพิ่ม templates ใน .env.example**

เพิ่มที่ท้าย `.env.example`:
```
# ── LINE Messaging API ───────────────────────────────────────
# จาก LINE Developers Console → Messaging API channel
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=
# NEXT_PUBLIC_ prefix → ใช้ได้ใน browser (LIFF page)
NEXT_PUBLIC_LIFF_ID=
```

- [ ] **Step 3: Install @line/liff**

```bash
pnpm add @line/liff
```

Expected: `@line/liff` ปรากฏใน `package.json` dependencies

- [ ] **Step 4: Commit**

```bash
git add .env.example pnpm-lock.yaml package.json
git commit -m "chore: add LINE env vars template and install @line/liff"
```

---

## Task 2: DB Schema

**Files:**
- Create: `db/schema/line.ts`
- Modify: `db/index.ts`

- [ ] **Step 1: สร้าง db/schema/line.ts**

```typescript
import { boolean, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { events } from './events'
import { athletes } from './athletes'

export const lineStateEnum = pgEnum('line_state', [
  'idle',
  'awaiting_event',
  'awaiting_bib',
  'awaiting_confirm',
  'awaiting_consent',
  'done',
])

export const lineSessions = pgTable('line_sessions', {
  lineUserId: text().primaryKey(),
  state: lineStateEnum().notNull().default('idle'),
  eventId: text().references(() => events.eventId, { onDelete: 'set null' }),
  bibNumber: text(),
  updatedAt: timestamp({ mode: 'date' }).defaultNow().notNull(),
})

export const athleteConsents = pgTable('athlete_consents', {
  consentId: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  athleteId: text()
    .notNull()
    .references(() => athletes.athleteId, { onDelete: 'cascade' }),
  consentVersion: text().notNull(),
  pdpaAccepted: boolean().notNull(),
  marketingAccepted: boolean().notNull().default(false),
  consentedAt: timestamp({ mode: 'date' }).defaultNow().notNull(),
})
```

- [ ] **Step 2: อัพเดต db/index.ts เพิ่ม line schema**

เปิด `db/index.ts` และเพิ่ม:

```typescript
import * as line from './schema/line'
```

เพิ่มในส่วน schema object:
```typescript
export const db = drizzle(sql, {
  schema: {
    ...sponsors,
    ...users,
    ...events,
    ...stations,
    ...athletes,
    ...athleteEventRegistrations,
    ...checkins,
    ...stamps,
    ...postMvp,
    ...line,          // ← เพิ่มบรรทัดนี้
  },
})
```

- [ ] **Step 3: Commit**

```bash
git add db/schema/line.ts db/index.ts
git commit -m "feat: add line_sessions and athlete_consents schema"
```

---

## Task 3: DB Migration

**Files:**
- Generate: `db/migrations/0004_line_registration.sql`

- [ ] **Step 1: Generate migration**

```bash
pnpm drizzle-kit generate
```

Expected: สร้างไฟล์ `db/migrations/0004_<name>.sql` ที่มี:
- `CREATE TYPE "public"."line_state" AS ENUM(...)`
- `CREATE TABLE "line_sessions" (...)`
- `CREATE TABLE "athlete_consents" (...)`

- [ ] **Step 2: Apply migration**

```bash
pnpm drizzle-kit migrate
```

Expected: `All migrations applied successfully` (หรือ `No migrations to apply` ถ้า Drizzle apply อัตโนมัติ)

> หาก `drizzle-kit migrate` ไม่มีใน package.json scripts ให้ดู scripts จาก `cat package.json | grep -A20 '"scripts"'` แล้วใช้คำสั่งที่ตรงกัน

- [ ] **Step 3: Commit**

```bash
git add db/migrations/
git commit -m "feat: migration 0004 — line_sessions and athlete_consents tables"
```

---

## Task 4: DB Queries

**Files:**
- Create: `db/queries/line.ts`

- [ ] **Step 1: สร้าง db/queries/line.ts**

```typescript
import { and, eq, inArray, not } from 'drizzle-orm'
import { db } from '@/db'
import { lineSessions, lineStateEnum, athleteConsents } from '@/db/schema/line'
import { athletes } from '@/db/schema/athletes'
import { events } from '@/db/schema/events'
import { athleteEventRegistrations } from '@/db/schema/athlete_event_registrations'

export type LineState = (typeof lineStateEnum.enumValues)[number]

export interface LineSession {
  lineUserId: string
  state: LineState
  eventId: string | null
  bibNumber: string | null
  updatedAt: Date
}

export interface ActiveEvent {
  eventId: string
  eventName: string
  startDate: string
  endDate: string
}

export interface RegistrationRow {
  registrationId: string
  athleteId: string | null
  bibNumber: string
  eventId: string
  athleteFirstName: string | null
  athleteLastName: string | null
  athleteDateOfBirth: string | null
  athleteLineUserId: string | null
}

// ─── Session ───────────────────────────────────────────────────────────────

export async function getLineSession(lineUserId: string): Promise<LineSession | null> {
  const rows = await db
    .select()
    .from(lineSessions)
    .where(eq(lineSessions.lineUserId, lineUserId))
    .limit(1)
  return rows[0] ?? null
}

export async function upsertLineSession(
  lineUserId: string,
  data: Partial<Omit<LineSession, 'lineUserId' | 'updatedAt'>>,
): Promise<void> {
  const now = new Date()
  await db
    .insert(lineSessions)
    .values({ lineUserId, state: 'idle', ...data, updatedAt: now })
    .onConflictDoUpdate({
      target: lineSessions.lineUserId,
      set: { ...data, updatedAt: now },
    })
}

// ─── Athletes ──────────────────────────────────────────────────────────────

export async function getAthleteByLineUserId(lineUserId: string) {
  const rows = await db
    .select()
    .from(athletes)
    .where(eq(athletes.lineUserId, lineUserId))
    .limit(1)
  return rows[0] ?? null
}

export async function linkAthleteLineId(athleteId: string, lineUserId: string): Promise<void> {
  await db
    .update(athletes)
    .set({ lineUserId })
    .where(eq(athletes.athleteId, athleteId))
}

// ─── Events ────────────────────────────────────────────────────────────────

export async function getActiveEvents(): Promise<ActiveEvent[]> {
  return db
    .select({
      eventId: events.eventId,
      eventName: events.eventName,
      startDate: events.startDate,
      endDate: events.endDate,
    })
    .from(events)
    .where(inArray(events.status, ['published', 'active']))
    .orderBy(events.startDate)
}

export async function getRegisteredEventIds(athleteId: string): Promise<string[]> {
  const rows = await db
    .select({ eventId: athleteEventRegistrations.eventId })
    .from(athleteEventRegistrations)
    .where(eq(athleteEventRegistrations.athleteId, athleteId))
  return rows.map((r) => r.eventId)
}

// ─── Registrations ─────────────────────────────────────────────────────────

export async function getRegistrationByBibAndEvent(
  bibNumber: string,
  eventId: string,
): Promise<RegistrationRow | null> {
  const rows = await db
    .select({
      registrationId: athleteEventRegistrations.registrationId,
      athleteId: athleteEventRegistrations.athleteId,
      bibNumber: athleteEventRegistrations.bibNumber,
      eventId: athleteEventRegistrations.eventId,
      athleteFirstName: athletes.firstName,
      athleteLastName: athletes.lastName,
      athleteDateOfBirth: athletes.dateOfBirth,
      athleteLineUserId: athletes.lineUserId,
    })
    .from(athleteEventRegistrations)
    .leftJoin(athletes, eq(athleteEventRegistrations.athleteId, athletes.athleteId))
    .where(
      and(
        eq(athleteEventRegistrations.bibNumber, bibNumber),
        eq(athleteEventRegistrations.eventId, eventId),
      ),
    )
    .limit(1)
  return rows[0] ?? null
}

export async function insertAthleteConsent(athleteId: string): Promise<void> {
  await db.insert(athleteConsents).values({
    athleteId,
    consentVersion: '2025-v1',
    pdpaAccepted: true,
    marketingAccepted: false,
  })
}

// ─── Registration (called from LIFF server action) ─────────────────────────

export async function createAthleteAndRegistration(data: {
  lineUserId: string
  eventId: string
  bibNumber: string
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: 'male' | 'female' | 'other'
}): Promise<{ athleteId: string }> {
  const athleteId = crypto.randomUUID()
  await db.insert(athletes).values({
    athleteId,
    firstName: data.firstName,
    lastName: data.lastName,
    dateOfBirth: data.dateOfBirth,
    gender: data.gender,
    lineUserId: data.lineUserId,
    status: 'active',
  })
  await db.insert(athleteEventRegistrations).values({
    registrationId: crypto.randomUUID(),
    athleteId,
    eventId: data.eventId,
    bibNumber: data.bibNumber,
    status: 'active',
  })
  return { athleteId }
}

export async function createRegistrationForExistingAthlete(data: {
  athleteId: string
  eventId: string
  bibNumber: string
}): Promise<void> {
  await db
    .insert(athleteEventRegistrations)
    .values({
      registrationId: crypto.randomUUID(),
      athleteId: data.athleteId,
      eventId: data.eventId,
      bibNumber: data.bibNumber,
      status: 'active',
    })
    .onConflictDoNothing()
}

export async function getEventById(eventId: string) {
  const rows = await db
    .select({ eventId: events.eventId, eventName: events.eventName })
    .from(events)
    .where(eq(events.eventId, eventId))
    .limit(1)
  return rows[0] ?? null
}
```

- [ ] **Step 2: Commit**

```bash
git add db/queries/line.ts
git commit -m "feat: add LINE DB queries (sessions, athletes, events, registrations)"
```

---

## Task 5: LINE Client

**Files:**
- Create: `lib/line-client.ts`

- [ ] **Step 1: สร้าง lib/line-client.ts**

```typescript
const LINE_REPLY_URL = 'https://api.line.me/v2/bot/message/reply'
const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push'

function authHeader() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
  }
}

export async function verifyLineSignature(body: string, signature: string): Promise<boolean> {
  const secret = process.env.LINE_CHANNEL_SECRET
  if (!secret) throw new Error('LINE_CHANNEL_SECRET not set')

  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signed = await crypto.subtle.sign('HMAC', key, enc.encode(body))
  const computed = Buffer.from(signed).toString('base64')
  return computed === signature
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function replyMessage(replyToken: string, messages: any[]): Promise<void> {
  await fetch(LINE_REPLY_URL, {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify({ replyToken, messages }),
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function pushMessage(to: string, messages: any[]): Promise<void> {
  await fetch(LINE_PUSH_URL, {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify({ to, messages }),
  })
}

export async function verifyLiffIdToken(idToken: string): Promise<string> {
  const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      id_token: idToken,
      client_id: '2010313786',
    }),
  })
  if (!res.ok) throw new Error('LIFF token verification failed')
  const data = await res.json() as { sub: string }
  return data.sub
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/line-client.ts
git commit -m "feat: add LINE client — signature verify, reply/push, LIFF token verify"
```

---

## Task 6: LINE Messages

**Files:**
- Create: `lib/line-messages.ts`

- [ ] **Step 1: สร้าง lib/line-messages.ts**

```typescript
import type { ActiveEvent } from '@/db/queries/line'

// ─── Types ─────────────────────────────────────────────────────────────────

interface TextMessage {
  type: 'text'
  text: string
  quickReply?: { items: QuickReplyItem[] }
}

interface QuickReplyItem {
  type: 'action'
  action: { type: 'postback'; label: string; data: string }
}

interface FlexMessage {
  type: 'flex'
  altText: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contents: any
}

export type LineMessage = TextMessage | FlexMessage

// ─── Helpers ───────────────────────────────────────────────────────────────

function postbackData(obj: Record<string, string>): string {
  return JSON.stringify(obj)
}

function eventQuickReply(events: ActiveEvent[]): { items: QuickReplyItem[] } {
  return {
    items: events.map((e) => ({
      type: 'action',
      action: {
        type: 'postback',
        label: e.eventName.slice(0, 20),
        data: postbackData({ action: 'select_event', eventId: e.eventId }),
      },
    })),
  }
}

// ─── Message Builders ──────────────────────────────────────────────────────

export function welcomeNewMessage(events: ActiveEvent[]): LineMessage {
  if (events.length === 1) {
    return {
      type: 'text',
      text: `ยินดีต้อนรับสู่ระบบลงทะเบียนกีฬา 🏃\nงาน: ${events[0].eventName}\nกรุณาพิมพ์หมายเลข BIB ของคุณ`,
    }
  }
  return {
    type: 'text',
    text: 'ยินดีต้อนรับสู่ระบบลงทะเบียนกีฬา 🏃\nมีงานที่เปิดรับลงทะเบียน — เลือกงานที่ต้องการ:',
    quickReply: eventQuickReply(events),
  }
}

export function welcomeBackMessage(firstName: string, events: ActiveEvent[]): LineMessage {
  if (events.length === 0) {
    return {
      type: 'text',
      text: `ยินดีต้อนรับกลับ ${firstName} 👋\nขณะนี้ไม่มีงานใหม่ที่เปิดรับลงทะเบียน`,
    }
  }
  if (events.length === 1) {
    return {
      type: 'text',
      text: `ยินดีต้อนรับกลับ ${firstName} 👋\nงาน: ${events[0].eventName}\nกรุณาพิมพ์หมายเลข BIB ของคุณ`,
    }
  }
  return {
    type: 'text',
    text: `ยินดีต้อนรับกลับ ${firstName} 👋\nเลือกงานที่ต้องการลงทะเบียนใหม่:`,
    quickReply: eventQuickReply(events),
  }
}

export function askBibMessage(eventName: string): LineMessage {
  return {
    type: 'text',
    text: `งาน: ${eventName}\nกรุณาพิมพ์หมายเลข BIB ของคุณ (ตัวเลข/อักษร/- ไม่เกิน 10 ตัว)`,
  }
}

export function consentFlex(): LineMessage {
  return {
    type: 'flex',
    altText: 'กรุณายืนยันการยินยอมข้อมูลส่วนบุคคล (PDPA)',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: 'ข้อตกลงการใช้ข้อมูลส่วนบุคคล',
            weight: 'bold',
            size: 'md',
          },
          {
            type: 'text',
            text: 'ระบบจะเก็บข้อมูลชื่อ นามสกุล วันเกิด และ LINE ID ของท่านเพื่อใช้ในการลงทะเบียนงานกีฬาเท่านั้น ข้อมูลจะไม่ถูกเปิดเผยแก่บุคคลภายนอก',
            wrap: true,
            size: 'sm',
            color: '#555555',
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            action: {
              type: 'postback',
              label: 'ยอมรับ',
              data: postbackData({ action: 'consent_accept' }),
            },
          },
          {
            type: 'button',
            style: 'secondary',
            action: {
              type: 'postback',
              label: 'ไม่ยอมรับ',
              data: postbackData({ action: 'consent_decline' }),
            },
          },
        ],
      },
    },
  }
}

export function confirmRecordFlex(
  firstName: string,
  lastName: string,
  dob: string,
): LineMessage {
  return {
    type: 'flex',
    altText: 'ยืนยันข้อมูลนักกีฬา',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: 'พบข้อมูลนักกีฬา', weight: 'bold' },
          { type: 'text', text: `ชื่อ: ${firstName} ${lastName}`, size: 'sm' },
          { type: 'text', text: `วันเกิด: ${dob}`, size: 'sm' },
          {
            type: 'text',
            text: 'ข้อมูลนี้ใช่ท่านหรือไม่?',
            size: 'sm',
            color: '#555555',
            wrap: true,
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            action: {
              type: 'postback',
              label: 'ใช่ คือฉัน',
              data: postbackData({ action: 'confirm_yes' }),
            },
          },
          {
            type: 'button',
            style: 'secondary',
            action: {
              type: 'postback',
              label: 'ไม่ใช่',
              data: postbackData({ action: 'confirm_no' }),
            },
          },
        ],
      },
    },
  }
}

export function liffLinkMessage(liffUrl: string): LineMessage {
  return {
    type: 'text',
    text: `ยอดเยี่ยม! กรุณากรอกข้อมูลให้ครบถ้วน:\n${liffUrl}`,
  }
}

export function successMessage(firstName: string, bib: string, eventName: string): LineMessage {
  return {
    type: 'text',
    text: `✅ ลงทะเบียนสำเร็จ!\nชื่อ: ${firstName}\nBIB: ${bib}\nงาน: ${eventName}\n\nพบกันที่งาน! 🏃‍♂️`,
  }
}

type ErrorType = 'bib_format' | 'bib_taken' | 'no_events' | 'consent_declined'

const ERROR_TEXTS: Record<ErrorType, string> = {
  bib_format:
    'รูปแบบ BIB ไม่ถูกต้อง\nกรุณาพิมพ์ BIB ใหม่ (ตัวเลข/อักษรอังกฤษ/- ไม่เกิน 10 ตัว)',
  bib_taken: 'BIB นี้ถูกลงทะเบียนไปแล้ว\nหากเชื่อว่ามีข้อผิดพลาด กรุณาติดต่อผู้จัดงาน',
  no_events: 'ขณะนี้ไม่มีงานที่เปิดรับลงทะเบียน\nกรุณาติดตามประกาศจากผู้จัดงาน',
  consent_declined:
    'ยกเลิกการลงทะเบียนเรียบร้อยแล้ว\nหากต้องการลงทะเบียนใหม่ ให้พิมพ์ข้อความใดก็ได้',
}

export function errorMessage(type: ErrorType): LineMessage {
  return { type: 'text', text: ERROR_TEXTS[type] }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/line-messages.ts
git commit -m "feat: add LINE message builders (Flex, QuickReply, text)"
```

---

## Task 7: State Machine + Unit Tests

**Files:**
- Create: `lib/line-state.ts`
- Create: `tests/line-state.test.ts`
- Create: `tests/line-messages.test.ts`

- [ ] **Step 1: เขียน unit test สำหรับ isValidBib ก่อน**

สร้าง `tests/line-state.test.ts`:
```typescript
import { describe, expect, it } from 'vitest'
import { isValidBib } from '@/lib/line-state'

describe('isValidBib', () => {
  it.each([
    ['123', true],
    ['ABC', true],
    ['A-1', true],
    ['A1B2-CD3E', true],
    ['A1B2C3D4E5', true],     // 10 ตัว — ผ่าน
    ['', false],               // ว่าง
    ['12345678901', false],    // 11 ตัว — เกิน
    ['A@1', false],            // special char
    ['A 1', false],            // space
    ['ABC-123-XYZ', false],    // 11 ตัว
  ])('isValidBib(%s) → %s', (bib, expected) => {
    expect(isValidBib(bib)).toBe(expected)
  })
})
```

สร้าง `tests/line-messages.test.ts`:
```typescript
import { describe, expect, it } from 'vitest'
import {
  askBibMessage,
  errorMessage,
  successMessage,
  liffLinkMessage,
} from '@/lib/line-messages'

describe('errorMessage', () => {
  it.each(['bib_format', 'bib_taken', 'no_events', 'consent_declined'] as const)(
    'returns text message for %s',
    (type) => {
      const msg = errorMessage(type)
      expect(msg.type).toBe('text')
      expect((msg as { text: string }).text.length).toBeGreaterThan(0)
    },
  )
})

describe('askBibMessage', () => {
  it('includes event name', () => {
    const msg = askBibMessage('วิ่งปัตตานี') as { type: string; text: string }
    expect(msg.type).toBe('text')
    expect(msg.text).toContain('วิ่งปัตตานี')
  })
})

describe('successMessage', () => {
  it('includes firstName, bib, eventName', () => {
    const msg = successMessage('สมชาย', 'A-1', 'งานวิ่ง') as { type: string; text: string }
    expect(msg.text).toContain('สมชาย')
    expect(msg.text).toContain('A-1')
    expect(msg.text).toContain('งานวิ่ง')
  })
})

describe('liffLinkMessage', () => {
  it('includes the URL', () => {
    const url = 'https://liff.line.me/2010313814-yt06X2oB/event123'
    const msg = liffLinkMessage(url) as { type: string; text: string }
    expect(msg.text).toContain(url)
  })
})
```

- [ ] **Step 2: รัน test ดูว่า fail (lib/line-state.ts ยังไม่มี)**

```bash
pnpm vitest run tests/line-state.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/line-state'`

- [ ] **Step 3: สร้าง lib/line-state.ts**

```typescript
import {
  getActiveEvents,
  getAthleteByLineUserId,
  getEventById,
  getLineSession,
  getRegisteredEventIds,
  getRegistrationByBibAndEvent,
  insertAthleteConsent,
  linkAthleteLineId,
  upsertLineSession,
} from '@/db/queries/line'
import { replyMessage } from '@/lib/line-client'
import {
  askBibMessage,
  confirmRecordFlex,
  consentFlex,
  errorMessage,
  liffLinkMessage,
  successMessage,
  welcomeBackMessage,
  welcomeNewMessage,
} from '@/lib/line-messages'

const LIFF_BASE = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}`

export function isValidBib(bib: string): boolean {
  return /^[A-Za-z0-9\-]{1,10}$/.test(bib)
}

function liffUrl(eventId: string, bib: string): string {
  return `${LIFF_BASE}/${eventId}?bib=${encodeURIComponent(bib)}`
}

// ─── Entry points ──────────────────────────────────────────────────────────

export async function startFlow(lineUserId: string, replyToken: string): Promise<void> {
  const existingAthlete = await getAthleteByLineUserId(lineUserId)
  const allActive = await getActiveEvents()

  if (existingAthlete) {
    // Returning member
    const registeredIds = await getRegisteredEventIds(existingAthlete.athleteId)
    const available = allActive.filter((e) => !registeredIds.includes(e.eventId))

    if (available.length === 0) {
      await replyMessage(replyToken, [errorMessage('no_events')])
      return
    }

    if (available.length === 1) {
      await upsertLineSession(lineUserId, { state: 'awaiting_bib', eventId: available[0].eventId })
      await replyMessage(replyToken, [welcomeBackMessage(existingAthlete.firstName, [available[0]])])
      return
    }

    await upsertLineSession(lineUserId, { state: 'awaiting_event', eventId: null })
    await replyMessage(replyToken, [welcomeBackMessage(existingAthlete.firstName, available)])
    return
  }

  // New or imported member
  if (allActive.length === 0) {
    await replyMessage(replyToken, [errorMessage('no_events')])
    return
  }

  if (allActive.length === 1) {
    await upsertLineSession(lineUserId, { state: 'awaiting_bib', eventId: allActive[0].eventId })
    await replyMessage(replyToken, [welcomeNewMessage([allActive[0]])])
    return
  }

  await upsertLineSession(lineUserId, { state: 'awaiting_event', eventId: null })
  await replyMessage(replyToken, [welcomeNewMessage(allActive)])
}

export async function handleText(
  lineUserId: string,
  text: string,
  replyToken: string,
): Promise<void> {
  const session = await getLineSession(lineUserId)

  if (!session || session.state === 'idle' || session.state === 'done') {
    await startFlow(lineUserId, replyToken)
    return
  }

  if (session.state === 'awaiting_bib') {
    await handleBib(lineUserId, text, session.eventId!, replyToken)
    return
  }

  // awaiting_event / awaiting_confirm / awaiting_consent — ผู้ใช้ควรกดปุ่ม
  await replyMessage(replyToken, [
    { type: 'text', text: 'กรุณาตอบด้วยการกดปุ่มด้านบน' },
  ])
}

export async function handleBib(
  lineUserId: string,
  bib: string,
  eventId: string,
  replyToken: string,
): Promise<void> {
  if (!isValidBib(bib)) {
    await replyMessage(replyToken, [errorMessage('bib_format')])
    return
  }

  const registration = await getRegistrationByBibAndEvent(bib, eventId)

  if (registration) {
    if (registration.athleteLineUserId) {
      // BIB already has a LINE user linked → taken
      await replyMessage(replyToken, [errorMessage('bib_taken')])
      return
    }

    // Imported athlete — ask to confirm identity
    await upsertLineSession(lineUserId, { state: 'awaiting_confirm', bibNumber: bib })
    await replyMessage(replyToken, [
      confirmRecordFlex(
        registration.athleteFirstName ?? '',
        registration.athleteLastName ?? '',
        registration.athleteDateOfBirth ?? '',
      ),
    ])
    return
  }

  // BIB not in registrations
  const existingAthlete = await getAthleteByLineUserId(lineUserId)

  if (existingAthlete) {
    // Returning member → skip consent, send LIFF
    await upsertLineSession(lineUserId, { state: 'done' })
    await replyMessage(replyToken, [liffLinkMessage(liffUrl(eventId, bib))])
    return
  }

  // New member → show consent
  await upsertLineSession(lineUserId, { state: 'awaiting_consent', bibNumber: bib })
  await replyMessage(replyToken, [consentFlex()])
}

export async function handlePostback(
  lineUserId: string,
  data: Record<string, string>,
  replyToken: string,
): Promise<void> {
  const session = await getLineSession(lineUserId)
  const action = data.action

  if (action === 'select_event') {
    const eventId = data.eventId
    const event = await getEventById(eventId)
    if (!event) {
      await replyMessage(replyToken, [{ type: 'text', text: 'ไม่พบงานที่เลือก' }])
      return
    }
    await upsertLineSession(lineUserId, { state: 'awaiting_bib', eventId })
    await replyMessage(replyToken, [askBibMessage(event.eventName)])
    return
  }

  if (action === 'confirm_yes') {
    if (!session?.eventId || !session.bibNumber) {
      await startFlow(lineUserId, replyToken)
      return
    }
    const registration = await getRegistrationByBibAndEvent(session.bibNumber, session.eventId)
    if (!registration?.athleteId) {
      await replyMessage(replyToken, [{ type: 'text', text: 'ไม่พบข้อมูล กรุณาลองใหม่อีกครั้ง' }])
      return
    }
    await linkAthleteLineId(registration.athleteId, lineUserId)
    await upsertLineSession(lineUserId, { state: 'done' })
    const event = await getEventById(session.eventId)
    await replyMessage(replyToken, [
      successMessage(
        registration.athleteFirstName ?? '',
        session.bibNumber,
        event?.eventName ?? '',
      ),
    ])
    return
  }

  if (action === 'confirm_no') {
    await upsertLineSession(lineUserId, { state: 'awaiting_bib', bibNumber: null })
    const eventId = session?.eventId
    if (eventId) {
      const event = await getEventById(eventId)
      await replyMessage(replyToken, [askBibMessage(event?.eventName ?? '')])
    } else {
      await startFlow(lineUserId, replyToken)
    }
    return
  }

  if (action === 'consent_accept') {
    if (!session?.eventId || !session.bibNumber) {
      await startFlow(lineUserId, replyToken)
      return
    }
    // Create a temp athlete record to store consent — actual data filled via LIFF
    // Consent stored after LIFF submission instead; just send LIFF link now
    await upsertLineSession(lineUserId, { state: 'done' })
    await replyMessage(replyToken, [liffLinkMessage(liffUrl(session.eventId, session.bibNumber))])
    return
  }

  if (action === 'consent_decline') {
    await upsertLineSession(lineUserId, { state: 'idle', eventId: null, bibNumber: null })
    await replyMessage(replyToken, [errorMessage('consent_declined')])
    return
  }

  // Unknown action
  await replyMessage(replyToken, [{ type: 'text', text: 'กรุณาลองใหม่อีกครั้ง' }])
}
```

- [ ] **Step 4: รัน tests ทั้งหมด**

```bash
pnpm vitest run tests/line-state.test.ts tests/line-messages.test.ts
```

Expected: PASS ทุก test

- [ ] **Step 5: Commit**

```bash
git add lib/line-state.ts tests/line-state.test.ts tests/line-messages.test.ts
git commit -m "feat: add LINE state machine + unit tests"
```

---

## Task 8: Webhook Route

**Files:**
- Create: `app/api/line/webhook/route.ts`

- [ ] **Step 1: สร้าง directory และ route**

```bash
mkdir -p app/api/line/webhook
```

สร้าง `app/api/line/webhook/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifyLineSignature } from '@/lib/line-client'
import { handlePostback, handleText, startFlow } from '@/lib/line-state'

interface LineEvent {
  type: string
  replyToken?: string
  source: { userId: string }
  message?: { type: string; text: string }
  postback?: { data: string }
}

interface LineWebhookBody {
  events: LineEvent[]
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text()
  const signature = req.headers.get('x-line-signature') ?? ''

  const valid = await verifyLineSignature(body, signature)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(body) as LineWebhookBody

  // Process events concurrently but don't let one failure kill others
  await Promise.allSettled(
    payload.events.map(async (event) => {
      const lineUserId = event.source.userId
      const replyToken = event.replyToken ?? ''

      if (event.type === 'follow') {
        await startFlow(lineUserId, replyToken)
        return
      }

      if (event.type === 'message' && event.message?.type === 'text') {
        await handleText(lineUserId, event.message.text.trim(), replyToken)
        return
      }

      if (event.type === 'postback' && event.postback?.data) {
        const data = JSON.parse(event.postback.data) as Record<string, string>
        await handlePostback(lineUserId, data, replyToken)
        return
      }
    }),
  )

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/line/webhook/route.ts
git commit -m "feat: add LINE webhook POST route with signature verification"
```

---

## Task 9: LIFF Layout + Page + Action

**Files:**
- Create: `app/(liff)/layout.tsx`
- Create: `app/(liff)/register/[eventId]/page.tsx`
- Create: `app/(liff)/register/[eventId]/actions.ts`

- [ ] **Step 1: สร้าง LIFF layout**

```bash
mkdir -p "app/(liff)/register/[eventId]"
```

สร้าง `app/(liff)/layout.tsx`:

```tsx
export default function LiffLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: สร้าง server action**

สร้าง `app/(liff)/register/[eventId]/actions.ts`:

```typescript
'use server'

import { verifyLiffIdToken } from '@/lib/line-client'
import {
  createAthleteAndRegistration,
  createRegistrationForExistingAthlete,
  getAthleteByLineUserId,
  getEventById,
  insertAthleteConsent,
} from '@/db/queries/line'
import { pushMessage } from '@/lib/line-client'
import { successMessage } from '@/lib/line-messages'

export type RegisterState =
  | null
  | { ok: true; firstName: string; bib: string; eventName: string }
  | { ok: false; error: string }

export async function registerViaLine(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const liffIdToken = formData.get('liffIdToken') as string
  const eventId = formData.get('eventId') as string
  const bib = formData.get('bib') as string
  const firstName = (formData.get('firstName') as string).trim()
  const lastName = (formData.get('lastName') as string).trim()
  const dateOfBirth = formData.get('dateOfBirth') as string
  const gender = formData.get('gender') as 'male' | 'female' | 'other'

  if (!firstName || !lastName || !dateOfBirth || !gender) {
    return { ok: false, error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }
  }

  let lineUserId: string
  try {
    lineUserId = await verifyLiffIdToken(liffIdToken)
  } catch {
    return { ok: false, error: 'ยืนยันตัวตนไม่สำเร็จ กรุณาลองใหม่' }
  }

  const event = await getEventById(eventId)
  if (!event) return { ok: false, error: 'ไม่พบงาน' }

  try {
    const existing = await getAthleteByLineUserId(lineUserId)

    if (existing) {
      await createRegistrationForExistingAthlete({
        athleteId: existing.athleteId,
        eventId,
        bibNumber: bib,
      })
    } else {
      const { athleteId } = await createAthleteAndRegistration({
        lineUserId,
        eventId,
        bibNumber: bib,
        firstName,
        lastName,
        dateOfBirth,
        gender,
      })
      await insertAthleteConsent(athleteId)
    }

    await pushMessage(lineUserId, [successMessage(firstName, bib, event.eventName)])
    return { ok: true, firstName, bib, eventName: event.eventName }
  } catch {
    return { ok: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }
  }
}
```

- [ ] **Step 3: สร้าง LIFF page**

สร้าง `app/(liff)/register/[eventId]/page.tsx`:

```tsx
'use client'

import { use, useActionState, useEffect, useState } from 'react'
import liff from '@line/liff'
import { registerViaLine } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  params: Promise<{ eventId: string }>
  searchParams: Promise<{ bib?: string }>
}

export default function RegisterPage({ params, searchParams }: Props) {
  const { eventId } = use(params)
  const { bib = '' } = use(searchParams)
  const [idToken, setIdToken] = useState<string | null>(null)
  const [firstName, setFirstName] = useState('')
  const [gender, setGender] = useState('')
  const [ready, setReady] = useState(false)
  const [liffError, setLiffError] = useState<string | null>(null)
  const [state, action, pending] = useActionState(registerViaLine, null)

  useEffect(() => {
    liff
      .init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! })
      .then(async () => {
        if (!liff.isLoggedIn()) {
          liff.login()
          return
        }
        const token = liff.getIDToken()
        const profile = await liff.getProfile()
        setIdToken(token)
        setFirstName(profile.displayName.split(' ')[0])
        setReady(true)
      })
      .catch(() => setLiffError('ไม่สามารถเชื่อมต่อ LINE ได้ กรุณาเปิดผ่าน LINE'))
  }, [])

  if (liffError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-center text-red-600">{liffError}</p>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">กำลังโหลด...</p>
      </div>
    )
  }

  if (state?.ok) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-4xl">✅</p>
        <h1 className="text-xl font-bold">ลงทะเบียนสำเร็จ!</h1>
        <p className="text-muted-foreground">
          {state.firstName} · BIB {state.bib}
          <br />
          {state.eventName}
        </p>
        <Button onClick={() => liff.closeWindow()}>ปิดหน้านี้</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <Card>
        <CardHeader>
          <CardTitle>ลงทะเบียนนักกีฬา</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <input type="hidden" name="liffIdToken" value={idToken ?? ''} />
            <input type="hidden" name="eventId" value={eventId} />

            <div className="space-y-1">
              <Label>หมายเลข BIB</Label>
              <Input name="bib" value={bib} readOnly className="bg-muted" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="firstName">ชื่อจริง</Label>
              <Input
                id="firstName"
                name="firstName"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="ชื่อจริง"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="lastName">นามสกุล</Label>
              <Input id="lastName" name="lastName" required placeholder="นามสกุล" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="dateOfBirth">วันเกิด</Label>
              <Input id="dateOfBirth" name="dateOfBirth" type="date" required />
            </div>

            <div className="space-y-1">
              <Label>เพศ</Label>
              <Select name="gender" value={gender} onValueChange={setGender} required>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกเพศ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">ชาย</SelectItem>
                  <SelectItem value="female">หญิง</SelectItem>
                  <SelectItem value="other">อื่นๆ</SelectItem>
                </SelectContent>
              </Select>
              <input type="hidden" name="gender" value={gender} />
            </div>

            {state && !state.ok && (
              <p className="text-sm text-red-600">{state.error}</p>
            )}

            <Button type="submit" className="w-full" disabled={pending || !gender}>
              {pending ? 'กำลังบันทึก...' : 'ยืนยันการลงทะเบียน'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add "app/(liff)/"
git commit -m "feat: add LIFF registration page and registerViaLine server action"
```

---

## Task 10: Dashboard Copy Link Button

**Files:**
- Create: `app/(dashboard)/dashboard/events/[id]/_components/copy-liff-link-button.tsx`
- Modify: `app/(dashboard)/dashboard/events/[id]/page.tsx`

- [ ] **Step 1: สร้าง CopyLiffLinkButton component**

สร้าง `app/(dashboard)/dashboard/events/[id]/_components/copy-liff-link-button.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Link2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  eventId: string
}

export function CopyLiffLinkButton({ eventId }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID
    const url = `https://liff.line.me/${liffId}/${eventId}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
      {copied ? 'คัดลอกแล้ว!' : 'ลิงก์ลงทะเบียน'}
    </Button>
  )
}
```

- [ ] **Step 2: เพิ่ม CopyLiffLinkButton ใน event detail page**

เปิด `app/(dashboard)/dashboard/events/[id]/page.tsx`

เพิ่ม import:
```typescript
import { CopyLiffLinkButton } from './_components/copy-liff-link-button'
```

หา block `{canEdit && (` ในส่วน header card แล้วเพิ่ม button ลงไปใน `<div className="flex items-center gap-2">`:

```tsx
{canEdit && (
  <div className="flex items-center gap-2">
    {(event.status === 'published' || event.status === 'active') && (
      <CopyLiffLinkButton eventId={event.eventId} />
    )}
    {event.status === 'draft' && (
      <DeleteEventButton eventId={event.eventId} />
    )}
    <StatusButtons eventId={event.eventId} currentStatus={event.status} />
    <Button size="sm" asChild>
      <Link href={`/dashboard/events/${id}/edit`}>
        <Pencil className="size-4" />
        แก้ไข
      </Link>
    </Button>
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/dashboard/events/[id]/_components/copy-liff-link-button.tsx"
git add "app/(dashboard)/dashboard/events/[id]/page.tsx"
git commit -m "feat: add copy LIFF registration link button on event detail page"
```

---

## Task 11: Deploy + LINE Console Config

- [ ] **Step 1: เพิ่ม LINE env vars ใน Vercel**

```bash
vercel env add LINE_CHANNEL_SECRET production
# พิมพ์: 82bdd3949a39247b3a4402c9b612bca3

vercel env add LINE_CHANNEL_ACCESS_TOKEN production
# วาง access token ทั้งหมด

vercel env add NEXT_PUBLIC_LIFF_ID production
# พิมพ์: 2010313814-yt06X2oB
```

- [ ] **Step 2: Deploy to Vercel**

```bash
vercel --prod
```

Expected: deployment สำเร็จ → `https://macim-sport.vercel.app` ✅

- [ ] **Step 3: ตั้งค่า Webhook URL ใน LINE Developers Console**

เปิด [LINE Developers Console](https://developers.line.biz/) → Messaging API channel → Messaging API tab:
1. Webhook URL → ใส่: `https://macim-sport.vercel.app/api/line/webhook`
2. กด **Verify** → ต้องได้ "Success"
3. เปิด **Use webhook** toggle

- [ ] **Step 4: ตั้งค่า LIFF Endpoint URL**

ใน LINE Developers Console → เลือก LIFF app `2010313814-yt06X2oB` → Edit:
1. Endpoint URL → ใส่: `https://macim-sport.vercel.app/register`
2. กด **Update**

- [ ] **Step 5: ทดสอบ Flow 1 (New Member)**

1. เปิด LINE → Add Friend ด้วย Channel ID `2010313786`
2. ส่งข้อความใดก็ได้
3. ตรวจสอบ bot ตอบ welcome + (Quick Reply buttons ถ้า >1 event / ถาม BIB ถ้า 1 event)
4. ส่ง BIB ที่ไม่มีในระบบ
5. ตรวจสอบ consent Flex ปรากฏ
6. กด "ยอมรับ" → ตรวจสอบ LIFF link ส่งมา
7. เปิด link → กรอก form ให้ครบ → กด "ยืนยัน"
8. ตรวจสอบ success message ใน LINE chat
9. ตรวจสอบ DB: `athletes` และ `athlete_event_registrations` มี record ใหม่

- [ ] **Step 6: ทดสอบ Flow 3 (Imported Member)**

1. ตรวจสอบว่ามี record ใน `athlete_event_registrations` ที่ `athleteId` ไม่ null และ athlete ไม่มี `lineUserId`
2. ส่งข้อความใน LINE → เลือก event → ส่ง BIB ที่ตรงกับ record นั้น
3. ตรวจสอบ confirmRecord Flex ปรากฏ (ชื่อ + วันเกิด)
4. กด "ใช่ คือฉัน" → ตรวจสอบ success message
5. ตรวจสอบ DB: `athletes.lineUserId` อัพเดตแล้ว

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "feat: complete LINE self-registration — webhook, LIFF, dashboard link"
```
