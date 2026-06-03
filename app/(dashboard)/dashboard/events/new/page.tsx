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
