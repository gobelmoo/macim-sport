import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getUser } from '@/db/queries/users'
import { Badge } from '@/components/ui/badge'
import { EditUserForm } from './edit-user-form'
import { DisableUserButton } from './disable-user-button'
import { canManageUsers, ROLE_LABELS } from '@/lib/rbac'

interface Props {
  params: Promise<{ id: string }>
}

export default async function UserDetailPage({ params }: Props) {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const { role, sponsorId, permissions } = session.user

  if (!canManageUsers({ role, permissions })) redirect('/dashboard/users')

  const { id } = await params
  const user = await getUser(id)
  if (!user) notFound()

  // sponsor_admin scope check
  if (role === 'sponsor_admin' && user.sponsorId !== sponsorId) {
    redirect('/dashboard/users')
  }

  return (
    <main className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">แก้ไขผู้ใช้</h1>
        <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
      </div>

      <div className="max-w-lg space-y-6">
        {/* Status + Role badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant={user.status === 'active' ? 'secondary' : 'destructive'}>
            {user.status === 'active' ? 'ใช้งาน' : 'ปิดใช้งาน'}
          </Badge>
          <Badge variant="outline">{ROLE_LABELS[user.role]}</Badge>
          {user.sponsorName && (
            <Badge variant="outline">{user.sponsorName}</Badge>
          )}
        </div>

        {/* Edit form */}
        <EditUserForm
          userId={user.userId}
          defaultValues={{ email: user.email, phoneNumber: user.phoneNumber ?? '' }}
        />

        {/* Disable button — only if currently active */}
        {user.status === 'active' && (
          <DisableUserButton userId={user.userId} />
        )}
      </div>
    </main>
  )
}
