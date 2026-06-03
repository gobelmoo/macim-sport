import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, UserPlus } from 'lucide-react'
import { auth } from '@/auth'
import { listSponsors } from '@/db/queries/sponsors'
import { Button } from '@/components/ui/button'
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

  if (!canCreate) redirect('/dashboard/users')

  let sponsors: Pick<SponsorRow, 'sponsorId' | 'sponsorName'>[] = []
  if (permissions.includes('user:manage')) {
    const all = await listSponsors()
    sponsors = all.map((s) => ({
      sponsorId: s.sponsorId,
      sponsorName: s.sponsorName,
    }))
  }

  return (
    <main className="p-6 lg:p-8">
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
        <Link href="/dashboard/users">
          <ChevronLeft className="size-4" />
          ผู้ใช้งาน
        </Link>
      </Button>

      <div className="mb-6 flex items-center gap-2">
        <UserPlus className="size-5 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-semibold">สร้างผู้ใช้ใหม่</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            กรอกข้อมูลเพื่อเพิ่มผู้ใช้เข้าสู่ระบบ
          </p>
        </div>
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
