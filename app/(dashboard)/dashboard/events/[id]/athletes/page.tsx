import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { ChevronLeft, Users } from 'lucide-react'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS, ROLES } from '@/lib/rbac'
import { getEvent } from '@/db/queries/events'
import { listAthletesWithStampsByEvent } from '@/db/queries/athletes'
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

type Props = {
  params: Promise<{ id: string }>
}

export default async function AthletesPage({ params }: Props) {
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

  const canEdit = role === ROLES.SUPER_ADMIN_OWNER || role === ROLES.SUPER_ADMIN_MANAGER

  const athleteList = await listAthletesWithStampsByEvent(id)

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
        <span className="text-sm">นักกีฬา</span>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="size-5 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold">นักกีฬาที่ลงทะเบียน</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {athleteList.length.toLocaleString()} คน
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/events/${id}/import`}>นำเข้าข้อมูล</Link>
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/events/${id}`}>
              <ChevronLeft className="size-4" />
              กลับ
            </Link>
          </Button>
        </div>
      </div>

      {athleteList.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <Users className="mx-auto mb-3 size-12" />
          <p>ยังไม่มีนักกีฬาลงทะเบียน</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">BIB</TableHead>
                <TableHead>ชื่อ-นามสกุล</TableHead>
                <TableHead className="whitespace-nowrap">วันเวลาที่ลงทะเบียน</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>Stamps</TableHead>
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
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {format(a.registeredAt, 'dd MMM yyyy HH:mm', { locale: th })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={a.status === 'active' ? 'default' : 'outline'}>
                      {a.status === 'active' ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {a.stamps.length === 0 ? (
                      <span className="text-muted-foreground text-sm">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {a.stamps.map((s) => (
                          <Badge
                            key={s.stampId}
                            variant="secondary"
                            title={format(s.stampedAt, 'dd MMM yyyy HH:mm', { locale: th })}
                            className="text-xs"
                          >
                            {s.stationName ?? (s.stampSource === 'add_friend' ? 'Add Friend' : 'Check-in')}
                          </Badge>
                        ))}
                      </div>
                    )}
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
