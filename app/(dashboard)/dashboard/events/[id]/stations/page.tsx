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
  // event ไม่ active → แก้ไข / ลบ / เพิ่มได้
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
