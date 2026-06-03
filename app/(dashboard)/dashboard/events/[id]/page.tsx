import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS, ROLES } from '@/lib/rbac'
import { getEvent } from '@/db/queries/events'
import { listSponsors } from '@/db/queries/sponsors'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { updateEventAction } from './actions'
import { EventEditForm } from './event-edit-form'
import { StatusButtons } from './status-buttons'

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

type Props = {
  params: Promise<{ id: string }>
}

export default async function EventDetailPage({ params }: Props) {
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

  // sponsor_admin can only view their own events
  if (canViewOwn && !canViewAll && event.sponsorId !== userSponsorId) {
    notFound()
  }

  const canEdit =
    role === ROLES.SUPER_ADMIN_OWNER || role === ROLES.SUPER_ADMIN_MANAGER

  const sponsorList = canEdit ? await listSponsors() : []

  const boundUpdateAction = updateEventAction.bind(null, id)

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
          {canEdit && (
            <StatusButtons eventId={event.eventId} currentStatus={event.status} />
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/events/${id}/stations`}>จัดการ Stations</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/events/${id}/import`}>นำเข้าข้อมูลนักกีฬา</Link>
          </Button>
        </div>
      </div>

      {/* Edit Form (owner/manager only) */}
      {canEdit ? (
        <div className="rounded-lg border p-6">
          <h2 className="text-lg font-medium mb-5">แก้ไขข้อมูล Event</h2>
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
      ) : (
        /* Read-only view for sponsor_admin */
        <div className="rounded-lg border p-6 space-y-3">
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
          </dl>
        </div>
      )}
    </main>
  )
}
