# Queue × Station Link — Plan Addendum

ต่อยอดจาก [station-queue](2026-06-17-station-queue.md) — ผูก queue counter เข้ากับ check-in station

## การตัดสินใจ (ยืนยันกับผู้ใช้)
- **1 station = 1 counter** (stationId unique, NOT NULL — counter ผูก station เสมอ)
- ปุ่ม "จัดการคิว" ต่อ station → **auto-create counter (ชื่อ = ชื่อ station) ถ้ายังไม่มี แล้ว redirect เข้า board**
- **เอาหน้า event-level `/queue` ออก** — จัดการคิวผ่าน station เท่านั้น

## สถานะ prod
queue_counters / queue_entries ว่าง (0/0) → เพิ่ม stationId NOT NULL ได้ปลอดภัย

## 1. Schema (`db/schema/queue.ts`)
เพิ่มใน `queueCounters`:
```ts
stationId: text().notNull().references(() => stations.stationId, { onDelete: 'cascade' }),
```
(import `stations` จาก `./stations`) + unique index:
```ts
uniqueIndex('queue_counters_station_idx').on(t.stationId)
```
generate migration 0009 → apply surgical (`scripts/apply-migration-queue.mts` ชี้ไฟล์ใหม่; **ห้าม db:push**)

## 2. Queries (`db/queries/queue.ts`)
- เพิ่ม `getOrCreateCounterForStation(stationId): Promise<string | null>`:
  - lookup station (stationId, stationName, eventId); ถ้าไม่มี → null
  - หา counter เดิมด้วย stationId → ถ้ามีคืน counterId
  - ไม่มี → insert {eventId: station.eventId, stationId, counterName: station.stationName} `.onConflictDoNothing()` → ถ้า insert ไม่คืน (ชน unique race) re-select → คืน counterId
- เพิ่ม `stationId` ใน select ของ `getCounter` + field ใน `CounterRow`
- ลบ `createCounter` และ `listCountersByEvent` (ไม่ใช้แล้วหลังลบหน้า event-level)

## 3. UI
**ลบ:**
- `app/(dashboard)/dashboard/events/[id]/queue/page.tsx`
- `app/(dashboard)/dashboard/events/[id]/queue/actions.ts`
- `app/(dashboard)/dashboard/events/[id]/queue/_components/counter-create-form.tsx`
- `app/(dashboard)/dashboard/events/[id]/queue/_components/delete-counter-button.tsx`
- ลบ block ปุ่ม "จัดการคิว" (header) ที่เพิ่มใน Task 11 ออกจาก `app/(dashboard)/dashboard/events/[id]/page.tsx` (คืน stationsContent header เป็นเดิม: `{canFullEdit && <div className="flex justify-end"><AddStationDialog .../></div>}`)

**คงไว้:** `_components/queue-qr-button.tsx`, board (`[counterId]/board/...`)

**สร้าง server action** `app/(dashboard)/dashboard/events/[id]/stations/queue-actions.ts`:
```ts
'use server'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS } from '@/lib/rbac'
import { getOrCreateCounterForStation } from '@/db/queries/queue'

export async function openStationQueueAction(eventId: string, stationId: string) {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')
  if (!canAccess(PERMISSIONS.QUEUE_OPERATE, session.user)) redirect('/dashboard')
  const counterId = await getOrCreateCounterForStation(stationId)
  if (!counterId) redirect(`/dashboard/events/${eventId}`)
  redirect(`/dashboard/events/${eventId}/queue/${counterId}/board`)
}
```
(redirect() โยน error ที่ Next จับ — ต้องอยู่นอก try/catch)

**สร้าง client** `app/(dashboard)/dashboard/events/[id]/stations/manage-queue-button.tsx`:
ปุ่มเรียก `openStationQueueAction(eventId, stationId)` ใน `useTransition` (เหมือน pattern ToggleStationButton) label "จัดการคิว"

**เพิ่มปุ่มในแถว station 2 ที่** (ใน action cell, กลุ่มเดียวกับ ToggleStationButton):
- `app/(dashboard)/dashboard/events/[id]/stations/page.tsx`
- `app/(dashboard)/dashboard/events/[id]/page.tsx` (stationsContent table)
แสดงเมื่อ `canEdit` (เหมือน ToggleStationButton)

## 4. Board page — เพิ่ม QR
`app/(dashboard)/dashboard/events/[id]/queue/[counterId]/board/page.tsx`:
หลัง getBoard → sign token + render QR (counter นี้ผูก station อยู่แล้ว):
```ts
import { signQueueToken } from '@/lib/queue-token'
import { QueueQrButton } from '../../_components/queue-qr-button'
const LIFF_BASE = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}`
const liffUrl = `${LIFF_BASE}/queue/${await signQueueToken({ counterId, eventId })}`
```
ส่ง `liffUrl` ไปแสดงปุ่ม QR บน board (ใส่ใน board client header หรือวางข้าง heading ใน page) — แสดง QueueQrButton(counterName, liffUrl)

## 5. ตรวจ
- `pnpm typecheck` ผ่าน, `pnpm test` ผ่าน, `pnpm build` ผ่าน (lint ข้าม — พังทั้ง repo)
- ยืนยันไม่มี import ค้างไปยังไฟล์ที่ลบ (queue/page, counter-create-form, delete-counter-button, createCounter, listCountersByEvent)
