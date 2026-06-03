import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Building2, Plus } from 'lucide-react'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS } from '@/lib/rbac'
import { listSponsors } from '@/db/queries/sponsors'
import { Button } from '@/components/ui/button'
import { SponsorsTable } from './_components/sponsors-table'

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
        <div className="flex items-center gap-3">
          <Building2 className="size-5 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold">Sponsors</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              รายชื่อ Sponsor ทั้งหมดในระบบ
            </p>
          </div>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/dashboard/sponsors/new">
              <Plus className="size-4" />
              สร้าง Sponsor
            </Link>
          </Button>
        )}
      </div>

      <SponsorsTable sponsors={sponsorList} />
    </main>
  )
}
