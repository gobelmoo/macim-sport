import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Users, UserPlus } from 'lucide-react'
import { auth } from '@/auth'
import { listUsers } from '@/db/queries/users'
import { Button } from '@/components/ui/button'
import { canManageUsers } from '@/lib/rbac'
import { UsersTable } from './_components/users-table'

export default async function UsersPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const { role, sponsorId, permissions } = session.user
  const canCreate = canManageUsers({ role, permissions })

  const filterOpts =
    role === 'sponsor_admin'
      ? { sponsorId: sponsorId ?? '__none__' }
      : undefined

  const users = await listUsers(filterOpts)

  return (
    <main className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="size-5 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold">จัดการผู้ใช้</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {role === 'sponsor_admin'
                ? 'รายชื่อผู้ใช้ใน Sponsor ของท่าน'
                : 'รายชื่อผู้ใช้ทั้งหมดในระบบ'}
            </p>
          </div>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/dashboard/users/new">
              <UserPlus className="size-4" />
              สร้างผู้ใช้
            </Link>
          </Button>
        )}
      </div>

      <UsersTable users={users} />
    </main>
  )
}
