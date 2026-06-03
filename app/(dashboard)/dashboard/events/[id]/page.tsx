import { Suspense } from 'react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS, ROLES } from '@/lib/rbac'
import { getEvent } from '@/db/queries/events'
import { listStations } from '@/db/queries/stations'
import { listAthletesByEvent } from '@/db/queries/athletes'
import { signStationToken } from '@/lib/station-token'
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

  const canEdit =
    role === ROLES.SUPER_ADMIN_OWNER || role === ROLES.SUPER_ADMIN_MANAGER
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
                {canEdit && (
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
                const selfCheckinUrl = stationTokenMap.get(station.stationId)
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
                      {selfCheckinUrl && (
                        <StationQrButton
                          stationName={station.stationName}
                          selfCheckinUrl={selfCheckinUrl}
                        />
                      )}
                    </TableCell>
                    {canEdit && (
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
