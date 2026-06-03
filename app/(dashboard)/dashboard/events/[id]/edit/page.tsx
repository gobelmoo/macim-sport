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
