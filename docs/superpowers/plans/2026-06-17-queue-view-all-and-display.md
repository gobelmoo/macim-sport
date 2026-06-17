# ดูคิวทั้งหมด + หน้าจอแสดงคิว Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่ม (1) ปุ่ม "ดูทั้งหมด" บน operator board เปิด modal เห็นทุกคิว active และ (2) หน้าจอแสดงคิวสาธารณะ `/queue-display/[token]` (เลข+BIB เล็ก + 10 คิวถัดไป + QR รับคิว)

**Architecture:** เพิ่ม token scope `display` (read-only) · `getBoard` ส่ง `waiting` เต็ม + query เบา `getQueueDisplay` · ฟีเจอร์ 1 = Dialog ใน up-next-list · ฟีเจอร์ 2 = route group ใหม่ `(queue-display)` + poll API. ไม่มี migration.

**Tech Stack:** Next.js 16 · React 19 · Drizzle/Neon · shadcn Dialog/Button · qrcode.react · jose

**Spec:** `docs/superpowers/specs/2026-06-17-queue-view-all-and-display.md`

> **หมายเหตุ:** ไม่มี unit test สำหรับ component/query ในโปรเจกต์ — verify ด้วย `pnpm typecheck` (+`pnpm build` สำหรับ task ที่เพิ่ม route) ทุก task. ถ้า typecheck โดน `.next` cache ให้ `rm -rf .next` ก่อน. `pnpm lint` ข้าม (eslint@10 พังทั้ง repo). commit ลงท้าย `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. **ห้ามรัน db/db:push/ต่อ Neon/dev server.**

---

## Task 1: เพิ่ม token scope `display`

**Files:**
- Modify: `lib/queue-token.ts`

- [ ] **Step 1: เพิ่ม 'display' ใน union**

แก้บรรทัด `export type QueueTokenScope = 'request' | 'operate'`:

```ts
export type QueueTokenScope = 'request' | 'operate' | 'display'
```

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck`
Expected: ไม่มี error

- [ ] **Step 3: commit**

```bash
git add lib/queue-token.ts
git commit -m "feat(queue): add display token scope (read-only)"
```

---

## Task 2: getBoard.waiting + getQueueDisplay

**Files:**
- Modify: `db/queries/queue.ts`

- [ ] **Step 1: เพิ่ม `waiting` ใน BoardData**

แก้ type `BoardData` (ราว `db/queries/queue.ts:32-38`):

```ts
export type BoardData = {
  counter: CounterRow
  serving: EntryView | null
  upcoming: EntryView[]
  waiting: EntryView[]
  skipped: EntryView[]
  waitingCount: number
}
```

- [ ] **Step 2: ส่ง `waiting` ใน getBoard**

แก้ `return` ของ `getBoard`:

```ts
  return {
    counter,
    serving: servingList[0] ?? null,
    upcoming: waitingAll.slice(0, 3),
    waiting: waitingAll,
    skipped,
    waitingCount: waitingAll.length,
  }
```

- [ ] **Step 3: เพิ่ม QueueDisplay type + getQueueDisplay ต่อท้ายไฟล์**

```ts
// ─── Display (public, read-only, เลข+bib เท่านั้น) ────────────────────────────

export type QueueDisplay = {
  counterName: string
  isOpen: boolean
  serving: { displayNumber: number; bibNumber: string | null } | null
  next: { displayNumber: number; bibNumber: string | null }[]
}

export async function getQueueDisplay(
  counterId: string,
): Promise<QueueDisplay | null> {
  const counter = await getCounter(counterId)
  if (!counter) return null
  const cols = {
    displayNumber: queueEntries.displayNumber,
    bibNumber: queueEntries.bibNumber,
  }
  const [servingRows, nextRows] = await Promise.all([
    db
      .select(cols)
      .from(queueEntries)
      .where(
        and(
          eq(queueEntries.counterId, counterId),
          eq(queueEntries.sessionId, counter.sessionId),
          eq(queueEntries.entryStatus, 'serving'),
        ),
      )
      .limit(1),
    db
      .select(cols)
      .from(queueEntries)
      .where(
        and(
          eq(queueEntries.counterId, counterId),
          eq(queueEntries.sessionId, counter.sessionId),
          eq(queueEntries.entryStatus, 'waiting'),
        ),
      )
      .orderBy(asc(queueEntries.sortSeq))
      .limit(10),
  ])
  return {
    counterName: counter.counterName,
    isOpen: counter.isOpen,
    serving: servingRows[0] ?? null,
    next: nextRows,
  }
}
```

> `db`, `queueEntries`, `and`, `eq`, `asc` import อยู่แล้วในไฟล์ — ไม่ต้องเพิ่ม import

- [ ] **Step 4: typecheck**

Run: `pnpm typecheck`
Expected: ไม่มี error

- [ ] **Step 5: commit**

```bash
git add db/queries/queue.ts
git commit -m "feat(queue): expose full waiting list + getQueueDisplay query"
```

---

## Task 3: ฟีเจอร์ 1 — ปุ่ม "ดูทั้งหมด" + AllQueuesDialog

**Files:**
- Create: `app/(station-queue)/station-queue/[token]/_components/all-queues-dialog.tsx`
- Modify: `app/(station-queue)/station-queue/[token]/_components/up-next-list.tsx`
- Modify: `app/(station-queue)/station-queue/[token]/_components/queue-board.tsx`

- [ ] **Step 1: all-queues-dialog.tsx**

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { EntryView } from '@/db/queries/queue'
import { entryLabel } from './entry-label'

function Row({ e, accent }: { e: EntryView; accent?: boolean }) {
  return (
    <li
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
        accent ? 'border-primary bg-primary/5' : ''
      }`}
    >
      <strong className="w-10 shrink-0 text-lg">{e.displayNumber}</strong>
      <span className="text-sm">{entryLabel(e)}</span>
    </li>
  )
}

export function AllQueuesDialog({
  serving,
  waiting,
  skipped,
}: {
  serving: EntryView | null
  waiting: EntryView[]
  skipped: EntryView[]
}) {
  const [open, setOpen] = useState(false)
  const total = (serving ? 1 : 0) + waiting.length + skipped.length
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        ดูทั้งหมด ({total})
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>คิวทั้งหมด ({total})</DialogTitle>
            <DialogDescription>ทุกคิวที่ยัง active</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto">
            {serving && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  กำลังเรียก
                </p>
                <ul className="space-y-1.5">
                  <Row e={serving} accent />
                </ul>
              </div>
            )}
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                รอเรียก ({waiting.length})
              </p>
              <ul className="space-y-1.5">
                {waiting.length === 0 && (
                  <li className="text-sm text-muted-foreground">— ไม่มี —</li>
                )}
                {waiting.map((e) => (
                  <Row key={e.entryId} e={e} />
                ))}
              </ul>
            </div>
            {skipped.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  ถูกข้าม ({skipped.length})
                </p>
                <ul className="space-y-1.5">
                  {skipped.map((e) => (
                    <Row key={e.entryId} e={e} />
                  ))}
                </ul>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 2: เพิ่มปุ่มใน up-next-list.tsx**

เปลี่ยน signature + header. แก้ส่วนบนของ `UpNextList`:

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { EntryView } from '@/db/queries/queue'
import { entryLabel } from './entry-label'
import { AllQueuesDialog } from './all-queues-dialog'

export function UpNextList({
  upcoming,
  waiting,
  serving,
  skipped,
  isPending,
  onSkip,
  onRequeue,
}: {
  upcoming: EntryView[]
  waiting: EntryView[]
  serving: EntryView | null
  skipped: EntryView[]
  isPending: boolean
  onSkip: (id: string) => void
  onRequeue: (id: string) => void
}) {
  const [showSkipped, setShowSkipped] = useState(false)
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium">คิวถัดไป</p>
        <AllQueuesDialog serving={serving} waiting={waiting} skipped={skipped} />
      </div>
      <ul className="space-y-2">
```

(ส่วนที่เหลือของไฟล์ — รายการ `upcoming`, ส่วน skipped พับ — **คงเดิมทั้งหมด** ไม่ต้องแก้)

- [ ] **Step 3: ส่ง props ใหม่จาก queue-board.tsx**

ใน `queue-board.tsx` แก้การเรียก `<UpNextList ...>` ให้ส่ง `waiting` + `serving`:

```tsx
          <UpNextList
            upcoming={board.upcoming}
            waiting={board.waiting}
            serving={board.serving}
            skipped={board.skipped}
            isPending={isPending}
            onSkip={(id) => run(() => skipEntryAction(token, id))}
            onRequeue={(id) => run(() => requeueEntryAction(token, id))}
          />
```

- [ ] **Step 4: typecheck**

Run: `pnpm typecheck`
Expected: ไม่มี error

- [ ] **Step 5: commit**

```bash
git add "app/(station-queue)/station-queue/[token]/_components/all-queues-dialog.tsx" "app/(station-queue)/station-queue/[token]/_components/up-next-list.tsx" "app/(station-queue)/station-queue/[token]/_components/queue-board.tsx"
git commit -m "feat(queue): ดูทั้งหมด dialog (all active queues) on board"
```

---

## Task 4: ฟีเจอร์ 2 — หน้าจอแสดงคิว (page + API + view)

**Files:**
- Create: `app/api/queue/display/[token]/route.ts`
- Create: `app/(queue-display)/queue-display/[token]/_components/display-view.tsx`
- Create: `app/(queue-display)/queue-display/[token]/page.tsx`

- [ ] **Step 1: poll API route**

`app/api/queue/display/[token]/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { verifyQueueToken } from '@/lib/queue-token'
import { getQueueDisplay } from '@/db/queries/queue'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const payload = await verifyQueueToken(token, 'display')
  if (!payload) return NextResponse.json({ found: false }, { status: 404 })
  const data = await getQueueDisplay(payload.counterId)
  if (!data) return NextResponse.json({ found: false }, { status: 404 })
  return NextResponse.json({ found: true, ...data })
}
```

- [ ] **Step 2: display-view.tsx (client, poll 5s)**

`app/(queue-display)/queue-display/[token]/_components/display-view.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import type { QueueDisplay } from '@/db/queries/queue'

export function DisplayView({
  token,
  initial,
  liffUrl,
}: {
  token: string
  initial: QueueDisplay
  liffUrl: string
}) {
  const [data, setData] = useState<QueueDisplay>(initial)

  useEffect(() => {
    let active = true
    async function poll() {
      try {
        const res = await fetch(`/api/queue/display/${token}`, {
          cache: 'no-store',
        })
        if (!res.ok) return
        const json = await res.json()
        if (active && json.found) setData(json as QueueDisplay)
      } catch {
        // network ชั่วคราว — รอรอบถัดไป
      }
    }
    const t = setInterval(poll, 5000)
    return () => {
      active = false
      clearInterval(t)
    }
  }, [token])

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-background p-6 lg:p-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold lg:text-4xl">{data.counterName}</h1>
        <span
          className={`rounded-full px-4 py-1.5 text-base font-medium ${
            data.isOpen
              ? 'bg-green-100 text-green-700'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {data.isOpen ? 'เปิดรับคิว' : 'ปิดรับคิว'}
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 sm:flex-row">
        <div className="text-center">
          <p className="text-xl text-muted-foreground lg:text-2xl">กำลังเรียกคิว</p>
          {data.serving ? (
            <>
              <p className="text-[8rem] font-bold leading-none text-primary lg:text-[13rem]">
                {data.serving.displayNumber}
              </p>
              {data.serving.bibNumber && (
                <p className="text-2xl text-muted-foreground">
                  BIB {data.serving.bibNumber}
                </p>
              )}
            </>
          ) : (
            <p className="text-[6rem] font-bold leading-none text-muted-foreground lg:text-[10rem]">
              —
            </p>
          )}
        </div>
        <div className="text-center">
          <div className="rounded-2xl border bg-card p-4">
            <QRCodeSVG value={liffUrl} size={160} level="M" />
          </div>
          <p className="mt-2 text-lg font-medium">สแกนรับคิว</p>
        </div>
      </div>

      <div>
        <p className="mb-3 text-xl font-medium lg:text-2xl">คิวถัดไป</p>
        {data.next.length === 0 ? (
          <p className="text-lg text-muted-foreground">ไม่มีคิวถัดไป</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {data.next.map((e) => (
              <div
                key={e.displayNumber}
                className="flex min-w-[5rem] flex-col items-center rounded-2xl border bg-card px-4 py-3"
              >
                <span className="text-3xl font-bold lg:text-4xl">
                  {e.displayNumber}
                </span>
                {e.bibNumber && (
                  <span className="text-xs text-muted-foreground">
                    BIB {e.bibNumber}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 3: page.tsx**

`app/(queue-display)/queue-display/[token]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { getQueueDisplay } from '@/db/queries/queue'
import { signQueueToken, verifyQueueToken } from '@/lib/queue-token'
import { LIFF_BASE } from '@/lib/app-url'
import { DisplayView } from './_components/display-view'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ token: string }>
}

export default async function QueueDisplayPage({ params }: Props) {
  const { token } = await params
  const payload = await verifyQueueToken(token, 'display')
  if (!payload) notFound()

  const initial = await getQueueDisplay(payload.counterId)
  if (!initial) notFound()

  const liffUrl = `${LIFF_BASE}/queue/${await signQueueToken({
    counterId: payload.counterId,
    eventId: payload.eventId,
    scope: 'request',
  })}`

  return <DisplayView token={token} initial={initial} liffUrl={liffUrl} />
}
```

- [ ] **Step 4: typecheck + build**

Run: `rm -rf .next && pnpm typecheck && pnpm build`
Expected: ผ่าน; route table มี `/queue-display/[token]` และ `/api/queue/display/[token]`

- [ ] **Step 5: commit**

```bash
git add "app/api/queue/display" "app/(queue-display)"
git commit -m "feat(queue): public queue display page (numbers + bib + QR)"
```

---

## Task 5: ลิงก์ display ใน ShareDialog ของ board

**Files:**
- Modify: `app/(station-queue)/station-queue/[token]/_components/share-dialog.tsx`
- Modify: `app/(station-queue)/station-queue/[token]/_components/board-header.tsx`
- Modify: `app/(station-queue)/station-queue/[token]/_components/queue-board.tsx`
- Modify: `app/(station-queue)/station-queue/[token]/page.tsx`

- [ ] **Step 1: share-dialog เพิ่ม displayUrl (QR ที่ 3)**

แก้ `ShareDialog` ใน `share-dialog.tsx` — เพิ่ม prop `displayUrl` + QrBlock ที่ 3:

```tsx
export function ShareDialog({
  counterName,
  liffUrl,
  shareUrl,
  displayUrl,
}: {
  counterName: string
  liffUrl: string
  shareUrl: string
  displayUrl: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        QR
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-sm overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{counterName}</DialogTitle>
            <DialogDescription>
              QR สำหรับนักกีฬา · อุปกรณ์ staff · จอแสดงคิว
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <QrBlock title="QR นักกีฬา (สแกนเพื่อรับคิว)" url={liffUrl} />
            <QrBlock title="หน้าจอนี้ (เปิดบนอุปกรณ์ staff อื่น)" url={shareUrl} />
            <QrBlock title="หน้าจอแสดงคิว (ตั้งจอให้นักกีฬาดู)" url={displayUrl} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

(ฟังก์ชัน `QrBlock` ด้านบน — คงเดิม)

- [ ] **Step 2: board-header ส่ง displayUrl ต่อ**

ใน `board-header.tsx` เพิ่ม prop `displayUrl` แล้วส่งเข้า ShareDialog:

```tsx
export function BoardHeader({
  board,
  isPending,
  liffUrl,
  shareUrl,
  displayUrl,
  onToggleOpen,
}: {
  board: BoardData
  isPending: boolean
  liffUrl: string
  shareUrl: string
  displayUrl: string
  onToggleOpen: () => void
}) {
```

และแก้ตอน render:

```tsx
        <ShareDialog
          counterName={board.counter.counterName}
          liffUrl={liffUrl}
          shareUrl={shareUrl}
          displayUrl={displayUrl}
        />
```

- [ ] **Step 3: queue-board รับ + ส่ง displayUrl**

ใน `queue-board.tsx` เพิ่ม `displayUrl` ใน props ของ `QueueBoard` แล้วส่งเข้า `BoardHeader`:

```tsx
export function QueueBoard({
  board,
  token,
  liffUrl,
  shareUrl,
  displayUrl,
}: {
  board: BoardData
  token: string
  liffUrl: string
  shareUrl: string
  displayUrl: string
}) {
```

และตอน render header:

```tsx
      <BoardHeader
        board={board}
        isPending={isPending}
        liffUrl={liffUrl}
        shareUrl={shareUrl}
        displayUrl={displayUrl}
        onToggleOpen={() =>
          run(() => toggleOpenAction(token, !board.counter.isOpen))
        }
      />
```

- [ ] **Step 4: station-queue page sign displayUrl**

ใน `app/(station-queue)/station-queue/[token]/page.tsx` เพิ่มหลัง `liffUrl`:

```tsx
  const displayUrl = `${APP_BASE}/queue-display/${await signQueueToken({
    counterId: payload.counterId,
    eventId: payload.eventId,
    scope: 'display',
  })}`
```

และส่งเข้า component:

```tsx
  return (
    <QueueBoard
      board={board}
      token={token}
      liffUrl={liffUrl}
      shareUrl={shareUrl}
      displayUrl={displayUrl}
    />
  )
```

> `APP_BASE` import อยู่แล้วในไฟล์ (`import { APP_BASE, LIFF_BASE } from '@/lib/app-url'`)

- [ ] **Step 5: typecheck + build**

Run: `rm -rf .next && pnpm typecheck && pnpm build`
Expected: ผ่าน

- [ ] **Step 6: รัน test ทั้งหมด**

Run: `pnpm test`
Expected: 39 passed

- [ ] **Step 7: commit**

```bash
git add "app/(station-queue)/station-queue/[token]"
git commit -m "feat(queue): display screen link in board share dialog"
```

---

## Self-Review Notes

- **Spec coverage:** scope `display` (Task 1) · `waiting` + `getQueueDisplay` (Task 2) · ปุ่มดูทั้งหมด + modal ทุกสถานะ active (Task 3) · display page เลข+bib+10+QR + poll 5s (Task 4) · ลิงก์ display ใน ShareDialog (Task 5) — ครบ
- **Type consistency:** `BoardData.waiting: EntryView[]` (Task 2) ↔ ใช้ใน up-next-list/all-queues (Task 3); `QueueDisplay` (Task 2) ↔ display-view/API (Task 4); `displayUrl: string` ผ่าน page → queue-board → board-header → share-dialog (Task 5)
- **Security:** display token scope `display` แยก — page + API verify `'display'`; ขอคิว/คุมคิวด้วย display token ไม่ได้ (request/operate verify scope ของตัวเอง)
- **ไม่มี migration / ไม่แตะ DB**; display query เบา (ไม่ join athletes)
- **UpNextList** เพิ่ม props `waiting`/`serving` — ส่วนแสดง `upcoming` inline เดิมไม่เปลี่ยน
