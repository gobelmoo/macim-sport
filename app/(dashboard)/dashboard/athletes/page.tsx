import Link from 'next/link'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS } from '@/lib/rbac'
import { listAthletesWithCheckinCounts } from '@/db/queries/athletes'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const GENDER_LABEL: Record<string, string> = {
  male: 'ชาย',
  female: 'หญิง',
  other: 'อื่นๆ',
}

const GENDER_VARIANT: Record<
  string,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  male: 'default',
  female: 'secondary',
  other: 'outline',
}

export default async function AthletesPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const { role, sponsorId, permissions } = session.user
  const authz = { role, permissions }

  const canViewAll = canAccess(PERMISSIONS.ATHLETE_VIEW, authz)
  const canViewOwn = canAccess(PERMISSIONS.ATHLETE_VIEW_OWN, authz)

  if (!canViewAll && !canViewOwn) {
    redirect('/dashboard')
  }

  const scopedSponsorId = canViewAll ? undefined : (sponsorId ?? undefined)
  const athleteList = await listAthletesWithCheckinCounts({
    sponsorId: scopedSponsorId,
  })

  return (
    <main className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">นักกีฬา</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {canViewAll
            ? `นักกีฬาทั้งหมด ${athleteList.length.toLocaleString()} คน`
            : `นักกีฬาที่ลงทะเบียน Event ของ Sponsor ท่าน ${athleteList.length.toLocaleString()} คน`}
        </p>
      </div>

      {athleteList.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          ยังไม่มีข้อมูลนักกีฬา
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อ-นามสกุล</TableHead>
                <TableHead>เพศ</TableHead>
                <TableHead>วันเกิด</TableHead>
                <TableHead>LINE</TableHead>
                <TableHead>Event ล่าสุด</TableHead>
                <TableHead className="text-right">Check-in</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {athleteList.map((athlete) => (
                <TableRow key={athlete.athleteId}>
                  <TableCell className="font-medium">
                    {athlete.firstName} {athlete.lastName}
                  </TableCell>
                  <TableCell>
                    <Badge variant={GENDER_VARIANT[athlete.gender] ?? 'outline'}>
                      {GENDER_LABEL[athlete.gender] ?? athlete.gender}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(athlete.dateOfBirth), 'dd MMM yyyy')}
                  </TableCell>
                  <TableCell>
                    {athlete.lineUserId !== null ? (
                      <span
                        title={athlete.lineUserId}
                        className="inline-flex items-center gap-1 text-green-600 dark:text-green-400"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="h-4 w-4"
                          aria-label="LINE"
                        >
                          <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                        </svg>
                        เชื่อมแล้ว
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {athlete.latestEventId ? (
                      <Link
                        href={`/dashboard/events/${athlete.latestEventId}`}
                        className="hover:underline text-foreground"
                      >
                        {athlete.latestEventName}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {athlete.checkinCount.toLocaleString()}
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
