# Event UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ปรับปรุง UX/UI เมนู Events ให้สอดคล้องกับ Users และ Sponsors — icon header, search/filter/pagination, Card-based layouts, back navigation, badges component

**Architecture:** เพิ่ม `_components/event-badges.tsx` และ `_components/events-table.tsx` เป็น building blocks แล้วปรับ pages ทีละหน้าให้ใช้ pattern เดียวกับ sponsors (back button → header card → form card) โดยไม่แตะ actions.ts หรือ DB layer

**Tech Stack:** Next.js App Router, React Server Components, shadcn/ui (Card, Badge, Button, Select, Input), lucide-react, Tailwind CSS

---

## ไฟล์ที่จะสร้าง / แก้ไข

| ไฟล์ | action |
|------|--------|
| `events/_components/event-badges.tsx` | **สร้างใหม่** — EventStatusBadge, EventTypeBadge |
| `events/_components/events-table.tsx` | **สร้างใหม่** — client table: search + status/type filter + pagination |
| `events/page.tsx` | **แก้ไข** — icon header + subtitle + ใช้ EventsTable |
| `events/new/page.tsx` | **แก้ไข** — back button + icon header + Card wrapper |
| `events/new/event-form.tsx` | **แก้ไข** — icons in inputs + shadcn Select |
| `events/[id]/edit/page.tsx` | **แก้ไข** — back button + icon header + Card wrapper |
| `events/[id]/event-edit-form.tsx` | **แก้ไข** — icons in inputs + shadcn Select |
| `events/[id]/page.tsx` | **แก้ไข** — back button + header Card + info tab ใน Card |

---

## Task 1: Event Badges Component

**Files:**
- Create: `app/(dashboard)/dashboard/events/_components/event-badges.tsx`

- [ ] **Step 1: สร้างไฟล์ event-badges.tsx**

```tsx
// app/(dashboard)/dashboard/events/_components/event-badges.tsx
import {
  FileEdit,
  Eye,
  Radio,
  XCircle,
  Archive,
  Timer,
  Activity,
  Tag,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { eventStatusEnum, eventTypeEnum } from '@/db/schema/events'

type EventStatus = (typeof eventStatusEnum.enumValues)[number]
type EventType = (typeof eventTypeEnum.enumValues)[number]

const STATUS_CONFIG: Record<
  EventStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: LucideIcon; className?: string }
> = {
  draft:     { label: 'แบบร่าง',       variant: 'outline',     icon: FileEdit },
  published: { label: 'เผยแพร่',        variant: 'secondary',   icon: Eye },
  active:    { label: 'กำลังจัดงาน',   variant: 'secondary',   icon: Radio,
               className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  closed:    { label: 'ปิดแล้ว',        variant: 'destructive', icon: XCircle },
  archived:  { label: 'เก็บถาวร',       variant: 'outline',     icon: Archive },
}

const TYPE_CONFIG: Record<EventType, { label: string; icon: LucideIcon }> = {
  run:       { label: 'วิ่ง',      icon: Timer },
  triathlon: { label: 'ไตรกีฬา',   icon: Activity },
  other:     { label: 'อื่นๆ',     icon: Tag },
}

export function EventStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as EventStatus]
  if (!cfg) return <Badge variant="outline">{status}</Badge>
  const Icon = cfg.icon
  return (
    <Badge variant={cfg.variant} className={`gap-1 ${cfg.className ?? ''}`}>
      <Icon className="size-3" />
      {cfg.label}
    </Badge>
  )
}

export function EventTypeBadge({ eventType }: { eventType: string }) {
  const cfg = TYPE_CONFIG[eventType as EventType]
  if (!cfg) return <Badge variant="outline">{eventType}</Badge>
  const Icon = cfg.icon
  return (
    <Badge variant="outline" className="gap-1">
      <Icon className="size-3" />
      {cfg.label}
    </Badge>
  )
}
```

- [ ] **Step 2: ตรวจสอบ TypeScript**

```bash
cd /path/to/project && npx tsc --noEmit 2>&1 | grep event-badges
```
ผลที่คาดหวัง: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/dashboard/events/_components/event-badges.tsx"
git commit -m "feat: add EventStatusBadge and EventTypeBadge components"
```

---

## Task 2: EventsTable Client Component

**Files:**
- Create: `app/(dashboard)/dashboard/events/_components/events-table.tsx`

- [ ] **Step 1: สร้างไฟล์ events-table.tsx**

```tsx
// app/(dashboard)/dashboard/events/_components/events-table.tsx
'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import {
  Search,
  X,
  Pencil,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { EventRow } from '@/db/queries/events'
import { EventStatusBadge, EventTypeBadge } from './event-badges'

const PAGE_SIZE = 20

const STATUS_OPTIONS = [
  { value: 'all',       label: 'ทุกสถานะ' },
  { value: 'draft',     label: 'แบบร่าง' },
  { value: 'published', label: 'เผยแพร่' },
  { value: 'active',    label: 'กำลังจัดงาน' },
  { value: 'closed',    label: 'ปิดแล้ว' },
] as const

const TYPE_OPTIONS = [
  { value: 'all',       label: 'ทุกประเภท' },
  { value: 'run',       label: 'วิ่ง' },
  { value: 'triathlon', label: 'ไตรกีฬา' },
  { value: 'other',     label: 'อื่นๆ' },
] as const

type StatusFilter = (typeof STATUS_OPTIONS)[number]['value']
type TypeFilter   = (typeof TYPE_OPTIONS)[number]['value']

interface Props {
  events: EventRow[]
  canCreate: boolean
}

export function EventsTable({ events, canCreate }: Props) {
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter,   setTypeFilter]   = useState<TypeFilter>('all')
  const [page,         setPage]         = useState(1)

  const hasFilter = search !== '' || statusFilter !== 'all' || typeFilter !== 'all'

  const filtered = useMemo(() => {
    const lower = search.toLowerCase()
    return events.filter((e) => {
      if (search && !e.eventName.toLowerCase().includes(lower) && !e.sponsorName.toLowerCase().includes(lower)) return false
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      if (typeFilter   !== 'all' && e.eventType !== typeFilter) return false
      return true
    })
  }, [events, search, statusFilter, typeFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const rangeStart = (page - 1) * PAGE_SIZE + 1
  const rangeEnd   = Math.min(page * PAGE_SIZE, filtered.length)

  function resetPage() { setPage(1) }

  return (
    <div className="space-y-4">
      {/* Search + Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="ค้นหาชื่องานหรือ Sponsor..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage() }}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as StatusFilter); resetPage() }}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v as TypeFilter); resetPage() }}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilter && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setStatusFilter('all'); setTypeFilter('all'); resetPage() }}>
            <X className="size-4" />
            ล้างตัวกรอง
          </Button>
        )}
      </div>

      {/* Table or Empty State */}
      {paginated.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Calendar className="mx-auto mb-3 size-12 text-muted-foreground" />
          {hasFilter ? (
            <p className="text-muted-foreground">ไม่พบ Event ที่ตรงกับเงื่อนไข</p>
          ) : (
            <>
              <p className="font-medium">ยังไม่มี Event</p>
              {canCreate && (
                <p className="mt-1 text-sm text-muted-foreground">
                  กด &ldquo;สร้าง Event&rdquo; เพื่อเพิ่ม Event แรก
                </p>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>ชื่องาน</TableHead>
                <TableHead>Sponsor</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>วันที่เริ่ม</TableHead>
                <TableHead>วันที่สิ้นสุด</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((event) => (
                <TableRow key={event.eventId}>
                  <TableCell>
                    <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                      <Calendar className="size-4 text-muted-foreground" />
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{event.eventName}</TableCell>
                  <TableCell className="text-muted-foreground">{event.sponsorName}</TableCell>
                  <TableCell><EventTypeBadge eventType={event.eventType} /></TableCell>
                  <TableCell><EventStatusBadge status={event.status} /></TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(event.startDate), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(event.endDate), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/events/${event.eventId}`}>
                        <Pencil className="size-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            แสดง {rangeStart}–{rangeEnd} จาก {filtered.length} รายการ
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="size-4" />
                ก่อนหน้า
              </Button>
              <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                ถัดไป
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: ตรวจสอบ TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep events-table
```
ผลที่คาดหวัง: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/dashboard/events/_components/events-table.tsx"
git commit -m "feat: add EventsTable with search, status/type filter, pagination"
```

---

## Task 3: Events List Page

**Files:**
- Modify: `app/(dashboard)/dashboard/events/page.tsx`

- [ ] **Step 1: แก้ไข events/page.tsx**

แทนที่ไฟล์ทั้งหมดด้วย:

```tsx
// app/(dashboard)/dashboard/events/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Calendar, Plus } from 'lucide-react'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS } from '@/lib/rbac'
import { listEvents } from '@/db/queries/events'
import { Button } from '@/components/ui/button'
import { EventsTable } from './_components/events-table'

export default async function EventsPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const { role, sponsorId, permissions } = session.user
  const authz = { role, permissions }

  const canViewAll = canAccess(PERMISSIONS.EVENT_VIEW, authz)
  const canViewOwn = canAccess(PERMISSIONS.EVENT_VIEW_OWN, authz)

  if (!canViewAll && !canViewOwn) redirect('/dashboard')

  const scopedSponsorId = canViewAll ? undefined : (sponsorId ?? undefined)
  const eventList = await listEvents(scopedSponsorId)
  const canCreate = canAccess(PERMISSIONS.EVENT_CREATE, authz)

  return (
    <main className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="size-5 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold">Events</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {canViewAll ? 'รายการ Event ทั้งหมดในระบบ' : 'รายการ Event ของ Sponsor ท่าน'}
            </p>
          </div>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/dashboard/events/new">
              <Plus className="size-4" />
              สร้าง Event
            </Link>
          </Button>
        )}
      </div>

      <EventsTable events={eventList} canCreate={canCreate} />
    </main>
  )
}
```

- [ ] **Step 2: build check**

```bash
npx tsc --noEmit 2>&1
```
ผลที่คาดหวัง: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/dashboard/events/page.tsx"
git commit -m "feat: redesign events list page with icon header and EventsTable"
```

---

## Task 4: Events New Page + EventForm

**Files:**
- Modify: `app/(dashboard)/dashboard/events/new/page.tsx`
- Modify: `app/(dashboard)/dashboard/events/new/event-form.tsx`

- [ ] **Step 1: แก้ไข new/page.tsx — เพิ่ม back button + icon + Card wrapper**

```tsx
// app/(dashboard)/dashboard/events/new/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, Plus } from 'lucide-react'
import { auth } from '@/auth'
import { ROLES } from '@/lib/rbac'
import { listSponsors } from '@/db/queries/sponsors'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createEventAction } from '../actions'
import { EventForm } from './event-form'

export default async function NewEventPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const { role } = session.user
  if (role !== ROLES.SUPER_ADMIN_OWNER && role !== ROLES.SUPER_ADMIN_MANAGER) {
    redirect('/dashboard/events')
  }

  const sponsorList = await listSponsors()

  return (
    <main className="p-6 lg:p-8">
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
        <Link href="/dashboard/events">
          <ChevronLeft className="size-4" />
          Events
        </Link>
      </Button>

      <div className="mb-6 flex items-center gap-2">
        <Plus className="size-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">สร้าง Event ใหม่</h1>
      </div>

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="size-4" />
              ข้อมูล Event
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EventForm sponsors={sponsorList} action={createEventAction} />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: แก้ไข event-form.tsx — เพิ่ม icons + shadcn Select**

```tsx
// app/(dashboard)/dashboard/events/new/event-form.tsx
'use client'

import { useActionState } from 'react'
import { Tag, User, MapPin, Building2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
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
import type { ActionState } from '../actions'

type Sponsor = { sponsorId: string; sponsorName: string }

type EventFormProps = {
  sponsors: Sponsor[]
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>
  defaultValues?: {
    sponsorId?: string
    eventName?: string
    eventLocation?: string
    eventCity?: string
    eventType?: string
    organizerName?: string
    startDate?: string
    endDate?: string
  }
}

function IconField({
  icon: Icon, label, id, name, type, defaultValue, placeholder, error,
}: {
  icon: LucideIcon; label: string; id: string; name: string
  type?: string; defaultValue?: string; placeholder?: string; error?: string[]
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id} name={name} type={type} className="pl-9"
          defaultValue={defaultValue ?? ''} placeholder={placeholder}
          aria-invalid={!!error}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error[0]}</p>}
    </div>
  )
}

export function EventForm({ sponsors, action, defaultValues }: EventFormProps) {
  const [state, formAction, isPending] = useActionState(action, {})

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <p className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      {/* Sponsor */}
      <div className="space-y-1.5">
        <Label htmlFor="sponsorId">Sponsor</Label>
        <Select name="sponsorId" defaultValue={defaultValues?.sponsorId ?? ''} required>
          <SelectTrigger id="sponsorId" className="w-full">
            <SelectValue placeholder="เลือก Sponsor" />
          </SelectTrigger>
          <SelectContent>
            {sponsors.map((s) => (
              <SelectItem key={s.sponsorId} value={s.sponsorId}>
                {s.sponsorName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.fieldErrors?.sponsorId && (
          <p className="text-xs text-destructive">{state.fieldErrors.sponsorId[0]}</p>
        )}
      </div>

      <IconField
        icon={Tag} label="ชื่องาน" id="eventName" name="eventName"
        defaultValue={defaultValues?.eventName} placeholder="เช่น MACIM Run 2025"
        error={state.fieldErrors?.eventName}
      />

      <IconField
        icon={User} label="ชื่อผู้จัด" id="organizerName" name="organizerName"
        defaultValue={defaultValues?.organizerName} placeholder="เช่น MACIM SPORT Co., Ltd."
        error={state.fieldErrors?.organizerName}
      />

      {/* Event Type */}
      <div className="space-y-1.5">
        <Label htmlFor="eventType">ประเภทกีฬา</Label>
        <Select name="eventType" defaultValue={defaultValues?.eventType ?? 'run'}>
          <SelectTrigger id="eventType" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="run">วิ่ง (Run)</SelectItem>
            <SelectItem value="triathlon">ไตรกีฬา (Triathlon)</SelectItem>
            <SelectItem value="other">อื่นๆ (Other)</SelectItem>
          </SelectContent>
        </Select>
        {state.fieldErrors?.eventType && (
          <p className="text-xs text-destructive">{state.fieldErrors.eventType[0]}</p>
        )}
      </div>

      <IconField
        icon={MapPin} label="สถานที่จัดงาน" id="eventLocation" name="eventLocation"
        defaultValue={defaultValues?.eventLocation} placeholder="เช่น สนามกีฬาแห่งชาติ"
        error={state.fieldErrors?.eventLocation}
      />

      <IconField
        icon={Building2} label="เมือง / จังหวัด" id="eventCity" name="eventCity"
        defaultValue={defaultValues?.eventCity} placeholder="เช่น กรุงเทพมหานคร"
        error={state.fieldErrors?.eventCity}
      />

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="startDate">วันที่เริ่ม</Label>
          <Input id="startDate" name="startDate" type="date"
            defaultValue={defaultValues?.startDate} required />
          {state.fieldErrors?.startDate && (
            <p className="text-xs text-destructive">{state.fieldErrors.startDate[0]}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endDate">วันที่สิ้นสุด</Label>
          <Input id="endDate" name="endDate" type="date"
            defaultValue={defaultValues?.endDate} required />
          {state.fieldErrors?.endDate && (
            <p className="text-xs text-destructive">{state.fieldErrors.endDate[0]}</p>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'กำลังบันทึก...' : 'สร้าง Event'}
        </Button>
        <Button variant="outline" asChild>
          <a href="/dashboard/events">ยกเลิก</a>
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 3: ตรวจสอบ TypeScript**

```bash
npx tsc --noEmit 2>&1
```
ผลที่คาดหวัง: ไม่มี error

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/dashboard/events/new/page.tsx" \
        "app/(dashboard)/dashboard/events/new/event-form.tsx"
git commit -m "feat: add back button, Card wrapper, and input icons to new event page"
```

---

## Task 5: Events Edit Page + EventEditForm

**Files:**
- Modify: `app/(dashboard)/dashboard/events/[id]/edit/page.tsx`
- Modify: `app/(dashboard)/dashboard/events/[id]/event-edit-form.tsx`

- [ ] **Step 1: แก้ไข edit/page.tsx — back button + icon + Card**

```tsx
// app/(dashboard)/dashboard/events/[id]/edit/page.tsx
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Pencil } from 'lucide-react'
import { auth } from '@/auth'
import { ROLES } from '@/lib/rbac'
import { getEvent } from '@/db/queries/events'
import { listSponsors } from '@/db/queries/sponsors'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { updateEventAction } from '../actions'
import { EventEditForm } from '../event-edit-form'

type Props = { params: Promise<{ id: string }> }

export default async function EditEventPage({ params }: Props) {
  const { id } = await params

  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const { role } = session.user
  if (role !== ROLES.SUPER_ADMIN_OWNER && role !== ROLES.SUPER_ADMIN_MANAGER) {
    redirect(`/dashboard/events/${id}`)
  }

  const [event, sponsorList] = await Promise.all([getEvent(id), listSponsors()])
  if (!event) notFound()

  const boundUpdateAction = updateEventAction.bind(null, id)

  return (
    <main className="p-6 lg:p-8">
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
        <Link href={`/dashboard/events/${id}`}>
          <ChevronLeft className="size-4" />
          {event.eventName}
        </Link>
      </Button>

      <div className="mb-6 flex items-center gap-2">
        <Pencil className="size-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">แก้ไข Event</h1>
      </div>

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Pencil className="size-4" />
              แก้ไขข้อมูล
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EventEditForm
              sponsors={sponsorList}
              defaultValues={{
                sponsorId:     event.sponsorId,
                eventName:     event.eventName,
                eventLocation: event.eventLocation,
                eventCity:     event.eventCity,
                eventType:     event.eventType,
                organizerName: event.organizerName,
                startDate:     event.startDate,
                endDate:       event.endDate,
              }}
              action={boundUpdateAction}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: แก้ไข event-edit-form.tsx — icons + shadcn Select (เหมือน EventForm)**

```tsx
// app/(dashboard)/dashboard/events/[id]/event-edit-form.tsx
'use client'

import { useActionState } from 'react'
import { Tag, User, MapPin, Building2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
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
import type { ActionState } from './actions'

type Sponsor = { sponsorId: string; sponsorName: string }

type EventEditFormProps = {
  sponsors: Sponsor[]
  defaultValues: {
    sponsorId: string
    eventName: string
    eventLocation: string
    eventCity: string
    eventType: string
    organizerName: string
    startDate: string
    endDate: string
  }
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>
}

function IconField({
  icon: Icon, label, id, name, type, defaultValue, placeholder, error,
}: {
  icon: LucideIcon; label: string; id: string; name: string
  type?: string; defaultValue?: string; placeholder?: string; error?: string[]
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id} name={name} type={type} className="pl-9"
          defaultValue={defaultValue ?? ''} placeholder={placeholder}
          aria-invalid={!!error}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error[0]}</p>}
    </div>
  )
}

export function EventEditForm({ sponsors, defaultValues, action }: EventEditFormProps) {
  const [state, formAction, isPending] = useActionState(action, {})

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <p className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      {/* Sponsor */}
      <div className="space-y-1.5">
        <Label htmlFor="sponsorId">Sponsor</Label>
        <Select name="sponsorId" defaultValue={defaultValues.sponsorId}>
          <SelectTrigger id="sponsorId" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sponsors.map((s) => (
              <SelectItem key={s.sponsorId} value={s.sponsorId}>
                {s.sponsorName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.fieldErrors?.sponsorId && (
          <p className="text-xs text-destructive">{state.fieldErrors.sponsorId[0]}</p>
        )}
      </div>

      <IconField
        icon={Tag} label="ชื่องาน" id="eventName" name="eventName"
        defaultValue={defaultValues.eventName} error={state.fieldErrors?.eventName}
      />
      <IconField
        icon={User} label="ชื่อผู้จัด" id="organizerName" name="organizerName"
        defaultValue={defaultValues.organizerName} error={state.fieldErrors?.organizerName}
      />

      {/* Event Type */}
      <div className="space-y-1.5">
        <Label htmlFor="eventType">ประเภทกีฬา</Label>
        <Select name="eventType" defaultValue={defaultValues.eventType}>
          <SelectTrigger id="eventType" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="run">วิ่ง (Run)</SelectItem>
            <SelectItem value="triathlon">ไตรกีฬา (Triathlon)</SelectItem>
            <SelectItem value="other">อื่นๆ (Other)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <IconField
        icon={MapPin} label="สถานที่จัดงาน" id="eventLocation" name="eventLocation"
        defaultValue={defaultValues.eventLocation} error={state.fieldErrors?.eventLocation}
      />
      <IconField
        icon={Building2} label="เมือง / จังหวัด" id="eventCity" name="eventCity"
        defaultValue={defaultValues.eventCity} error={state.fieldErrors?.eventCity}
      />

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="startDate">วันที่เริ่ม</Label>
          <Input id="startDate" name="startDate" type="date"
            defaultValue={defaultValues.startDate} required />
          {state.fieldErrors?.startDate && (
            <p className="text-xs text-destructive">{state.fieldErrors.startDate[0]}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endDate">วันที่สิ้นสุด</Label>
          <Input id="endDate" name="endDate" type="date"
            defaultValue={defaultValues.endDate} required />
          {state.fieldErrors?.endDate && (
            <p className="text-xs text-destructive">{state.fieldErrors.endDate[0]}</p>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
        </Button>
        <Button variant="outline" asChild>
          <a href="..">ยกเลิก</a>
        </Button>
      </div>
    </form>
  )
}
```

> **Note:** `<a href="..">` ทำงานได้เพราะ edit page อยู่ที่ `/dashboard/events/[id]/edit` → `..` = `/dashboard/events/[id]`

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1
```

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/dashboard/events/[id]/edit/page.tsx" \
        "app/(dashboard)/dashboard/events/[id]/event-edit-form.tsx"
git commit -m "feat: add back button, Card wrapper, and input icons to event edit page"
```

---

## Task 6: Events Detail Page (Header Card + Info Card)

**Files:**
- Modify: `app/(dashboard)/dashboard/events/[id]/page.tsx`

**เป้าหมาย:** เพิ่ม back button, เปลี่ยน header เป็น Card, เปลี่ยน info tab จาก `dl` เป็น Card, ใช้ badges จาก event-badges.tsx แทน inline maps

- [ ] **Step 1: แก้ไข events/[id]/page.tsx**

แทนที่ content ทั้งหมด:

```tsx
// app/(dashboard)/dashboard/events/[id]/page.tsx
import { Suspense } from 'react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { ChevronLeft, Calendar, Pencil, MapPin, User, Building2, CalendarDays } from 'lucide-react'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS, ROLES } from '@/lib/rbac'
import { getEvent } from '@/db/queries/events'
import { listStations } from '@/db/queries/stations'
import { listAthletesByEvent } from '@/db/queries/athletes'
import { signStationToken } from '@/lib/station-token'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusButtons } from './status-buttons'
import { DeleteEventButton } from './delete-event-button'
import { EventTabs } from './_components/event-tabs'
import { StationForm } from './stations/station-form'
import { ToggleStationButton } from './stations/toggle-station-button'
import { DeleteStationButton } from './stations/delete-station-button'
import { EditStationDialog } from './stations/edit-station-dialog'
import { StationQrButton } from './stations/_components/station-qr-button'
import { createStationAction, updateStationAction } from './actions'
import { EventStatusBadge, EventTypeBadge } from '../_components/event-badges'

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
  searchParams: Promise<{ tab?: string }>
}

export default async function EventDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  await searchParams

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

  const canEdit = role === ROLES.SUPER_ADMIN_OWNER || role === ROLES.SUPER_ADMIN_MANAGER
  const canFullEdit = canEdit && event.status !== 'active'

  const [stationList, athleteList, headersList] = await Promise.all([
    listStations(id),
    listAthletesByEvent(id),
    headers(),
  ])

  const activeStations = stationList.filter((s) => s.status === 'active')
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

  const boundCreateStation = createStationAction.bind(null, id)

  // ─── Tab content ────────────────────────────────────────────────────────────

  const infoContent = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="size-4" />
          รายละเอียดงาน
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <dt className="text-muted-foreground">สถานที่</dt>
              <dd className="font-medium">{event.eventLocation}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <dt className="text-muted-foreground">เมือง</dt>
              <dd>{event.eventCity}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <dt className="text-muted-foreground">ผู้จัด</dt>
              <dd>{event.organizerName}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Calendar className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <dt className="text-muted-foreground">ช่วงเวลา</dt>
              <dd>{event.startDate} – {event.endDate}</dd>
            </div>
          </div>
        </dl>
      </CardContent>
    </Card>
  )

  const stationsContent = (
    <div className="space-y-4">
      {stationList.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          ยังไม่มี Station — เพิ่ม Station แรกด้านล่าง
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อ Station</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead>Stamp เมื่อ Add Friend</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="text-right">Self Check-in</TableHead>
                {canEdit && <TableHead className="text-right">การดำเนินการ</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {stationList.map((station) => {
                const boundUpdateStation = updateStationAction.bind(null, station.stationId, id)
                const selfCheckinUrl = stationTokenMap.get(station.stationId)
                return (
                  <TableRow key={station.stationId} className={station.status === 'inactive' ? 'opacity-50' : undefined}>
                    <TableCell className="font-medium">{station.stationName}</TableCell>
                    <TableCell>
                      <Badge variant={STATION_TYPE_VARIANT[station.stationType] ?? 'outline'}>
                        {STATION_TYPE_LABEL[station.stationType] ?? station.stationType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {station.stampOnAddFriend
                        ? <Badge variant="secondary">เปิดใช้งาน</Badge>
                        : <span className="text-muted-foreground text-sm">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={station.status === 'active' ? 'default' : 'outline'}>
                        {station.status === 'active' ? 'ใช้งาน' : 'ปิดใช้งาน'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {selfCheckinUrl && (
                        <StationQrButton stationName={station.stationName} selfCheckinUrl={selfCheckinUrl} />
                      )}
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <ToggleStationButton stationId={station.stationId} eventId={id} currentStatus={station.status} />
                          {canFullEdit && (
                            <>
                              <EditStationDialog station={station} action={boundUpdateStation} />
                              <DeleteStationButton stationId={station.stationId} eventId={id} stationName={station.stationName} />
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">เพิ่ม Station ใหม่</CardTitle>
          </CardHeader>
          <CardContent className="max-w-lg">
            <StationForm action={boundCreateStation} />
          </CardContent>
        </Card>
      )}
    </div>
  )

  const athletesContent = (
    <div>
      {athleteList.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          <p>ยังไม่มีนักกีฬา</p>
          {canEdit && (
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href={`/dashboard/events/${id}/import`}>นำเข้าข้อมูลนักกีฬา</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{athleteList.length} คน</p>
            {canEdit && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/events/${id}/import`}>นำเข้าข้อมูล</Link>
              </Button>
            )}
          </div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>BIB</TableHead>
                  <TableHead>ชื่อ-นามสกุล</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">Stamps</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {athleteList.map((a) => (
                  <TableRow key={a.registrationId}>
                    <TableCell className="font-mono">{a.bibNumber}</TableCell>
                    <TableCell>
                      {a.firstName && a.lastName
                        ? `${a.firstName} ${a.lastName}`
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={a.status === 'active' ? 'default' : 'outline'}>
                        {a.status === 'active' ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{a.stampCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )

  // ─── Page ──────────────────────────────────────────────────────────────────

  return (
    <main className="p-6 lg:p-8">
      {/* Back nav */}
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
        <Link href="/dashboard/events">
          <ChevronLeft className="size-4" />
          Events
        </Link>
      </Button>

      {/* Profile Header Card */}
      <Card className="mb-6">
        <CardContent className="flex items-center justify-between gap-4 pt-6">
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-full bg-muted">
              <Calendar className="size-7 text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              <p className="text-lg font-semibold">{event.eventName}</p>
              <div className="flex flex-wrap gap-2">
                <EventStatusBadge status={event.status} />
                <EventTypeBadge eventType={event.eventType} />
              </div>
              <p className="text-sm text-muted-foreground">
                {event.sponsorName} · {event.eventCity}
              </p>
            </div>
          </div>

          {canEdit && (
            <div className="flex items-center gap-2">
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
        </CardContent>
      </Card>

      {/* Tabs */}
      <Suspense fallback={null}>
        <EventTabs
          infoContent={infoContent}
          stationsContent={stationsContent}
          athletesContent={athletesContent}
        />
      </Suspense>
    </main>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1
```
ผลที่คาดหวัง: ไม่มี error

- [ ] **Step 3: Build check**

```bash
npx next build 2>&1 | tail -15
```
ผลที่คาดหวัง: build สำเร็จ ไม่มี error

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/dashboard/events/[id]/page.tsx"
git commit -m "feat: redesign event detail page with header card, back navigation, and info card"
```

---

## Self-Review

### Spec Coverage

| ข้อกำหนด | Task ที่ implement |
|---|---|
| Icon + subtitle ใน list header | Task 3 |
| Search + filter + pagination ใน list | Task 2 |
| Empty state with icon | Task 2 |
| Per-row edit button | Task 2 |
| Back button บน new page | Task 4 |
| Card wrapper บน new page | Task 4 |
| Icons ใน form inputs | Task 4, 5 |
| shadcn Select แทน native select | Task 4, 5 |
| Back button บน edit page | Task 5 |
| Card wrapper บน edit page | Task 5 |
| Back button บน detail page | Task 6 |
| Header Card บน detail page | Task 6 |
| EventStatusBadge / EventTypeBadge | Task 1 |
| ลบ duplicate label maps | Task 3, 6 (ย้ายไป event-badges.tsx) |
| Info tab เป็น Card | Task 6 |
| "เพิ่ม Station" เป็น Card | Task 6 |

### ข้อสังเกต

- **`EventForm` และ `EventEditForm`** มี `IconField` helper ซ้ำกัน — ถ้าต้องการ DRY ให้ย้ายไป `_components/icon-field.tsx` ในรอบถัดไป แต่ยังไม่ include ในแผนนี้เพื่อลด scope
- **`EventEditForm` ปุ่มยกเลิก** ใช้ `<a href="..">` แทน `<Link>` เพราะ navigate back ใน Next.js App Router จาก `[id]/edit` → `[id]` ได้ด้วย relative path
- **Date format** ใน EventsTable ใช้ `format(new Date(event.startDate), 'dd/MM/yyyy')` — event.startDate เป็น string (not Date object) จึงต้อง `new Date()` ก่อน
- **Task ลำดับ 1→2→3→4→5→6** ต้องทำตามลำดับเพราะ Task 3 depend on Task 2, Task 6 depend on Task 1
