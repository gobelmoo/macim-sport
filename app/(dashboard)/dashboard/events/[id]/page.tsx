import { Suspense } from 'react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import sanitizeHtml from 'sanitize-html'
import { ChevronLeft, Calendar, Pencil, MapPin, User, Building2, CalendarDays, AlignLeft, FileText, Images } from 'lucide-react'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS, ROLES } from '@/lib/rbac'
import { getEvent } from '@/db/queries/events'
import { listGalleryImages } from '@/db/queries/event_gallery_images'
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
import { CopyLiffLinkButton } from './_components/copy-liff-link-button'
import { AddStationDialog } from './stations/add-station-dialog'
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

  const [stationList, athleteList, galleryImages, headersList] = await Promise.all([
    listStations(id),
    listAthletesByEvent(id),
    listGalleryImages(id),
    headers(),
  ])

  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  const baseUrl = `${protocol}://${host}`
  // Only generate QR tokens when event is active — self-checkin page enforces the same check
  const stationTokenMap = new Map<string, string>()
  if (event.status === 'active') {
    const activeStations = stationList.filter((s) => s.status === 'active')
    await Promise.all(
      activeStations.map(async (s) => {
        const token = await signStationToken({ stationId: s.stationId, eventId: id })
        stationTokenMap.set(s.stationId, `${baseUrl}/self-checkin/${token}`)
      }),
    )
  }

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
      {canFullEdit && (
        <div className="flex justify-end">
          <AddStationDialog action={boundCreateStation} />
        </div>
      )}
      {stationList.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          ยังไม่มี Station
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
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-muted overflow-hidden">
              {event.eventLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={event.eventLogoUrl} alt="" className="size-14 object-cover" />
              ) : (
                <Calendar className="size-7 text-muted-foreground" />
              )}
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
              {(event.status === 'published' || event.status === 'active') && (
                <CopyLiffLinkButton eventId={event.eventId} />
              )}
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

      {/* Info — always visible */}
      <div className="mb-6">{infoContent}</div>

      {/* Short Description */}
      {event.description && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlignLeft className="size-4" />
              คำอธิบายสั้น
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Long Description */}
      {event.longDescription && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4" />
              รายละเอียดงาน
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{
                __html: sanitizeHtml(event.longDescription, {
                  allowedTags: ['p','strong','em','h2','h3','ul','ol','li','a','br'],
                  allowedAttributes: { a: ['href','target','rel'] },
                }),
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Gallery */}
      {galleryImages.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Images className="size-4" />
              แกลเลอรี ({galleryImages.length} รูป)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {galleryImages.map((img) => (
                <div key={img.imageId} className="space-y-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.imageUrl}
                    alt={img.caption ?? ''}
                    className="aspect-square w-full rounded-md object-cover"
                  />
                  {img.caption && (
                    <p className="text-xs text-muted-foreground truncate">{img.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs: Stations + Athletes */}
      <Suspense fallback={null}>
        <EventTabs
          stationsContent={stationsContent}
          athletesContent={athletesContent}
        />
      </Suspense>
    </main>
  )
}
