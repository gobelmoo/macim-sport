import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { ROLES } from '@/lib/rbac'
import { getEvent } from '@/db/queries/events'
import { listSponsors } from '@/db/queries/sponsors'
import { updateEventAction } from '../actions'
import { EventEditForm } from '../event-edit-form'
import { Button } from '@/components/ui/button'

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
