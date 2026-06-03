import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS } from '@/lib/rbac'
import { formatThaiDate } from '@/lib/utils'
import { listSponsors } from '@/db/queries/sponsors'
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

const SERVICE_TYPE_LABEL: Record<string, string> = {
  physical_and_digital: 'กายภาพ + ดิจิทัล',
  digital_only: 'ดิจิทัลเท่านั้น',
}

const STATUS_LABEL: Record<string, string> = {
  active: 'ใช้งาน',
  hidden: 'ซ่อน',
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  active: 'default',
  hidden: 'outline',
}


export default async function SponsorsPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const authz = { role: session.user.role, permissions: session.user.permissions }

  if (!canAccess(PERMISSIONS.SPONSOR_VIEW, authz)) {
    redirect('/dashboard')
  }

  const sponsorList = await listSponsors()
  const canCreate = canAccess(PERMISSIONS.SPONSOR_CREATE, authz)

  return (
    <main className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sponsors</h1>
        {canCreate && (
          <Button asChild>
            <Link href="/dashboard/sponsors/new">สร้าง Sponsor</Link>
          </Button>
        )}
      </div>

      {sponsorList.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          ยังไม่มี Sponsor — กด &ldquo;สร้าง Sponsor&rdquo; เพื่อเริ่มต้น
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อ Sponsor</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead>บริการ</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>อีเมลติดต่อ</TableHead>
                <TableHead>วันที่สร้าง</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sponsorList.map((sponsor) => (
                <TableRow key={sponsor.sponsorId}>
                  <TableCell>
                    <Link
                      href={`/dashboard/sponsors/${sponsor.sponsorId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {sponsor.sponsorName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {sponsor.isInternal && (
                      <Badge variant="secondary">Internal</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {SERVICE_TYPE_LABEL[sponsor.serviceType] ?? sponsor.serviceType}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[sponsor.status] ?? 'outline'}>
                      {STATUS_LABEL[sponsor.status] ?? sponsor.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {sponsor.contactEmail}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatThaiDate(sponsor.createdAt)}
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
