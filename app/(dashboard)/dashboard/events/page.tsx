import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Calendar, Plus } from 'lucide-react'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS } from '@/lib/rbac'
import { listEventsWithCounts } from '@/db/queries/events'
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
  const eventList = await listEventsWithCounts(scopedSponsorId)
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
