import Link from 'next/link'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { auth } from '@/auth'
import { listUsers } from '@/db/queries/users'
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
import type { UserRole } from '@/lib/rbac'

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin_owner: 'Owner',
  super_admin_manager: 'Manager',
  super_admin_viewer: 'Viewer',
  sponsor_admin: 'Sponsor Admin',
  sponsor_staff: 'Sponsor Staff',
}

const ROLE_VARIANT: Record<
  UserRole,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  super_admin_owner: 'default',
  super_admin_manager: 'default',
  super_admin_viewer: 'secondary',
  sponsor_admin: 'secondary',
  sponsor_staff: 'outline',
}

export default async function UsersPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const { role, sponsorId, permissions } = session.user

  const canCreate =
    permissions.includes('user:manage') ||
    permissions.includes('user:manage_staff')

  // sponsor_admin must always see only their own users; if sponsorId is somehow
  // null, return nothing rather than leaking all users.
  const filterOpts =
    role === 'sponsor_admin'
      ? { sponsorId: sponsorId ?? '__none__' }
      : undefined

  const users = await listUsers(filterOpts)

  return (
    <main className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">จัดการผู้ใช้</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {role === 'sponsor_admin'
              ? 'รายชื่อผู้ใช้ใน Sponsor ของท่าน'
              : 'รายชื่อผู้ใช้ทั้งหมดในระบบ'}
          </p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/users/new">สร้างผู้ใช้</Link>
          </Button>
        )}
      </div>

      {users.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          ยังไม่มีผู้ใช้
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>อีเมล</TableHead>
                <TableHead>บทบาท</TableHead>
                <TableHead>Sponsor</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>วันที่สร้าง</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.userId}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={ROLE_VARIANT[user.role]}>
                      {ROLE_LABELS[user.role]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.sponsorName ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        user.status === 'active' ? 'secondary' : 'destructive'
                      }
                    >
                      {user.status === 'active' ? 'ใช้งาน' : 'ปิดใช้งาน'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(user.createdAt, 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/users/${user.userId}`}>แก้ไข</Link>
                    </Button>
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
