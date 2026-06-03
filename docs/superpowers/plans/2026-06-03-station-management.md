# Station Management Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปลี่ยน station status จาก `active/hidden` เป็น `active/inactive` แบบ toggle ได้ตลอด และเพิ่ม full CRUD (เพิ่ม / แก้ไข / ลบจริง) เมื่อ event ยังไม่ active

**Architecture:** สร้าง `stationStatusEnum` แยกจาก shared `statusEnum` เพื่อ type safety; migration แปลง `hidden` → `inactive`; ปุ่ม toggle/edit/delete แสดงตาม event.status; edit ผ่าน Dialog inline ไม่ต้องเปิดหน้าใหม่

**Tech Stack:** Next.js 16 App Router, Drizzle ORM, Neon PostgreSQL, shadcn/ui (AlertDialog, Dialog)

---

## Business Rules

| event.status | toggle active/inactive | แก้ไข | ลบ (hard delete) | เพิ่ม |
|---|---|---|---|---|
| draft / published / closed / archived | ✅ | ✅ | ✅ | ✅ |
| active | ✅ | ❌ | ❌ | ❌ |

- station inactive → checkin และ self-checkin ใช้ไม่ได้ (ยังคงเป็น `status !== 'active'` redirect)
- ลบ station ลบจาก DB จริง (hard delete) — ข้อมูล checkin ที่ผูกกับ station นั้นจะถูกลบตาม FK cascade หรือ set null ขึ้นอยู่กับ schema

---

## File Map

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `db/schema/stations.ts` | เพิ่ม `stationStatusEnum`, ใช้แทน `statusEnum` |
| `db/migrations/0002_station_status_inactive.sql` | สร้างใหม่ — migration SQL แปลง enum |
| `db/queries/stations.ts` | อัปเดต type, เปลี่ยน `hideStation` → `toggleStationStatus`, เพิ่ม `deleteStation` |
| `app/(dashboard)/dashboard/events/[id]/actions.ts` | แทน `hideStationAction` → `toggleStationStatusAction`, เพิ่ม `deleteStationAction` |
| `app/(dashboard)/dashboard/events/[id]/stations/page.tsx` | แสดง stations ทั้งหมด, conditional buttons, conditional add form |
| `app/(dashboard)/dashboard/events/[id]/stations/toggle-station-button.tsx` | สร้างใหม่ |
| `app/(dashboard)/dashboard/events/[id]/stations/delete-station-button.tsx` | สร้างใหม่ |
| `app/(dashboard)/dashboard/events/[id]/stations/edit-station-dialog.tsx` | สร้างใหม่ |
| `app/(dashboard)/dashboard/events/[id]/stations/hide-station-button.tsx` | ลบ |

---

## Task 1: เปลี่ยน DB Schema — สร้าง `stationStatusEnum`

**Files:**
- Modify: `db/schema/stations.ts`

- [ ] **Step 1: แก้ไข schema**

เปิด `db/schema/stations.ts` แก้เป็น:

```ts
import { boolean, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { createdAtColumn, idColumn } from './_common'
import { events } from './events'

export const stationTypeEnum = pgEnum('station_type', [
  'air_recovery',
  'ice_bath',
  'other',
])

export const stationStatusEnum = pgEnum('station_status', ['active', 'inactive'])

export const stations = pgTable('stations', {
  stationId: idColumn(),
  eventId: text()
    .notNull()
    .references(() => events.eventId, { onDelete: 'cascade' }),
  stationType: stationTypeEnum().notNull(),
  stationName: text().notNull(),
  stampOnAddFriend: boolean().default(false).notNull(),
  status: stationStatusEnum().default('active').notNull(),
  createdAt: createdAtColumn(),
})
```

หมายเหตุ: ลบ import `statusEnum` ออก เพราะ stations จะใช้ `stationStatusEnum` ของตัวเอง

- [ ] **Step 2: ตรวจ typecheck ผ่าน (จะ error จน migrate เสร็จ — OK)**

```bash
pnpm typecheck 2>&1 | grep -c "error"
```

Expected: มี error จาก query/page files ที่ยังใช้ `'hidden'` — จะแก้ใน task ถัดไป

---

## Task 2: เขียน Migration SQL

**Files:**
- Create: `db/migrations/0002_station_status_inactive.sql`

- [ ] **Step 1: สร้างไฟล์ migration**

```sql
-- Create new station_status enum
CREATE TYPE "public"."station_status" AS ENUM('active', 'inactive');
--> statement-breakpoint

-- Convert column: map 'hidden' → 'inactive', keep 'active'
ALTER TABLE "stations"
  ALTER COLUMN "status" TYPE "public"."station_status"
  USING (
    CASE
      WHEN "status"::text = 'hidden' THEN 'inactive'::"public"."station_status"
      ELSE "status"::text::"public"."station_status"
    END
  );
--> statement-breakpoint

-- Restore default
ALTER TABLE "stations"
  ALTER COLUMN "status" SET DEFAULT 'active'::"public"."station_status";
```

- [ ] **Step 2: Apply migration**

```bash
pnpm tsx --env-file=.env.local scripts/apply-migration.ts
```

Expected output:
```
Applying migration: 0000_loud_rockslide.sql
✅ 0000_loud_rockslide.sql applied
Applying migration: 0001_lumpy_machine_man.sql
✅ 0001_lumpy_machine_man.sql applied
Applying migration: 0002_station_status_inactive.sql
✅ 0002_station_status_inactive.sql applied
🎉 All migrations applied.
```

หากได้ error `already exists` บน migration 0000/0001 แสดงว่า apply ซ้ำ — ไม่เป็นไร สคริปต์ปัจจุบันไม่มี idempotent check ให้เพิกเฉย error ของ migration เก่า และตรวจว่า 0002 passed

- [ ] **Step 3: ตรวจ DB ว่า enum ใหม่มีอยู่**

```bash
pnpm tsx --env-file=.env.local -e "
const { neon } = await import('@neondatabase/serverless')
const sql = neon(process.env.DATABASE_URL)
const r = await sql\`SELECT enum_range(NULL::station_status)\`
console.log(r)
process.exit(0)
"
```

Expected: `[ { enum_range: '{active,inactive}' } ]`

---

## Task 3: อัปเดต DB Queries

**Files:**
- Modify: `db/queries/stations.ts`

- [ ] **Step 1: แก้ไขทั้งไฟล์**

```ts
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { stations } from '@/db/schema/stations'
import type { stationStatusEnum, stationTypeEnum } from '@/db/schema/stations'

export type StationRow = {
  stationId: string
  eventId: string
  stationType: (typeof stationTypeEnum.enumValues)[number]
  stationName: string
  stampOnAddFriend: boolean
  status: (typeof stationStatusEnum.enumValues)[number]
  createdAt: Date
}

export type CreateStationData = {
  eventId: string
  stationType: (typeof stationTypeEnum.enumValues)[number]
  stationName: string
  stampOnAddFriend: boolean
}

export type UpdateStationData = Partial<Omit<CreateStationData, 'eventId'>>

export async function listStations(eventId: string): Promise<StationRow[]> {
  return db
    .select()
    .from(stations)
    .where(eq(stations.eventId, eventId))
    .orderBy(stations.createdAt)
}

export async function getStation(stationId: string): Promise<StationRow | undefined> {
  const [row] = await db
    .select()
    .from(stations)
    .where(eq(stations.stationId, stationId))
    .limit(1)

  return row
}

export async function createStation(data: CreateStationData): Promise<{ stationId: string }> {
  const [row] = await db
    .insert(stations)
    .values(data)
    .returning({ stationId: stations.stationId })

  return row
}

export async function updateStation(
  stationId: string,
  data: UpdateStationData,
): Promise<{ stationId: string }> {
  const [row] = await db
    .update(stations)
    .set(data)
    .where(eq(stations.stationId, stationId))
    .returning({ stationId: stations.stationId })

  return row
}

export async function toggleStationStatus(
  stationId: string,
  currentStatus: (typeof stationStatusEnum.enumValues)[number],
): Promise<{ stationId: string }> {
  const nextStatus = currentStatus === 'active' ? 'inactive' : 'active'
  const [row] = await db
    .update(stations)
    .set({ status: nextStatus })
    .where(eq(stations.stationId, stationId))
    .returning({ stationId: stations.stationId })

  return row
}

export async function deleteStation(stationId: string): Promise<void> {
  await db.delete(stations).where(eq(stations.stationId, stationId))
}
```

- [ ] **Step 2: ตรวจ typecheck**

```bash
pnpm typecheck 2>&1 | grep "queries/stations"
```

Expected: ไม่มี error จากไฟล์นี้

---

## Task 4: อัปเดต Server Actions

**Files:**
- Modify: `app/(dashboard)/dashboard/events/[id]/actions.ts`

- [ ] **Step 1: อัปเดต import และ ActionState**

เปิด `app/(dashboard)/dashboard/events/[id]/actions.ts` แก้:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { auth } from '@/auth'
import { ROLES } from '@/lib/rbac'
import { deleteDraftEvent, updateEvent, updateEventStatus } from '@/db/queries/events'
import {
  createStation,
  deleteStation,
  toggleStationStatus,
  updateStation,
} from '@/db/queries/stations'
import type { eventStatusEnum } from '@/db/schema/events'
import type { stationStatusEnum } from '@/db/schema/stations'

export type ActionState = {
  success?: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}
```

- [ ] **Step 2: เพิ่ม/แก้ station actions (ต่อจาก updateStationAction)**

แทน `hideStationAction` เดิมด้วย:

```ts
export async function toggleStationStatusAction(
  stationId: string,
  eventId: string,
  currentStatus: (typeof stationStatusEnum.enumValues)[number],
): Promise<void> {
  await assertOwnerOrManager()
  await toggleStationStatus(stationId, currentStatus)
  revalidatePath(`/dashboard/events/${eventId}/stations`)
}

export async function deleteStationAction(
  stationId: string,
  eventId: string,
): Promise<void> {
  await assertOwnerOrManager()
  await deleteStation(stationId)
  revalidatePath(`/dashboard/events/${eventId}/stations`)
}
```

และอัปเดต `updateStationAction` ให้ return `success: true`:

```ts
export async function updateStationAction(
  stationId: string,
  eventId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertOwnerOrManager()

  const raw = {
    stationType: formData.get('stationType'),
    stationName: formData.get('stationName'),
    stampOnAddFriend: formData.get('stampOnAddFriend') === 'on',
  }

  const parsed = stationSchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  await updateStation(stationId, parsed.data)
  revalidatePath(`/dashboard/events/${eventId}/stations`)
  return { success: true }
}
```

- [ ] **Step 3: ตรวจ typecheck**

```bash
pnpm typecheck 2>&1 | grep "actions.ts"
```

Expected: ไม่มี error

---

## Task 5: Toggle Station Button

**Files:**
- Create: `app/(dashboard)/dashboard/events/[id]/stations/toggle-station-button.tsx`
- Delete: `app/(dashboard)/dashboard/events/[id]/stations/hide-station-button.tsx`

- [ ] **Step 1: สร้าง toggle-station-button.tsx**

```tsx
'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toggleStationStatusAction } from '../actions'
import type { stationStatusEnum } from '@/db/schema/stations'

type Props = {
  stationId: string
  eventId: string
  currentStatus: (typeof stationStatusEnum.enumValues)[number]
}

export function ToggleStationButton({ stationId, eventId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      await toggleStationStatusAction(stationId, eventId, currentStatus)
    })
  }

  return (
    <Button
      variant={currentStatus === 'active' ? 'outline' : 'secondary'}
      size="sm"
      disabled={isPending}
      onClick={handleClick}
    >
      {isPending
        ? 'กำลังอัปเดต...'
        : currentStatus === 'active'
          ? 'ปิดใช้งาน'
          : 'เปิดใช้งาน'}
    </Button>
  )
}
```

- [ ] **Step 2: ลบ hide-station-button.tsx**

```bash
rm app/\(dashboard\)/dashboard/events/\[id\]/stations/hide-station-button.tsx
```

---

## Task 6: Delete Station Button

**Files:**
- Create: `app/(dashboard)/dashboard/events/[id]/stations/delete-station-button.tsx`

- [ ] **Step 1: สร้างไฟล์**

```tsx
'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { deleteStationAction } from '../actions'

type Props = {
  stationId: string
  eventId: string
  stationName: string
}

export function DeleteStationButton({ stationId, eventId, stationName }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      await deleteStationAction(stationId, eventId)
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={isPending}>
          {isPending ? 'กำลังลบ...' : 'ลบ'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>ยืนยันการลบ Station</AlertDialogTitle>
          <AlertDialogDescription>
            ลบ &ldquo;{stationName}&rdquo; ออกจากระบบถาวร ข้อมูล check-in ที่ผูกกับ station นี้จะถูกลบด้วย
            คุณแน่ใจหรือไม่?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete}>ยืนยันลบ</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

---

## Task 7: Edit Station Dialog

**Files:**
- Create: `app/(dashboard)/dashboard/events/[id]/stations/edit-station-dialog.tsx`

- [ ] **Step 1: สร้างไฟล์**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StationForm } from './station-form'
import type { ActionState } from '../actions'
import type { StationRow } from '@/db/queries/stations'

type Props = {
  station: StationRow
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>
}

export function EditStationDialog({ station, action }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        แก้ไข
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>แก้ไข Station</DialogTitle>
          </DialogHeader>
          <EditStationForm
            station={station}
            action={action}
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

function EditStationForm({
  station,
  action,
  onSuccess,
}: {
  station: StationRow
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>
  onSuccess: () => void
}) {
  const [submitted, setSubmitted] = useState(false)

  function wrappedAction(prevState: ActionState, formData: FormData) {
    setSubmitted(true)
    return action(prevState, formData)
  }

  return (
    <SuccessWatcher onSuccess={onSuccess} submitted={submitted}>
      <StationForm
        action={wrappedAction}
        defaultValues={{
          stationType: station.stationType,
          stationName: station.stationName,
          stampOnAddFriend: station.stampOnAddFriend,
        }}
        submitLabel="บันทึก"
      />
    </SuccessWatcher>
  )
}

function SuccessWatcher({
  children,
  onSuccess,
  submitted,
}: {
  children: React.ReactNode
  onSuccess: () => void
  submitted: boolean
}) {
  // This approach works around useActionState being inside StationForm.
  // We detect success by checking if the action returned success:true via
  // a custom wrapper. Since we can't reach into StationForm's state from
  // outside, we use a simpler approach: close on next render after submit
  // if no error appears within 300ms.
  useEffect(() => {
    if (!submitted) return
    const timer = setTimeout(onSuccess, 300)
    return () => clearTimeout(timer)
  }, [submitted, onSuccess])

  return <>{children}</>
}
```

**หมายเหตุ:** approach ข้างบนมีข้อจำกัดเพราะ `StationForm` ใช้ `useActionState` ภายในตัวเอง ทำให้ detect success state ได้ยาก ให้แก้ `StationForm` เพื่อรับ `onSuccess` prop แทน — ดู Step 2

- [ ] **Step 2: อัปเดต StationForm รับ `onSuccess` callback**

เปิด `app/(dashboard)/dashboard/events/[id]/stations/station-form.tsx` แก้:

```tsx
'use client'

import { useActionState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ActionState } from '../actions'

type StationFormProps = {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>
  defaultValues?: {
    stationType?: string
    stationName?: string
    stampOnAddFriend?: boolean
  }
  submitLabel?: string
  onSuccess?: () => void
}

export function StationForm({
  action,
  defaultValues,
  submitLabel = 'เพิ่ม Station',
  onSuccess,
}: StationFormProps) {
  const [state, formAction, isPending] = useActionState(action, {})

  useEffect(() => {
    if (state.success) onSuccess?.()
  }, [state.success, onSuccess])

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="stationType">ประเภท Station</Label>
        <select
          id="stationType"
          name="stationType"
          defaultValue={defaultValues?.stationType ?? 'air_recovery'}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="air_recovery">Air Recovery</option>
          <option value="ice_bath">Ice Bath</option>
          <option value="other">อื่นๆ (Other)</option>
        </select>
        {state.fieldErrors?.stationType && (
          <p className="text-xs text-destructive">
            {state.fieldErrors.stationType[0]}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="stationName">ชื่อ Station</Label>
        <Input
          id="stationName"
          name="stationName"
          defaultValue={defaultValues?.stationName}
          placeholder="เช่น Air Recovery Zone A"
          required
        />
        {state.fieldErrors?.stationName && (
          <p className="text-xs text-destructive">
            {state.fieldErrors.stationName[0]}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          id="stampOnAddFriend"
          name="stampOnAddFriend"
          type="checkbox"
          defaultChecked={defaultValues?.stampOnAddFriend ?? false}
          className="size-4 rounded border border-input"
        />
        <Label htmlFor="stampOnAddFriend">ประทับตราเมื่อ Add Friend LINE OA</Label>
      </div>

      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? 'กำลังบันทึก...' : submitLabel}
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: ลดความซับซ้อนใน EditStationDialog — ใช้ `onSuccess` prop**

เขียนทับ `edit-station-dialog.tsx` ใหม่ให้สะอาดกว่าเดิม:

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StationForm } from './station-form'
import type { ActionState } from '../actions'
import type { StationRow } from '@/db/queries/stations'

type Props = {
  station: StationRow
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>
}

export function EditStationDialog({ station, action }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        แก้ไข
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>แก้ไข Station</DialogTitle>
          </DialogHeader>
          <StationForm
            action={action}
            defaultValues={{
              stationType: station.stationType,
              stationName: station.stationName,
              stampOnAddFriend: station.stampOnAddFriend,
            }}
            submitLabel="บันทึก"
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
```

---

## Task 8: อัปเดต Stations Page

**Files:**
- Modify: `app/(dashboard)/dashboard/events/[id]/stations/page.tsx`

- [ ] **Step 1: เขียนทับ page.tsx**

```tsx
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS, ROLES } from '@/lib/rbac'
import { getEvent } from '@/db/queries/events'
import { listStations } from '@/db/queries/stations'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { signStationToken } from '@/lib/station-token'
import { createStationAction, updateStationAction } from '../actions'
import { StationForm } from './station-form'
import { ToggleStationButton } from './toggle-station-button'
import { DeleteStationButton } from './delete-station-button'
import { EditStationDialog } from './edit-station-dialog'
import { StationQrButton } from './_components/station-qr-button'

const STATION_TYPE_LABEL: Record<string, string> = {
  air_recovery: 'Air Recovery',
  ice_bath: 'Ice Bath',
  other: 'อื่นๆ',
}

const STATION_TYPE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  air_recovery: 'default',
  ice_bath: 'secondary',
  other: 'outline',
}

type Props = {
  params: Promise<{ id: string }>
}

export default async function StationsPage({ params }: Props) {
  const { id } = await params

  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const { role, sponsorId: userSponsorId, permissions } = session.user
  const authz = { role, permissions }

  const canViewAll = canAccess(PERMISSIONS.EVENT_VIEW, authz)
  const canViewOwn = canAccess(PERMISSIONS.EVENT_VIEW_OWN, authz)
  if (!canViewAll && !canViewOwn) redirect('/dashboard')

  const event = await getEvent(id)
  if (!event) notFound()

  if (canViewOwn && !canViewAll && event.sponsorId !== userSponsorId) notFound()

  const stationList = await listStations(id)

  // QR tokens สำหรับ station ที่ active เท่านั้น
  const activeStations = stationList.filter((s) => s.status === 'active')
  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  const baseUrl = `${protocol}://${host}`
  const stationTokenEntries = await Promise.all(
    activeStations.map(async (s) => {
      const token = await signStationToken({ stationId: s.stationId, eventId: id })
      return [s.stationId, `${baseUrl}/self-checkin/${token}`] as const
    }),
  )
  const stationTokenMap = new Map(stationTokenEntries)

  const canManage = role === ROLES.SUPER_ADMIN_OWNER || role === ROLES.SUPER_ADMIN_MANAGER
  // เมื่อ event ยังไม่ active → แก้ไข / ลบ / เพิ่มได้
  const canFullEdit = canManage && event.status !== 'active'

  const boundCreateStation = createStationAction.bind(null, id)

  return (
    <main className="p-6 lg:p-8">
      <div className="mb-2 flex items-center gap-2">
        <Link
          href={`/dashboard/events/${id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          {event.eventName}
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm">Stations</span>
      </div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Stations</h1>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/dashboard/events/${id}`}>กลับไป Event</Link>
        </Button>
      </div>

      {stationList.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground mb-8">
          ยังไม่มี Station — เพิ่ม Station แรกด้านล่าง
        </div>
      ) : (
        <div className="rounded-lg border mb-8">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อ Station</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead>Stamp เมื่อ Add Friend</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="text-right">Self Check-in</TableHead>
                {canManage && (
                  <TableHead className="text-right">การดำเนินการ</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {stationList.map((station) => {
                const boundUpdateStation = updateStationAction.bind(
                  null,
                  station.stationId,
                  id,
                )
                return (
                  <TableRow
                    key={station.stationId}
                    className={station.status === 'inactive' ? 'opacity-50' : undefined}
                  >
                    <TableCell className="font-medium">
                      {station.stationName}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATION_TYPE_VARIANT[station.stationType] ?? 'outline'}>
                        {STATION_TYPE_LABEL[station.stationType] ?? station.stationType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {station.stampOnAddFriend ? (
                        <Badge variant="secondary">เปิดใช้งาน</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={station.status === 'active' ? 'default' : 'outline'}>
                        {station.status === 'active' ? 'ใช้งาน' : 'ปิดใช้งาน'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {stationTokenMap.has(station.stationId) && (
                        <StationQrButton
                          stationName={station.stationName}
                          selfCheckinUrl={stationTokenMap.get(station.stationId)!}
                        />
                      )}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <ToggleStationButton
                            stationId={station.stationId}
                            eventId={id}
                            currentStatus={station.status}
                          />
                          {canFullEdit && (
                            <>
                              <EditStationDialog
                                station={station}
                                action={boundUpdateStation}
                              />
                              <DeleteStationButton
                                stationId={station.stationId}
                                eventId={id}
                                stationName={station.stationName}
                              />
                            </>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {canFullEdit && (
        <div className="rounded-lg border p-6 max-w-lg">
          <h2 className="text-lg font-medium mb-5">เพิ่ม Station ใหม่</h2>
          <StationForm action={boundCreateStation} />
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 2: ตรวจ typecheck ทั้งโปรเจกต์**

```bash
pnpm typecheck
```

Expected: ไม่มี error

---

## Task 9: Commit

- [ ] **Step 1: Commit**

```bash
git add -A
git commit -m "feat: station active/inactive toggle + full CRUD when event not active"
```

---

## Self-Review Checklist

- [x] **Toggle** — `ToggleStationButton` แสดงทุก station เมื่อ `canManage` ✓
- [x] **Edit** — `EditStationDialog` แสดงเฉพาะ `canFullEdit` (event ≠ active) ✓
- [x] **Hard delete** — `DeleteStationButton` + AlertDialog confirm แสดงเฉพาะ `canFullEdit` ✓
- [x] **Add form** — แสดงเฉพาะ `canFullEdit` ✓
- [x] **Checkin guard** — `status !== 'active'` ยังคงอยู่ใน `/checkin/[stationId]/page.tsx` และ `/self-checkin/[token]/page.tsx` ไม่ต้องแก้ ✓
- [x] **QR code** — generate เฉพาะ active stations ✓
- [x] **Migration** — แปลง `hidden` → `inactive` ด้วย USING clause ✓
- [x] **Type safety** — `StationRow.status` ใช้ type จาก `stationStatusEnum.enumValues` ✓
- [x] **success callback** — `StationForm` รับ `onSuccess?: () => void` และ call เมื่อ `state.success` ✓
- [x] **`createStationAction` ยังไม่ return `success`** — ไม่จำเป็นเพราะ redirect หลัง create ✓
