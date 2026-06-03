import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { listSponsors } from '@/db/queries/sponsors'
import type { UserRole } from '@/lib/rbac'
import { NewUserForm } from './new-user-form'
import type { SponsorRow } from '@/db/queries/sponsors'

export default async function NewUserPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const { role, permissions, sponsorId } = session.user

  const canCreate =
    permissions.includes('user:manage') ||
    permissions.includes('user:manage_staff')

  if (!canCreate) redirect('/users')

  // Sponsors list needed for owner/manager
  let sponsors: Pick<SponsorRow, 'sponsorId' | 'sponsorName'>[] = []
  if (permissions.includes('user:manage')) {
    const all = await listSponsors()
    sponsors = all.map((s) => ({ sponsorId: s.sponsorId, sponsorName: s.sponsorName }))
  }

  return (
    <main className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">สร้างผู้ใช้ใหม่</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          กรอกข้อมูลสำหรับผู้ใช้ใหม่
        </p>
      </div>

      <div className="max-w-lg">
        <NewUserForm
          creatorRole={role as UserRole}
          creatorSponsorId={sponsorId}
          sponsors={sponsors}
        />
      </div>
    </main>
  )
}
