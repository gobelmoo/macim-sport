import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS } from '@/lib/rbac'
import { getEvent } from '@/db/queries/events'

// TODO (POST-MVP): Implement actual CSV/Excel parsing and athlete import logic.
// Required columns: ชื่อ (firstName), นามสกุล (lastName), BIB Number (bibNumber)
// Suggested libraries: papaparse (CSV), xlsx / exceljs (Excel)
// Flow: upload → validate columns → preview rows → confirm → insert into athlete_event_registrations

type Props = {
  params: Promise<{ id: string }>
}

export default async function ImportPage({ params }: Props) {
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

  if (canViewOwn && !canViewAll && event.sponsorId !== userSponsorId) {
    notFound()
  }

  return (
    <main className="p-6 lg:p-8">
      {/* Breadcrumb */}
      <div className="mb-2 flex items-center gap-2">
        <Link
          href={`/events/${id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          {event.eventName}
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm">นำเข้าข้อมูลนักกีฬา</span>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">นำเข้าข้อมูลนักกีฬา</h1>
        <Link
          href={`/events/${id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          กลับไป Event
        </Link>
      </div>

      {/* Upload UI placeholder */}
      <div className="max-w-xl space-y-6">
        <div className="rounded-lg border p-6 space-y-4">
          <div>
            <h2 className="font-medium mb-1">รูปแบบไฟล์ที่รองรับ</h2>
            <p className="text-sm text-muted-foreground">
              CSV (.csv) หรือ Excel (.xlsx, .xls)
            </p>
          </div>

          <div>
            <h2 className="font-medium mb-2">คอลัมน์ที่ต้องมีในไฟล์</h2>
            <ul className="text-sm space-y-1 text-muted-foreground list-disc list-inside">
              <li>
                <span className="font-mono text-foreground">ชื่อ</span> — ชื่อจริงของนักกีฬา
              </li>
              <li>
                <span className="font-mono text-foreground">นามสกุล</span> — นามสกุลของนักกีฬา
              </li>
              <li>
                <span className="font-mono text-foreground">BIB Number</span> — หมายเลขบิบของนักกีฬา
              </li>
            </ul>
          </div>

          <div>
            <label
              htmlFor="file-upload"
              className="block text-sm font-medium mb-1.5"
            >
              อัปโหลดไฟล์รายชื่อนักกีฬา (CSV หรือ Excel)
            </label>
            <input
              id="file-upload"
              name="file"
              type="file"
              accept=".csv,.xlsx,.xls"
              disabled
              className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div className="rounded-md bg-muted px-4 py-3">
            <p className="text-sm text-muted-foreground">
              ฟีเจอร์นำเข้าข้อมูลนักกีฬาจะพัฒนาใน Phase ถัดไป (POST-MVP)
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
