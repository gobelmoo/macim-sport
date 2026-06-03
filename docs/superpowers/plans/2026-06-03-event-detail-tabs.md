# Event Detail + Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate event detail view from edit form, and embed Stations + Athletes as URL-based tabs on the detail page.

**Architecture:** The detail page (`[id]/page.tsx`) becomes a server component that reads `searchParams.tab`, fetches all tab data upfront, and passes server-rendered content slots to a thin client `EventTabs` component (shadcn `<Tabs>` + `useRouter` for URL sync). A new `[id]/edit/page.tsx` holds the edit form.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM, shadcn/ui Tabs, TypeScript

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `db/queries/athletes.ts` | Modify | Add `listAthletesByEvent(eventId)` |
| `app/(dashboard)/dashboard/events/[id]/page.tsx` | Modify | Detail view + tabs (info/stations/athletes) |
| `app/(dashboard)/dashboard/events/[id]/edit/page.tsx` | **Create** | Edit form for owner/manager |
| `app/(dashboard)/dashboard/events/[id]/_components/event-tabs.tsx` | **Create** | Client tabs component (URL sync) |

Unchanged: `stations/page.tsx`, `import/page.tsx`, `event-edit-form.tsx`, `actions.ts`

---

### Task 1: Add `listAthletesByEvent` query

**Files:**
- Modify: `db/queries/athletes.ts`

- [ ] **Step 1: Add the new export to `db/queries/athletes.ts`**

Add at the end of the file (after `listAthletesWithCheckinCounts`):

```ts
export interface AthleteEventRow {
  registrationId: string
  athleteId: string | null
  bibNumber: string
  firstName: string | null
  lastName: string | null
  status: 'active' | 'hidden' | 'inactive'
  registeredAt: Date
  stampCount: number
}

export async function listAthletesByEvent(
  eventId: string,
): Promise<AthleteEventRow[]> {
  const rows = await db
    .select({
      registrationId: athleteEventRegistrations.registrationId,
      athleteId: athleteEventRegistrations.athleteId,
      bibNumber: athleteEventRegistrations.bibNumber,
      status: athleteEventRegistrations.status,
      registeredAt: athleteEventRegistrations.registeredAt,
      firstName: athletes.firstName,
      lastName: athletes.lastName,
      stampCount: count(stamps.stampId),
    })
    .from(athleteEventRegistrations)
    .leftJoin(
      athletes,
      eq(athleteEventRegistrations.athleteId, athletes.athleteId),
    )
    .leftJoin(
      stamps,
      and(
        eq(stamps.athleteId, athleteEventRegistrations.athleteId),
        eq(stamps.eventId, eventId),
      ),
    )
    .where(eq(athleteEventRegistrations.eventId, eventId))
    .groupBy(
      athleteEventRegistrations.registrationId,
      athleteEventRegistrations.athleteId,
      athleteEventRegistrations.bibNumber,
      athleteEventRegistrations.status,
      athleteEventRegistrations.registeredAt,
      athletes.firstName,
      athletes.lastName,
    )
    .orderBy(athleteEventRegistrations.bibNumber)

  return rows.map((r) => ({ ...r, stampCount: Number(r.stampCount) }))
}
```

- [ ] **Step 2: Update the imports at the top of `db/queries/athletes.ts`**

The current first line is:
```ts
import { count, eq, inArray } from 'drizzle-orm'
```

Replace with:
```ts
import { and, count, eq, inArray } from 'drizzle-orm'
import { stamps } from '@/db/schema/stamps'
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (no errors)

- [ ] **Step 4: Commit**

```bash
git add db/queries/athletes.ts
git commit -m "feat: add listAthletesByEvent query with stamp count"
```

---

### Task 2: Create `EventTabs` client component

**Files:**
- Create: `app/(dashboard)/dashboard/events/[id]/_components/event-tabs.tsx`

- [ ] **Step 1: Create the file**

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'

interface EventTabsProps {
  infoContent: React.ReactNode
  stationsContent: React.ReactNode
  athletesContent: React.ReactNode
}

export function EventTabs({
  infoContent,
  stationsContent,
  athletesContent,
}: EventTabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'info'

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'info') {
      params.delete('tab')
    } else {
      params.set('tab', value)
    }
    const query = params.toString()
    router.replace(query ? `?${query}` : window.location.pathname)
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList className="mb-6">
        <TabsTrigger value="info">ข้อมูล</TabsTrigger>
        <TabsTrigger value="stations">Stations</TabsTrigger>
        <TabsTrigger value="athletes">นักกีฬา</TabsTrigger>
      </TabsList>
      <TabsContent value="info">{infoContent}</TabsContent>
      <TabsContent value="stations">{stationsContent}</TabsContent>
      <TabsContent value="athletes">{athletesContent}</TabsContent>
    </Tabs>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/dashboard/events/[id]/_components/event-tabs.tsx"
git commit -m "feat: add EventTabs client component with URL sync"
```

---

### Task 3: Create edit page

**Files:**
- Create: `app/(dashboard)/dashboard/events/[id]/edit/page.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { ROLES } from '@/lib/rbac'
import { getEvent } from '@/db/queries/events'
import { listSponsors } from '@/db/queries/sponsors'
import { updateEventAction } from '../actions'
import { EventEditForm } from '../event-edit-form'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

type Props = {
  params: Promise<{ id: string }>
}

export default async function EditEventPage({ params }: Props) {
  const { id } = await params

  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const { role } = session.user
  const canEdit =
    role === ROLES.SUPER_ADMIN_OWNER || role === ROLES.SUPER_ADMIN_MANAGER
  if (!canEdit) redirect(`/dashboard/events/${id}`)

  const [event, sponsorList] = await Promise.all([
    getEvent(id),
    listSponsors(),
  ])
  if (!event) notFound()

  const boundUpdateAction = updateEventAction.bind(null, id)

  return (
    <main className="p-6 lg:p-8 max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">แก้ไข: {event.eventName}</h1>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/dashboard/events/${id}`}>ยกเลิก</Link>
        </Button>
      </div>

      <div className="rounded-lg border p-6">
        <EventEditForm
          sponsors={sponsorList}
          defaultValues={{
            sponsorId: event.sponsorId,
            eventName: event.eventName,
            eventLocation: event.eventLocation,
            eventCity: event.eventCity,
            eventType: event.eventType,
            organizerName: event.organizerName,
            startDate: event.startDate,
            endDate: event.endDate,
          }}
          action={boundUpdateAction}
        />
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Update `updateEventAction` redirect in `actions.ts`**

Currently `updateEventAction` redirects to `/dashboard/events/${eventId}`. That's already correct — after save from the edit page it returns to detail. No change needed.

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/dashboard/events/[id]/edit/page.tsx"
git commit -m "feat: add event edit page at [id]/edit"
```

---

### Task 4: Refactor detail page with tabs

**Files:**
- Modify: `app/(dashboard)/dashboard/events/[id]/page.tsx`

This is the main refactor. The page becomes a server component that:
1. Reads `searchParams`
2. Fetches event + stations + athletes
3. Builds station token map (same logic as current `stations/page.tsx`)
4. Renders header (with "แก้ไข" button instead of inline form) + `<EventTabs>`

- [ ] **Step 1: Replace the full content of `[id]/page.tsx`**

```tsx
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS, ROLES } from '@/lib/rbac'
import { getEvent } from '@/db/queries/events'
import { listStations } from '@/db/queries/stations'
import { listAthletesByEvent } from '@/db/queries/athletes'
import { listSponsors } from '@/db/queries/sponsors'
import { signStationToken } from '@/lib/station-token'
import { formatThaiDate } from '@/lib/utils'
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
import { StatusButtons } from './status-buttons'
import { DeleteEventButton } from './delete-event-button'
import { EventTabs } from './_components/event-tabs'
import { StationForm } from './stations/station-form'
import { ToggleStationButton } from './stations/toggle-station-button'
import { DeleteStationButton } from './stations/delete-station-button'
import { EditStationDialog } from './stations/edit-station-dialog'
import { StationQrButton } from './stations/_components/station-qr-button'
import { createStationAction, updateStationAction } from './actions'

const EVENT_TYPE_LABEL: Record<string, string> = {
  run: 'วิ่ง',
  triathlon: 'ไตรกีฬา',
  other: 'อื่นๆ',
}

const EVENT_STATUS_LABEL: Record<string, string> = {
  draft: 'แบบร่าง',
  published: 'เผยแพร่',
  active: 'กำลังจัดงาน',
  closed: 'ปิดแล้ว',
  archived: 'เก็บถาวร',
}

const EVENT_STATUS_VARIANT: Record<
  string,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  draft: 'outline',
  published: 'secondary',
  active: 'default',
  closed: 'destructive',
  archived: 'outline',
}

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
  await searchParams // resolve but we don't need it server-side — tabs read via useSearchParams

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

  const canEdit =
    role === ROLES.SUPER_ADMIN_OWNER || role === ROLES.SUPER_ADMIN_MANAGER
  const canManage = canEdit
  const canFullEdit = canManage && event.status !== 'active'

  // Fetch all tab data in parallel
  const [stationList, athleteList] = await Promise.all([
    listStations(id),
    listAthletesByEvent(id),
  ])

  // Generate QR token URLs for active stations
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

  const boundCreateStation = createStationAction.bind(null, id)

  // ── Tab content ────────────────────────────────────────────────

  const infoContent = (
    <div className="rounded-lg border p-6">
      <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
        <div>
          <dt className="text-muted-foreground">ชื่องาน</dt>
          <dd className="font-medium">{event.eventName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Sponsor</dt>
          <dd>{event.sponsorName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">สถานที่</dt>
          <dd>{event.eventLocation}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">เมือง</dt>
          <dd>{event.eventCity}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">ผู้จัด</dt>
          <dd>{event.organizerName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">ช่วงเวลา</dt>
          <dd>
            {event.startDate} – {event.endDate}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">ประเภท</dt>
          <dd>{EVENT_TYPE_LABEL[event.eventType] ?? event.eventType}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">สาธารณะ</dt>
          <dd>{event.isPublic ? 'ใช่' : 'ไม่'}</dd>
        </div>
      </dl>
    </div>
  )

  const stationsContent = (
    <div>
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
                    <TableCell className="font-medium">{station.stationName}</TableCell>
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
                      {(() => {
                        const selfCheckinUrl = stationTokenMap.get(station.stationId)
                        return selfCheckinUrl && (
                          <StationQrButton
                            stationName={station.stationName}
                            selfCheckinUrl={selfCheckinUrl}
                          />
                        )
                      })()}
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
                    <TableCell className="text-right tabular-nums">
                      {a.stampCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )

  return (
    <main className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold">{event.eventName}</h1>
            <Badge variant={EVENT_STATUS_VARIANT[event.status] ?? 'outline'}>
              {EVENT_STATUS_LABEL[event.status] ?? event.status}
            </Badge>
            <Badge variant="secondary">
              {EVENT_TYPE_LABEL[event.eventType] ?? event.eventType}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {event.sponsorName} · {event.eventCity}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && event.status === 'draft' && (
            <DeleteEventButton eventId={event.eventId} />
          )}
          {canEdit && (
            <StatusButtons eventId={event.eventId} currentStatus={event.status} />
          )}
          {canEdit && (
            <Button size="sm" asChild>
              <Link href={`/dashboard/events/${id}/edit`}>แก้ไข</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <EventTabs
        infoContent={infoContent}
        stationsContent={stationsContent}
        athletesContent={athletesContent}
      />
    </main>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no output

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/dashboard/events/[id]/page.tsx"
git commit -m "feat: refactor event detail page with info/stations/athletes tabs"
```

---

### Task 5: Verify end-to-end

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Check detail page renders**

Navigate to `/dashboard/events/[any-event-id]`

Expected:
- Header with event name, status badge, type badge
- "แก้ไข" button visible for super_admin (links to `/edit`)
- 3 tabs: ข้อมูล, Stations, นักกีฬา
- Default tab "ข้อมูล" shows read-only info grid

- [ ] **Step 3: Check tab URL sync**

Click "Stations" tab → URL updates to `?tab=stations`
Click "นักกีฬา" tab → URL updates to `?tab=athletes`
Reload page with `?tab=stations` → Stations tab is active

- [ ] **Step 4: Check edit page**

Click "แก้ไข" → navigates to `/dashboard/events/[id]/edit`
Expected: edit form with pre-filled values, "ยกเลิก" button returns to detail

- [ ] **Step 5: Check stations tab**

Stations tab shows station table, toggle/edit/delete buttons (when canManage), "เพิ่ม Station" form (when canFullEdit)

- [ ] **Step 6: Check athletes tab**

Athletes tab shows registration table with BIB, name, status, stamp count
Empty state shows "นำเข้าข้อมูลนักกีฬา" button

- [ ] **Step 7: Final commit (if any cleanup needed)**

```bash
git add -A
git commit -m "fix: event detail tabs cleanup"
```
