# ยุบหน้าจัดคิว + Redesign Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ยุบหน้าคุมคิว 2 ที่ให้เหลือ staff board เดียว (`/station-queue/[token]`) พร้อม redesign จอใหม่ (hero-focused, responsive) และเปลี่ยน "จัดการคิว" ที่ station เป็น modal โชว์ QR/ลิงก์

**Architecture:** ลบ dashboard board route, ย้าย board ไปอยู่ใต้ `(station-queue)` แบบ token-only (token บรรจุ counterId+eventId → actions ไม่ต้อง thread eventId/counterId), แตก UI เป็น component ย่อย (header/hero/up-next/add/share). ไม่มี migration / ไม่แตะ DB/schema.

**Tech Stack:** Next.js 16 App Router · React 19 · Drizzle/Neon · shadcn/ui (Dialog, Button, Input) · qrcode.react · jose

**Spec:** `docs/superpowers/specs/2026-06-17-queue-board-consolidation-design.md`

> **หมายเหตุ:** โปรเจกต์ไม่มี unit test สำหรับ component/action — verify ด้วย `pnpm typecheck` + `pnpm build` ทุก task (ต้อง `rm -rf .next` ก่อน typecheck ถ้า cache อ้าง route ที่ลบ). `pnpm lint` ข้าม (พังทั้ง repo จาก eslint-plugin-react ไม่ compatible eslint@10). ทุก commit ลงท้าย `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. **ห้ามรัน db / db:push / ต่อ Neon.**

## File Structure

สร้างใหม่ (ทั้งหมดใต้ `app/(station-queue)/station-queue/[token]/`):
- `actions.ts` — token-only server actions
- `_components/entry-label.ts` — helper แปลง EntryView → ข้อความ
- `_components/share-dialog.tsx` — Dialog 2 QR (นักกีฬา + หน้าจอนี้)
- `_components/board-header.tsx` — ชื่อ + status + toggle + ปุ่ม QR
- `_components/serving-hero.tsx` — การ์ด "กำลังเรียก" + ปุ่ม ข้าม/ถัดไป
- `_components/up-next-list.tsx` — คิวถัดไป + ถูกข้าม (พับ)
- `_components/add-queue-panel.tsx` — section พับ + input + BibKeypad
- `_components/queue-board.tsx` — orchestrator

แก้:
- `app/(station-queue)/station-queue/[token]/page.tsx` — render board ใหม่ + liffUrl/shareUrl
- `app/(dashboard)/dashboard/events/[id]/stations/queue-actions.ts` — `getStationQueueLinkAction`
- `app/(dashboard)/dashboard/events/[id]/stations/manage-queue-button.tsx` — modal

ลบ:
- `app/(dashboard)/dashboard/events/[id]/queue/` ทั้งโฟลเดอร์ (board route + actions + queue-board + queue-qr-button ที่ไม่ใช้แล้ว)

---

## Task 1: Token-only board actions

**Files:**
- Create: `app/(station-queue)/station-queue/[token]/actions.ts`

- [ ] **Step 1: เขียน actions**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { verifyQueueToken } from '@/lib/queue-token'
import {
  enqueue,
  nextQueue,
  requeueEntry,
  resetCounter,
  setCounterOpen,
  skipEntry,
} from '@/db/queries/queue'
import { getRegistrationByBibAndEvent } from '@/db/queries/line'
import { isValidBib } from '@/lib/line-state'

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string }

const DENY = { ok: false, message: 'ไม่มีสิทธิ์' } as const

/** ตีความ operate token → counterId/eventId + revalidate ของหน้านี้ */
async function resolve(token: string) {
  const p = await verifyQueueToken(token, 'operate')
  if (!p) return null
  return {
    counterId: p.counterId,
    eventId: p.eventId,
    revalidate: () => revalidatePath(`/station-queue/${token}`),
  }
}

export async function toggleOpenAction(
  token: string,
  isOpen: boolean,
): Promise<ActionResult> {
  const ctx = await resolve(token)
  if (!ctx) return DENY
  await setCounterOpen(ctx.counterId, isOpen)
  ctx.revalidate()
  return { ok: true }
}

export async function resetCounterAction(token: string): Promise<ActionResult> {
  const ctx = await resolve(token)
  if (!ctx) return DENY
  await resetCounter(ctx.counterId)
  ctx.revalidate()
  return { ok: true }
}

export async function nextQueueAction(token: string): Promise<ActionResult> {
  const ctx = await resolve(token)
  if (!ctx) return DENY
  await nextQueue(ctx.counterId)
  ctx.revalidate()
  return { ok: true }
}

export async function skipEntryAction(
  token: string,
  entryId: string,
): Promise<ActionResult> {
  const ctx = await resolve(token)
  if (!ctx) return DENY
  await skipEntry(entryId)
  ctx.revalidate()
  return { ok: true }
}

export async function requeueEntryAction(
  token: string,
  entryId: string,
): Promise<ActionResult> {
  const ctx = await resolve(token)
  if (!ctx) return DENY
  await requeueEntry(entryId)
  ctx.revalidate()
  return { ok: true }
}

/** เพิ่มคิว: BIB ที่ลงทะเบียน → ผูกนักกีฬา; มิฉะนั้น → non-member ป้าย = input */
export async function addQueueAction(
  token: string,
  rawInput: string,
): Promise<ActionResult> {
  const ctx = await resolve(token)
  if (!ctx) return DENY
  const input = rawInput.trim()
  if (!input) return { ok: false, message: 'กรุณากรอก BIB หรือ ชื่อ' }

  const bib = input.toUpperCase()
  if (isValidBib(bib)) {
    const reg = await getRegistrationByBibAndEvent(bib, ctx.eventId)
    if (reg) {
      const { entry, created } = await enqueue({
        counterId: ctx.counterId,
        athleteId: reg.athleteId,
        registrationId: reg.registrationId,
        bibNumber: reg.bibNumber,
        lineUserId: reg.athleteLineUserId,
      })
      ctx.revalidate()
      const name = [reg.athleteFirstName, reg.athleteLastName]
        .filter(Boolean)
        .join(' ')
      const who = `${name || 'นักกีฬา'} (BIB ${reg.bibNumber})`
      return {
        ok: true,
        message: created
          ? `เพิ่มคิว #${entry.displayNumber} — ${who}`
          : `${who} อยู่ในคิวแล้ว (หมายเลข #${entry.displayNumber})`,
      }
    }
  }

  const { entry, created } = await enqueue({
    counterId: ctx.counterId,
    isNonMember: true,
    displayLabel: input,
  })
  ctx.revalidate()
  return {
    ok: true,
    message: created
      ? `เพิ่มคิว #${entry.displayNumber} — ${input} (ไม่ใช่สมาชิก)`
      : `${input} อยู่ในคิวแล้ว (หมายเลข #${entry.displayNumber})`,
  }
}
```

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck`
Expected: ไม่มี error

- [ ] **Step 3: commit**

```bash
git add "app/(station-queue)/station-queue/[token]/actions.ts"
git commit -m "feat(queue): token-only board actions for standalone board"
```

---

## Task 2: entry-label + share-dialog + board-header

**Files:**
- Create: `app/(station-queue)/station-queue/[token]/_components/entry-label.ts`
- Create: `app/(station-queue)/station-queue/[token]/_components/share-dialog.tsx`
- Create: `app/(station-queue)/station-queue/[token]/_components/board-header.tsx`

- [ ] **Step 1: entry-label.ts**

```ts
import type { EntryView } from '@/db/queries/queue'

export function entryLabel(e: EntryView): string {
  if (e.isNonMember) return `${e.displayLabel ?? 'ไม่ระบุ'} (ไม่ใช่สมาชิก)`
  const name = e.athleteName ?? ''
  const bib = e.bibNumber ? `#${e.bibNumber}` : ''
  return [name, bib].filter(Boolean).join(' ') || 'ไม่ทราบชื่อ'
}
```

- [ ] **Step 2: share-dialog.tsx**

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

function QrBlock({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard ใช้ไม่ได้ — เงียบไว้
    }
  }
  return (
    <div className="space-y-2 rounded-xl border p-3">
      <p className="text-sm font-medium">{title}</p>
      <div className="flex justify-center">
        <QRCodeSVG value={url} size={180} level="M" />
      </div>
      <p className="break-all text-center text-xs text-muted-foreground">{url}</p>
      <Button variant="outline" size="sm" className="w-full" onClick={copy}>
        {copied ? 'คัดลอกแล้ว ✓' : 'คัดลอก URL'}
      </Button>
    </div>
  )
}

export function ShareDialog({
  counterName,
  liffUrl,
  shareUrl,
}: {
  counterName: string
  liffUrl: string
  shareUrl: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        QR
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{counterName}</DialogTitle>
            <DialogDescription>
              QR สำหรับนักกีฬาและอุปกรณ์ staff
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <QrBlock title="QR นักกีฬา (สแกนเพื่อรับคิว)" url={liffUrl} />
            <QrBlock title="หน้าจอนี้ (เปิดบนอุปกรณ์ staff อื่น)" url={shareUrl} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 3: board-header.tsx**

```tsx
'use client'

import { Button } from '@/components/ui/button'
import type { BoardData } from '@/db/queries/queue'
import { ShareDialog } from './share-dialog'

export function BoardHeader({
  board,
  isPending,
  liffUrl,
  shareUrl,
  onToggleOpen,
}: {
  board: BoardData
  isPending: boolean
  liffUrl: string
  shareUrl: string
  onToggleOpen: () => void
}) {
  const open = board.counter.isOpen
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{board.counter.counterName}</h1>
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium ${
              open ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${open ? 'bg-green-500' : 'bg-gray-400'}`}
            />
            {open ? 'เปิดรับคิว' : 'ปิดรับคิว'}
          </span>
          <span className="text-muted-foreground">
            มีคิวรอ {board.waitingCount} คิว
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant={open ? 'outline' : 'default'}
          disabled={isPending}
          onClick={onToggleOpen}
        >
          {open ? 'หยุดรับคิว' : 'เริ่มรับคิว'}
        </Button>
        <ShareDialog
          counterName={board.counter.counterName}
          liffUrl={liffUrl}
          shareUrl={shareUrl}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: typecheck**

Run: `pnpm typecheck`
Expected: ไม่มี error

- [ ] **Step 5: commit**

```bash
git add "app/(station-queue)/station-queue/[token]/_components/entry-label.ts" "app/(station-queue)/station-queue/[token]/_components/share-dialog.tsx" "app/(station-queue)/station-queue/[token]/_components/board-header.tsx"
git commit -m "feat(queue): board header + share dialog components"
```

---

## Task 3: serving-hero + up-next-list + add-queue-panel

**Files:**
- Create: `app/(station-queue)/station-queue/[token]/_components/serving-hero.tsx`
- Create: `app/(station-queue)/station-queue/[token]/_components/up-next-list.tsx`
- Create: `app/(station-queue)/station-queue/[token]/_components/add-queue-panel.tsx`

- [ ] **Step 1: serving-hero.tsx**

```tsx
'use client'

import { Button } from '@/components/ui/button'
import type { EntryView } from '@/db/queries/queue'
import { entryLabel } from './entry-label'

export function ServingHero({
  serving,
  isPending,
  onNext,
  onSkip,
}: {
  serving: EntryView | null
  isPending: boolean
  onNext: () => void
  onSkip: (id: string) => void
}) {
  return (
    <div className="rounded-2xl border bg-primary/5 p-6">
      <p className="text-center text-sm font-medium text-muted-foreground">
        กำลังเรียก
      </p>
      {serving ? (
        <div className="mt-4 flex flex-col items-center gap-2 text-center">
          <span className="text-7xl font-bold leading-none text-primary lg:text-8xl">
            {serving.displayNumber}
          </span>
          <span className="text-lg">{entryLabel(serving)}</span>
        </div>
      ) : (
        <p className="mt-8 text-center text-lg text-muted-foreground">
          — ยังไม่มีคิวที่เรียก —
        </p>
      )}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button
          variant="outline"
          className="h-14 flex-1 text-base"
          disabled={isPending || !serving}
          onClick={() => serving && onSkip(serving.entryId)}
        >
          ข้ามคิวนี้
        </Button>
        <Button
          className="h-14 flex-[2] text-lg"
          disabled={isPending}
          onClick={onNext}
        >
          เรียกคิวถัดไป →
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: up-next-list.tsx**

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { EntryView } from '@/db/queries/queue'
import { entryLabel } from './entry-label'

export function UpNextList({
  upcoming,
  skipped,
  isPending,
  onSkip,
  onRequeue,
}: {
  upcoming: EntryView[]
  skipped: EntryView[]
  isPending: boolean
  onSkip: (id: string) => void
  onRequeue: (id: string) => void
}) {
  const [showSkipped, setShowSkipped] = useState(false)
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="mb-3 text-sm font-medium">คิวถัดไป</p>
      <ul className="space-y-2">
        {upcoming.length === 0 && (
          <li className="text-sm text-muted-foreground">— ไม่มีคิวรอ —</li>
        )}
        {upcoming.map((e) => (
          <li
            key={e.entryId}
            className="flex items-center justify-between rounded-xl border px-3 py-2.5"
          >
            <span className="flex items-center gap-2">
              <strong className="text-lg">{e.displayNumber}</strong>
              {entryLabel(e)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => onSkip(e.entryId)}
            >
              ข้าม
            </Button>
          </li>
        ))}
      </ul>

      {skipped.length > 0 && (
        <div className="mt-3 border-t pt-3">
          <button
            type="button"
            className="text-sm font-medium text-muted-foreground"
            onClick={() => setShowSkipped((v) => !v)}
          >
            {showSkipped ? '▾' : '▸'} คิวที่ถูกข้าม ({skipped.length})
          </button>
          {showSkipped && (
            <ul className="mt-2 space-y-2">
              {skipped.map((e) => (
                <li
                  key={e.entryId}
                  className="flex items-center justify-between rounded-xl border border-dashed px-3 py-2.5"
                >
                  <span className="flex items-center gap-2">
                    <strong className="text-lg">{e.displayNumber}</strong>
                    {entryLabel(e)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => onRequeue(e.entryId)}
                  >
                    แทรกเป็นคิวถัดไป
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: add-queue-panel.tsx**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BibKeypad } from '@/app/_components/bib-keypad'

type AddResult = { ok: boolean; message?: string }

export function AddQueuePanel({
  isPending,
  onAdd,
}: {
  isPending: boolean
  onAdd: (input: string) => Promise<AddResult>
}) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()

  function submit() {
    startTransition(async () => {
      const r = await onAdd(input)
      if (r.ok) {
        setInput('')
        setMsg(r.message ?? null)
      } else {
        setMsg(null)
        alert(r.message)
      }
    })
  }

  return (
    <div className="rounded-2xl border bg-card p-4">
      <button
        type="button"
        className="text-sm font-medium"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '▾' : '▸'} เพิ่มคิว
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="BIB หรือ ชื่อนักกีฬา"
              className="sm:max-w-[260px]"
            />
            <Button
              variant="secondary"
              disabled={isPending || busy || !input.trim()}
              onClick={submit}
            >
              เพิ่มคิว
            </Button>
          </div>
          <BibKeypad value={input} onChange={setInput} />
          {msg && <p className="text-sm text-green-600">{msg}</p>}
          <p className="text-xs text-muted-foreground">
            กรอก BIB ที่ลงทะเบียน → ผูกนักกีฬา · ชื่อหรือ BIB ที่ยังไม่ลงทะเบียน →
            เพิ่มเป็น “ไม่ใช่สมาชิก” (ไม่ได้รับ flex แจ้งเลขคิว)
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: typecheck**

Run: `pnpm typecheck`
Expected: ไม่มี error

- [ ] **Step 5: commit**

```bash
git add "app/(station-queue)/station-queue/[token]/_components/serving-hero.tsx" "app/(station-queue)/station-queue/[token]/_components/up-next-list.tsx" "app/(station-queue)/station-queue/[token]/_components/add-queue-panel.tsx"
git commit -m "feat(queue): serving hero, up-next list, add-queue panel"
```

---

## Task 4: Orchestrator + ชี้ page ไป board ใหม่

**Files:**
- Create: `app/(station-queue)/station-queue/[token]/_components/queue-board.tsx`
- Modify: `app/(station-queue)/station-queue/[token]/page.tsx`

- [ ] **Step 1: queue-board.tsx (orchestrator)**

```tsx
'use client'

import { useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { BoardData } from '@/db/queries/queue'
import { ConfirmActionButton } from '@/app/_components/confirm-action-button'
import { BoardHeader } from './board-header'
import { ServingHero } from './serving-hero'
import { UpNextList } from './up-next-list'
import { AddQueuePanel } from './add-queue-panel'
import {
  addQueueAction,
  nextQueueAction,
  requeueEntryAction,
  resetCounterAction,
  skipEntryAction,
  toggleOpenAction,
} from '../actions'

export function QueueBoard({
  board,
  token,
  liffUrl,
  shareUrl,
}: {
  board: BoardData
  token: string
  liffUrl: string
  shareUrl: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

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
    <div className="mx-auto max-w-5xl space-y-5 p-4 lg:p-6">
      <BoardHeader
        board={board}
        isPending={isPending}
        liffUrl={liffUrl}
        shareUrl={shareUrl}
        onToggleOpen={() =>
          run(() => toggleOpenAction(token, !board.counter.isOpen))
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <ServingHero
          serving={board.serving}
          isPending={isPending}
          onNext={() => run(() => nextQueueAction(token))}
          onSkip={(id) => run(() => skipEntryAction(token, id))}
        />
        <div className="space-y-5">
          <UpNextList
            upcoming={board.upcoming}
            skipped={board.skipped}
            isPending={isPending}
            onSkip={(id) => run(() => skipEntryAction(token, id))}
            onRequeue={(id) => run(() => requeueEntryAction(token, id))}
          />
          <AddQueuePanel
            isPending={isPending}
            onAdd={async (input) => {
              const r = await addQueueAction(token, input)
              router.refresh()
              return r
            }}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <ConfirmActionButton
          triggerLabel="รีเซ็ตคิว"
          pendingLabel="กำลังรีเซ็ต..."
          title="ยืนยันการรีเซ็ตคิว"
          description="คิวที่ค้างอยู่ทั้งหมดจะถูกล้าง และเริ่มนับเลขใหม่จาก 1 — การกระทำนี้ย้อนกลับไม่ได้"
          actionLabel="ยืนยันรีเซ็ต"
          triggerVariant="destructive"
          onConfirm={async () => {
            const r = await resetCounterAction(token)
            router.refresh()
            if (!r.ok) return { message: r.message }
          }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: แก้ page.tsx ให้ใช้ board ใหม่**

แทนที่ทั้งไฟล์ `app/(station-queue)/station-queue/[token]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { getBoard } from '@/db/queries/queue'
import { signQueueToken, verifyQueueToken } from '@/lib/queue-token'
import { APP_BASE, LIFF_BASE } from '@/lib/app-url'
import { QueueBoard } from './_components/queue-board'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ token: string }>
}

export default async function StationQueuePage({ params }: Props) {
  const { token } = await params
  const payload = await verifyQueueToken(token, 'operate')
  if (!payload) notFound()

  const board = await getBoard(payload.counterId)
  if (!board || board.counter.eventId !== payload.eventId) notFound()

  const liffUrl = `${LIFF_BASE}/queue/${await signQueueToken({
    counterId: payload.counterId,
    eventId: payload.eventId,
    scope: 'request',
  })}`
  const shareUrl = `${APP_BASE}/station-queue/${token}`

  return (
    <QueueBoard board={board} token={token} liffUrl={liffUrl} shareUrl={shareUrl} />
  )
}
```

- [ ] **Step 3: typecheck + build**

Run: `rm -rf .next && pnpm typecheck && pnpm build`
Expected: ผ่าน; route `/station-queue/[token]` ยังอยู่

- [ ] **Step 4: commit**

```bash
git add "app/(station-queue)/station-queue/[token]/_components/queue-board.tsx" "app/(station-queue)/station-queue/[token]/page.tsx"
git commit -m "feat(queue): redesigned standalone board (hero-focused, responsive)"
```

---

## Task 5: "จัดการคิว" → modal โชว์ QR/ลิงก์

**Files:**
- Modify: `app/(dashboard)/dashboard/events/[id]/stations/queue-actions.ts`
- Modify: `app/(dashboard)/dashboard/events/[id]/stations/manage-queue-button.tsx`

- [ ] **Step 1: แทนที่ queue-actions.ts**

```ts
'use server'

import { auth } from '@/auth'
import { canAccess, PERMISSIONS } from '@/lib/rbac'
import { getOrCreateCounterForStation } from '@/db/queries/queue'
import { signQueueToken } from '@/lib/queue-token'
import { APP_BASE } from '@/lib/app-url'

export type StationQueueLink =
  | { ok: true; url: string }
  | { ok: false; message: string }

/** auth → get/create counter ของ station → คืนลิงก์หน้าคุมคิว staff (operate token) */
export async function getStationQueueLinkAction(
  eventId: string,
  stationId: string,
): Promise<StationQueueLink> {
  const session = await auth()
  if (!session?.user) return { ok: false, message: 'ไม่ได้รับอนุญาต' }
  if (!canAccess(PERMISSIONS.QUEUE_OPERATE, session.user)) {
    return { ok: false, message: 'ไม่มีสิทธิ์จัดการคิว' }
  }
  const counterId = await getOrCreateCounterForStation(stationId)
  if (!counterId) return { ok: false, message: 'ไม่พบ station' }
  const token = await signQueueToken({ counterId, eventId, scope: 'operate' })
  return { ok: true, url: `${APP_BASE}/station-queue/${token}` }
}
```

- [ ] **Step 2: แทนที่ manage-queue-button.tsx**

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
import { getStationQueueLinkAction, type StationQueueLink } from './queue-actions'

type Props = {
  stationId: string
  eventId: string
}

export function ManageQueueButton({ stationId, eventId }: Props) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<StationQueueLink | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleOpen() {
    setOpen(true)
    setState(null)
    setState(await getStationQueueLinkAction(eventId, stationId))
  }

  async function copy() {
    if (!state?.ok) return
    try {
      await navigator.clipboard.writeText(state.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard ใช้ไม่ได้ — เงียบไว้
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={handleOpen}>
        จัดการคิว
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>หน้าคุมคิว (Staff)</DialogTitle>
            <DialogDescription>
              เปิดบน iPad/มือถือที่ station ได้โดยไม่ต้องล็อกอิน
            </DialogDescription>
          </DialogHeader>
          {!state && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              กำลังเตรียม...
            </p>
          )}
          {state && !state.ok && (
            <p className="py-8 text-center text-sm text-destructive">
              {state.message}
            </p>
          )}
          {state?.ok && (
            <div className="space-y-3">
              <div className="flex justify-center">
                <QRCodeSVG value={state.url} size={200} level="M" />
              </div>
              <p className="break-all text-center text-xs text-muted-foreground">
                {state.url}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={copy}>
                  {copied ? 'คัดลอกแล้ว ✓' : 'คัดลอก URL'}
                </Button>
                <Button asChild>
                  <a href={state.url} target="_blank" rel="noopener noreferrer">
                    เปิดหน้าคุมคิว
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 3: typecheck**

Run: `pnpm typecheck`
Expected: ไม่มี error (ยืนยันไม่มีที่อื่นอ้าง `openStationQueueAction` — `grep -rn "openStationQueueAction" app` ต้องว่าง)

- [ ] **Step 4: commit**

```bash
git add "app/(dashboard)/dashboard/events/[id]/stations/queue-actions.ts" "app/(dashboard)/dashboard/events/[id]/stations/manage-queue-button.tsx"
git commit -m "feat(queue): จัดการคิว opens QR/link modal instead of dashboard board"
```

---

## Task 6: ลบ dashboard board route (ยุบเสร็จ)

**Files:**
- Delete: `app/(dashboard)/dashboard/events/[id]/queue/` (ทั้งโฟลเดอร์)

- [ ] **Step 1: ยืนยันไม่มีใครอ้างถึง board เดิม**

Run: `grep -rn "queue/\[counterId\]/board\|board/_components/queue-board\|queue/_components/queue-qr-button\|QueueQrButton" app`
Expected: ว่าง (ไม่มี reference เหลือ)

- [ ] **Step 2: ลบโฟลเดอร์**

```bash
rm -rf "app/(dashboard)/dashboard/events/[id]/queue"
```

- [ ] **Step 3: typecheck + build**

Run: `rm -rf .next && pnpm typecheck && pnpm build`
Expected: ผ่าน; route table **ไม่มี** `/dashboard/events/[id]/queue/[counterId]/board` แล้ว, ยังมี `/station-queue/[token]`

- [ ] **Step 4: รัน test ทั้งหมด**

Run: `pnpm test`
Expected: 39 passed (ไม่กระทบ pure logic)

- [ ] **Step 5: commit**

```bash
git add -A "app/(dashboard)/dashboard/events/[id]"
git commit -m "refactor(queue): remove dashboard board route (consolidated to staff board)"
```

---

## Self-Review Notes

- **Spec coverage:** ยุบ board (Task 6) · ย้าย board เป็น token-only (Task 1+4) · actions token-only ตัด branch session (Task 1) · modal launcher (Task 5) · redesign hero/up-next/add/share + responsive (Task 2-4) · footer reset confirm (Task 4) · 2 QR ใน ShareDialog (Task 2) — ครบ
- **QueueQrButton ไม่ถูกใช้แล้ว** (ShareDialog + raw QRCodeSVG แทน) → ลบพร้อมโฟลเดอร์ queue/ ใน Task 6 (spec เขียนว่า "ย้าย" แต่จริงไม่ได้ใช้ → ลบดีกว่า)
- **Auth:** board เป็น token-only (operate scope) — session ไม่เกี่ยวแล้ว; modal ฝั่ง dashboard ยัง gate ด้วย QUEUE_OPERATE
- **ไม่มี migration / ไม่แตะ DB**; verify ด้วย typecheck+build ทุก task
- **Type consistency:** `ActionResult` (Task 1) ↔ `AddResult = {ok;message?}` (AddQueuePanel) — addQueueAction คืน `{ok:true;message?}` assignable เข้า `AddResult`; onConfirm ของ reset ใช้ `{message?}` ตาม ConfirmActionButton
