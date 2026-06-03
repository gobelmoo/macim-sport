import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { ROLES } from '@/lib/rbac'
import { listSponsors } from '@/db/queries/sponsors'
import { createEventAction } from '../actions'
import { EventForm } from './event-form'

export default async function NewEventPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const { role } = session.user
  if (role !== ROLES.SUPER_ADMIN_OWNER && role !== ROLES.SUPER_ADMIN_MANAGER) {
    redirect('/events')
  }

  const sponsorList = await listSponsors()

  return (
    <main className="p-6 lg:p-8">
      <h1 className="text-2xl font-semibold mb-6">สร้าง Event ใหม่</h1>
      <EventForm sponsors={sponsorList} action={createEventAction} />
    </main>
  )
}
