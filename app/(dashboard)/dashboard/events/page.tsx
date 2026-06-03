import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS } from '@/lib/rbac'
import { formatThaiDate } from '@/lib/utils'
import { listEvents } from '@/db/queries/events'
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


export default async function EventsPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const { role, sponsorId, permissions } = session.user
  const authz = { role, permissions }

  const canViewAll = canAccess(PERMISSIONS.EVENT_VIEW, authz)
  const canViewOwn = canAccess(PERMISSIONS.EVENT_VIEW_OWN, authz)

  if (!canViewAll && !canViewOwn) {
    redirect('/dashboard')
  }

  const scopedSponsorId = canViewAll ? undefined : (sponsorId ?? undefined)
  const eventList = await listEvents(scopedSponsorId)

  const canCreate = canAccess(PERMISSIONS.EVENT_CREATE, authz)

  return (
    <main className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Events</h1>
        {canCreate && (
          <Button asChild>
            <Link href="/dashboard/events/new">สร้าง Event</Link>
          </Button>
        )}
      </div>

      {eventList.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          ยังไม่มี Event — กด &ldquo;สร้าง Event&rdquo; เพื่อเริ่มต้น
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่องาน</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead>วันที่เริ่ม</TableHead>
                <TableHead>วันที่สิ้นสุด</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>Sponsor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventList.map((event) => (
                <TableRow key={event.eventId}>
                  <TableCell>
                    <Link
                      href={`/dashboard/events/${event.eventId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {event.eventName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {EVENT_TYPE_LABEL[event.eventType] ?? event.eventType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatThaiDate(event.startDate)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatThaiDate(event.endDate)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        EVENT_STATUS_VARIANT[event.status] ?? 'outline'
                      }
                    >
                      {EVENT_STATUS_LABEL[event.status] ?? event.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {event.sponsorName}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  )
}
