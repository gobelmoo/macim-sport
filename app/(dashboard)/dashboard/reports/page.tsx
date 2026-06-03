import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS } from '@/lib/rbac'
import {
  getCheckinStats,
  getCheckinsByEvent,
  getRecentCheckins,
} from '@/db/queries/reports'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default async function ReportsPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const { role, sponsorId, permissions } = session.user
  const authz = { role, permissions }

  const canViewAll = canAccess(PERMISSIONS.REPORT_VIEW, authz)
  const canViewOwn = canAccess(PERMISSIONS.REPORT_VIEW_OWN, authz)

  if (!canViewAll && !canViewOwn) {
    redirect('/dashboard')
  }

  const scopedSponsorId = canViewAll ? undefined : (sponsorId ?? undefined)

  const [stats, byEvent, recentCheckins] = await Promise.all([
    getCheckinStats({ sponsorId: scopedSponsorId }),
    getCheckinsByEvent({ sponsorId: scopedSponsorId }),
    getRecentCheckins({ sponsorId: scopedSponsorId, limit: 20 }),
  ])

  return (
    <main className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">รายงาน</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {canViewAll ? 'ภาพรวมทั้งระบบ' : 'ภาพรวม Recovery Zone ของ Sponsor ท่าน'}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Check-in ทั้งหมด
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.totalCheckins.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              นักกีฬาทั้งหมด
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.totalAthletes.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Stamp ทั้งหมด
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.totalStamps.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              นักกีฬาใหม่ (30 วัน)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.newAthletes.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Check-ins by event */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Check-in แยกตาม Event</h2>
        {byEvent.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            ยังไม่มีข้อมูล Check-in
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่องาน</TableHead>
                  <TableHead className="text-right">จำนวน Check-in</TableHead>
                  <TableHead className="text-right">จำนวน Stamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byEvent.map((row) => (
                  <TableRow key={row.eventName}>
                    <TableCell className="font-medium">{row.eventName}</TableCell>
                    <TableCell className="text-right">
                      {row.checkinCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.stampCount.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Recent check-ins */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Check-in ล่าสุด</h2>
        {recentCheckins.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            ยังไม่มีข้อมูล Check-in
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>นักกีฬา</TableHead>
                  <TableHead>BIB</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead>เวลา</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentCheckins.map((row) => (
                  <TableRow key={row.checkinId}>
                    <TableCell className="font-medium">
                      {row.athleteFirstName} {row.athleteLastName}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono">
                      {row.bibNumber}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.eventName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.stationName}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {format(row.checkedInAt, 'dd MMM yyyy HH:mm')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </main>
  )
}
