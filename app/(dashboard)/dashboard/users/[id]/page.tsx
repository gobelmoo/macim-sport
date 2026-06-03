import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Pencil } from 'lucide-react'
import { auth } from '@/auth'
import { getUser } from '@/db/queries/users'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { EditUserForm } from './edit-user-form'
import { ToggleUserStatusButton } from './toggle-user-status-button'
import { canManageUsers } from '@/lib/rbac'
import { RoleBadge, StatusBadge } from '../_components/user-badges'
import { initials } from '@/lib/utils'

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

  if (role === 'sponsor_admin' && user.sponsorId !== sponsorId) {
    redirect('/dashboard/users')
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
        <Pencil className="size-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">แก้ไขผู้ใช้</h1>
      </div>

      <div className="max-w-lg space-y-4">
        {/* Profile Header Card */}
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <Avatar className="size-14">
              <AvatarFallback className="text-lg font-medium">
                {initials(null, user.email)}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1.5">
              <p className="font-semibold">{user.email}</p>
              <div className="flex flex-wrap gap-2">
                <RoleBadge role={user.role} />
                <StatusBadge status={user.status} />
                {user.sponsorName && (
                  <Badge variant="outline">{user.sponsorName}</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit form card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Pencil className="size-4" />
              แก้ไขข้อมูล
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EditUserForm
              userId={user.userId}
              defaultValues={{
                email: user.email,
                phoneNumber: user.phoneNumber ?? '',
              }}
            />
          </CardContent>
        </Card>

        {/* Toggle status card */}
        <ToggleUserStatusButton
          userId={user.userId}
          currentStatus={user.status}
        />
      </div>
    </main>
  )
}
