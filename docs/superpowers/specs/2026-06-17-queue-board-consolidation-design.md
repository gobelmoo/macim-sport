# ยุบหน้าจัดคิว + Redesign Board — Design

วันที่: 2026-06-17
สถานะ: รอ review spec ก่อนทำ implementation plan

## 1. เป้าหมาย
ตอนนี้มีหน้าคุมคิว 2 ที่ที่ render `QueueBoard` ตัวเดียวกัน:
- dashboard board `/dashboard/events/[id]/queue/[counterId]/board` (login, session)
- staff board `/station-queue/[token]` (no-login, operate token)

ซ้ำซ้อน → **ยุบเหลือ staff board ที่เดียว** (`/station-queue/[token]`) และ **redesign จอใหม่** ให้ใช้ง่าย เข้าใจง่าย สวยงาม (mobile-first, responsive)

## 2. สถาปัตยกรรมการยุบ

### 2.1 ลบ dashboard board
- ลบ route `app/(dashboard)/dashboard/events/[id]/queue/[counterId]/board/` ทั้งโฟลเดอร์ (page.tsx, actions.ts, _components/queue-board.tsx)
- ย้าย/สร้างใหม่ที่ `(station-queue)`:
  - `app/(station-queue)/station-queue/[token]/_components/queue-board.tsx` (redesigned)
  - `app/(station-queue)/station-queue/[token]/actions.ts` (token-only)
- ย้าย `app/(dashboard)/dashboard/events/[id]/queue/_components/queue-qr-button.tsx` → `app/_components/queue-qr-button.tsx` (เป็น shared, ใช้ใน board + modal)
- ตรวจว่าไม่เหลือโฟลเดอร์ `.../queue/[counterId]/` (ถ้าโฟลเดอร์ `queue/` ว่างเปล่าหลังลบ ให้ลบทิ้ง — แต่ `queue/_components/queue-qr-button.tsx` ย้ายออกแล้ว ดังนั้นทั้ง `queue/` ถูกลบ)

### 2.2 Actions เหลือ token-only (altitude win)
เพราะ board เป็น token เสมอ และ token บรรจุ `{counterId, eventId, scope}` อยู่แล้ว → actions **ไม่ต้องรับ eventId/counterId แยก** ดึงจาก token เอง:

```ts
// app/(station-queue)/station-queue/[token]/actions.ts
'use server'
import { revalidatePath } from 'next/cache'
import { verifyQueueToken } from '@/lib/queue-token'
import { enqueue, nextQueue, requeueEntry, resetCounter, setCounterOpen, skipEntry } from '@/db/queries/queue'
import { getRegistrationByBibAndEvent } from '@/db/queries/line'
import { isValidBib } from '@/lib/line-state'

type Result = { ok: true; message?: string } | { ok: false; message: string }
const DENY = { ok: false, message: 'ไม่มีสิทธิ์' } as const

async function ctx(token: string) {
  const p = await verifyQueueToken(token, 'operate')
  if (!p) return null
  return { counterId: p.counterId, eventId: p.eventId, revalidate: () => revalidatePath(`/station-queue/${token}`) }
}

export async function toggleOpenAction(token: string, isOpen: boolean): Promise<Result> { ... }
export async function resetCounterAction(token: string): Promise<Result> { ... }
export async function nextQueueAction(token: string): Promise<Result> { ... }
export async function skipEntryAction(token: string, entryId: string): Promise<Result> { ... }
export async function requeueEntryAction(token: string, entryId: string): Promise<Result> { ... }
export async function addQueueAction(token: string, rawInput: string): Promise<Result> { ... } // BIB-or-name (ตามที่มีอยู่)
```
- `resolveBoardCtx` แบบ session/token เดิม → ลบ branch session ออก (เหลือ token อย่างเดียว)
- `addQueueAction` ตรรกะเดิม (BIB ที่ลงทะเบียน → ผูกนักกีฬา / มิฉะนั้น non-member) แค่เปลี่ยนมารับ token แทน eventId/counterId
- QueueBoard เรียก action ด้วย `token` + arg เฉพาะ (เลิก thread eventId/counterId 8 จุด)

### 2.3 "จัดการคิว" ที่ station → modal (ไม่ redirect)
- `app/(dashboard)/dashboard/events/[id]/stations/queue-actions.ts`: เปลี่ยน `openStationQueueAction` (redirect) → `getStationQueueLinkAction(stationId): Promise<{ ok: true; url: string } | { ok: false; message }>`
  - auth (QUEUE_OPERATE) → `getOrCreateCounterForStation(stationId)` → ถ้าได้ counterId → sign operate token → คืน `${APP_BASE}/station-queue/${token}`
- `manage-queue-button.tsx`: เปลี่ยนเป็น client ที่เปิด **Dialog** เมื่อกด:
  - on open → เรียก `getStationQueueLinkAction` → ได้ url
  - แสดง **QR (`QueueQrButton` หรือ `QRCodeSVG`) + url + ปุ่มคัดลอก + ปุ่ม "เปิดหน้าคุมคิว"** (`<a href={url}>` หรือ window.open)
  - ระหว่างโหลดแสดง spinner/"กำลังเตรียม..."

## 3. Redesigned Board (Approach 1 — hero-focused, responsive)

### 3.1 Props
`QueueBoard({ board, token, liffUrl, shareUrl })`
- `board: BoardData` (เดิม)
- `token: string` (operate — ส่งเข้า actions)
- `liffUrl: string` — QR ให้นักกีฬาขอคิว (request scope, sign ในหน้า page)
- `shareUrl: string` — URL หน้าจอนี้เอง (`${APP_BASE}/station-queue/${token}`) สำหรับเปิดบนอุปกรณ์อื่น

หน้า `station-queue/[token]/page.tsx` sign ทั้ง liffUrl (request) และส่ง shareUrl = current operate url

### 3.2 Layout (mobile-first; `lg:` → 2 คอลัมน์)

```
┌──────────────────────────────────────────────┐
│ จุดนวด 1   ● เปิดรับคิว    [หยุดรับคิว] [QR]  │  Header bar
│ มีคิวรอ 8 คิว                                  │
├──────────────────────────────────────────────┤
│  กำลังเรียก                                    │  Hero card
│   ┌────────┐   สมชาย ใจดี                      │
│   │   5    │   BIB A123                        │
│   └────────┘                                   │
│   [  ข้ามคิวนี้  ]   [  เรียกคิวถัดไป →  ]     │
├──────────────────────────────────────────────┤
│ คิวถัดไป                                       │  Up-next list (3)
│   6  สมหญิง #A124                       [ข้าม] │
│   7  ป้าน (ไม่ใช่สมาชิก)                [ข้าม] │
│   8  ...                                [ข้าม] │
├──────────────────────────────────────────────┤
│ ▸ คิวที่ถูกข้าม (2)                            │  Collapsible (เมื่อมี)
│ ▸ เพิ่มคิว                                     │  Collapsible (input + BibKeypad)
├──────────────────────────────────────────────┤
│                                  [ รีเซ็ตคิว ] │  Footer (destructive, confirm)
└──────────────────────────────────────────────┘
```

**Responsive:** `lg` ขึ้นไป → 2 คอลัมน์: ซ้าย = Header + Hero (sticky/เด่น), ขวา = คิวถัดไป + ถูกข้าม + เพิ่มคิว. มือถือ → เรียงลงตาม mockup

### 3.3 Components (แยกย่อยให้ไฟล์ focused)
- `queue-board.tsx` — orchestrator (state, auto-refresh, layout)
- `board-header.tsx` — ชื่อ + status pill + ปุ่ม toggle เปิด/ปิด + ปุ่ม QR(เปิด ShareDialog)
- `serving-hero.tsx` — การ์ด "กำลังเรียก" + เลขใหญ่ + ชื่อ/bib + ปุ่ม ข้าม/เรียกถัดไป
- `up-next-list.tsx` — รายการคิวถัดไป + skipped (พับ) + requeue
- `add-queue-panel.tsx` — section พับ: input + `BibKeypad` + ผลลัพธ์
- `share-dialog.tsx` — Dialog แสดง 2 QR (นักกีฬา=liffUrl, หน้าจอนี้=shareUrl) + คัดลอก
- footer reset = `ConfirmActionButton` (มีอยู่)

> Collapsible ใช้ `useState` + เงื่อนไข render (ปุ่มหัวข้อ toggle) — ไม่ต้องพึ่ง component ใหม่

### 3.4 ภาษาภาพ (visual language)
- การ์ดมุมมน `rounded-2xl`, เส้นขอบบาง, เว้น `gap`/`p` กว้าง
- **สถานะ:** เปิดรับคิว = pill เขียว (`bg-green-…/text`) + จุดเขียว · ปิด = เทา
- **Hero number:** ตัวใหญ่ (`text-7xl`/`text-8xl`) สีหลัก (`text-primary`) บนพื้น tint อ่อน (`bg-primary/5`); ถ้าไม่มีคิว → "— ยังไม่มีคิวที่เรียก —"
- **ปุ่มหลัก** "เรียกคิวถัดไป" = solid ใหญ่เต็มกว้าง (มือถือ); "ข้ามคิวนี้" = outline
- non-member → badge "ไม่ใช่สมาชิก" สีส้ม/เทา
- auto-refresh 7s (เดิม), แสดง subtle indicator ระหว่าง refresh ได้ (optional)

## 4. ไฟล์ที่กระทบ

**ลบ:**
- `app/(dashboard)/dashboard/events/[id]/queue/[counterId]/board/page.tsx`
- `app/(dashboard)/dashboard/events/[id]/queue/[counterId]/board/actions.ts`
- `app/(dashboard)/dashboard/events/[id]/queue/[counterId]/board/_components/queue-board.tsx`
- (โฟลเดอร์ `app/(dashboard)/dashboard/events/[id]/queue/` ทั้งหมด หลังย้าย queue-qr-button ออก)

**ย้าย/สร้าง:**
- `app/_components/queue-qr-button.tsx` (ย้ายจาก dashboard)
- `app/(station-queue)/station-queue/[token]/actions.ts` (token-only)
- `app/(station-queue)/station-queue/[token]/_components/{queue-board,board-header,serving-hero,up-next-list,add-queue-panel,share-dialog}.tsx`

**แก้:**
- `app/(station-queue)/station-queue/[token]/page.tsx` — sign liffUrl (request) + shareUrl (operate, current url); render QueueBoard ใหม่
- `app/(dashboard)/dashboard/events/[id]/stations/queue-actions.ts` — `getStationQueueLinkAction`
- `app/(dashboard)/dashboard/events/[id]/stations/manage-queue-button.tsx` — modal launcher
- (event detail `page.tsx` ใช้ ManageQueueButton เดิม — ไม่ต้องแก้ ถ้า props เท่าเดิม)

**ไม่แตะ:** `db/queries/queue.ts` (getBoard/ops เดิมใช้ได้), `lib/queue-token.ts`, schema, LIFF queue request, status page, BibKeypad

## 5. ไม่มี migration / ไม่แตะ DB

## 6. Edge cases
- token invalid/หมดอายุ → page `notFound()` (เดิม)
- counter ถูก reset ระหว่างเปิด board → board ยัง query ตาม counterId (sessionId ใหม่) แสดงคิวว่าง ปกติ
- `getStationQueueLinkAction` คืน null (ไม่พบ station) → modal แสดง error
- ผู้ใช้ไม่มีสิทธิ์ QUEUE_OPERATE → ปุ่ม "จัดการคิว" ไม่แสดง (เดิม gate ด้วย canEdit) / action คืน DENY

## 7. Out of scope (คงเดิม)
- operate token ไม่มี expiry/revoke (ค้างไว้)
- public display จอใหญ่, push เตือนใกล้ถึงคิว
