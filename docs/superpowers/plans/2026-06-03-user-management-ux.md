# User Management UX/UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ปรับ UX/UI หน้าจัดการผู้ใช้งาน 3 หน้า (list, create, edit) ให้สวยงาม มีไอคอนประกอบ มี search/filter/pagination และ workflow enable/disable ที่สมมาตร

**Architecture:** เพิ่ม `enableUser`/`enableUserAction` สำหรับ enable กลับ, แยก badge components ออกมาเพื่อ reuse ระหว่าง list และ edit, สร้าง `UsersTable` client component ที่ handle search/filter/pagination ทั้งหมด client-side, ปรับ create page เป็น card layout 3 section, ปรับ edit page เพิ่ม profile header card และ toast feedback

**Tech Stack:** Next.js 16 App Router, React 19, shadcn/ui (Card, Badge, Avatar, Table, Select, Button, Input), Tailwind CSS, Lucide icons, date-fns, Drizzle ORM, Sonner (toast)

---

## File Map

| Action | Path | หน้าที่ |
|---|---|---|
| Modify | `db/queries/users.ts` | เพิ่ม `enableUser` query |
| Modify | `app/(dashboard)/dashboard/users/actions.ts` | เพิ่ม `enableUserAction` |
| **Create** | `app/(dashboard)/dashboard/users/_components/user-badges.tsx` | `RoleBadge`, `StatusBadge` — reused ใน list + edit |
| **Create** | `app/(dashboard)/dashboard/users/_components/users-table.tsx` | client table: search, filter, pagination |
| Modify | `app/(dashboard)/dashboard/users/page.tsx` | ใช้ `UsersTable`, ปรับ header + icon |
| Modify | `app/(dashboard)/dashboard/users/new/page.tsx` | back button + new header |
| Modify | `app/(dashboard)/dashboard/users/new/new-user-form.tsx` | card 3 section + input icons + password toggle |
| **Create** | `app/(dashboard)/dashboard/users/[id]/toggle-user-status-button.tsx` | enable/disable สมมาตร |
| Delete | `app/(dashboard)/dashboard/users/[id]/disable-user-button.tsx` | แทนที่ด้วย toggle |
| Modify | `app/(dashboard)/dashboard/users/[id]/edit-user-form.tsx` | input icons + toast feedback |
| Modify | `app/(dashboard)/dashboard/users/[id]/page.tsx` | profile header card + ใช้ `ToggleUserStatusButton` |

---

## Task 1: Add `enableUser` DB query

**Files:**
- Modify: `db/queries/users.ts`

- [ ] **Step 1: เพิ่ม `enableUser` function ต่อท้ายไฟล์**

เปิด `db/queries/users.ts` และเพิ่มฟังก์ชันนี้ต่อจาก `disableUser`:

```ts
export async function enableUser(
  userId: string,
): Promise<{ userId: string }> {
  const [row] = await db
    .update(users)
    .set({ status: 'active' })
    .where(eq(users.userId, userId))
    .returning({ userId: users.userId })

  return row
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add db/queries/users.ts
git commit -m "feat: add enableUser DB query"
```

---

## Task 2: Add `enableUserAction` server action

**Files:**
- Modify: `app/(dashboard)/dashboard/users/actions.ts`

- [ ] **Step 1: เพิ่ม `enableUser` ใน import จาก db/queries/users**

แก้บรรทัด import ใน `actions.ts`:

```ts
import {
  createUser,
  disableUser,
  enableUser,
  getUser,
  updateUser,
} from '@/db/queries/users'
```

- [ ] **Step 2: เพิ่ม `enableUserAction` ต่อท้ายไฟล์ (หลัง `disableUserAction`)**

```ts
// ---------------------------------------------------------------------------
// enableUserAction
// ---------------------------------------------------------------------------

export async function enableUserAction(
  userId: string,
  _prevState: UserActionState,
  _formData?: FormData,
): Promise<UserActionState> {
  const session = await auth()
  if (!session?.user) return { error: 'ไม่ได้เข้าสู่ระบบ' }

  if (!canManageUsers(session.user)) {
    return { error: 'ไม่มีสิทธิ์เปิดใช้งานผู้ใช้' }
  }

  if (session.user.role === 'sponsor_admin') {
    const target = await getUser(userId)
    if (!target) return { error: 'ไม่พบผู้ใช้' }
    if (target.sponsorId !== session.user.sponsorId) {
      return { error: 'ไม่มีสิทธิ์เปิดใช้งานผู้ใช้นี้' }
    }
  }

  await enableUser(userId)

  revalidatePath('/dashboard/users')
  revalidatePath(`/dashboard/users/${userId}`)
  return { success: true }
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: ไม่มี error

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/dashboard/users/actions.ts
git commit -m "feat: add enableUserAction server action"
```

---

## Task 3: Create shared badge components

**Files:**
- Create: `app/(dashboard)/dashboard/users/_components/user-badges.tsx`

- [ ] **Step 1: สร้าง directory และไฟล์**

```bash
mkdir -p "app/(dashboard)/dashboard/users/_components"
```

- [ ] **Step 2: สร้างไฟล์ `user-badges.tsx`**

```tsx
import {
  Crown,
  ShieldCheck,
  Eye,
  Building2,
  User,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ROLE_LABELS, type UserRole } from '@/lib/rbac'

const ROLE_ICON: Record<UserRole, LucideIcon> = {
  super_admin_owner: Crown,
  super_admin_manager: ShieldCheck,
  super_admin_viewer: Eye,
  sponsor_admin: Building2,
  sponsor_staff: User,
}

const ROLE_VARIANT: Record<UserRole, 'default' | 'secondary' | 'outline'> = {
  super_admin_owner: 'default',
  super_admin_manager: 'default',
  super_admin_viewer: 'secondary',
  sponsor_admin: 'secondary',
  sponsor_staff: 'outline',
}

export function RoleBadge({ role }: { role: UserRole }) {
  const Icon = ROLE_ICON[role]
  return (
    <Badge variant={ROLE_VARIANT[role]} className="gap-1">
      <Icon className="size-3" />
      {ROLE_LABELS[role]}
    </Badge>
  )
}

export function StatusBadge({
  status,
}: {
  status: 'active' | 'hidden' | 'inactive'
}) {
  const isActive = status === 'active'
  return (
    <Badge
      variant={isActive ? 'secondary' : 'destructive'}
      className={`gap-1 ${
        isActive
          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
          : ''
      }`}
    >
      {isActive ? (
        <CheckCircle2 className="size-3" />
      ) : (
        <XCircle className="size-3" />
      )}
      {isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
    </Badge>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: ไม่มี error

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/dashboard/users/_components/user-badges.tsx"
git commit -m "feat: add shared RoleBadge and StatusBadge components"
```

---

## Task 4: Create `UsersTable` client component

**Files:**
- Create: `app/(dashboard)/dashboard/users/_components/users-table.tsx`

- [ ] **Step 1: สร้างไฟล์ `users-table.tsx`**

```tsx
'use client'

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import {
  Search,
  X,
  Pencil,
  Users,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { initials } from '@/lib/utils'
import { ROLE_LABELS, type UserRole } from '@/lib/rbac'
import type { UserListItem } from '@/db/queries/users'
import { RoleBadge, StatusBadge } from './user-badges'

const PAGE_SIZE = 20

const ROLE_OPTIONS: { value: UserRole | 'all'; label: string }[] = [
  { value: 'all', label: 'ทุกบทบาท' },
  { value: 'super_admin_owner', label: ROLE_LABELS.super_admin_owner },
  { value: 'super_admin_manager', label: ROLE_LABELS.super_admin_manager },
  { value: 'super_admin_viewer', label: ROLE_LABELS.super_admin_viewer },
  { value: 'sponsor_admin', label: ROLE_LABELS.sponsor_admin },
  { value: 'sponsor_staff', label: ROLE_LABELS.sponsor_staff },
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'ทุกสถานะ' },
  { value: 'active', label: 'ใช้งาน' },
  { value: 'inactive', label: 'ปิดใช้งาน' },
] as const

const ROLE_AVATAR_CLASS: Record<UserRole, string> = {
  super_admin_owner: 'bg-primary text-primary-foreground',
  super_admin_manager: 'bg-primary text-primary-foreground',
  super_admin_viewer: 'bg-secondary text-secondary-foreground',
  sponsor_admin: 'bg-secondary text-secondary-foreground',
  sponsor_staff: 'bg-muted text-muted-foreground',
}

interface Props {
  users: UserListItem[]
}

export function UsersTable({ users }: Props) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [page, setPage] = useState(1)

  const hasFilter =
    search !== '' || roleFilter !== 'all' || statusFilter !== 'all'

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1)
  }, [search, roleFilter, statusFilter])

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (search && !u.email.toLowerCase().includes(search.toLowerCase()))
        return false
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (statusFilter === 'active' && u.status !== 'active') return false
      if (statusFilter === 'inactive' && u.status === 'active') return false
      return true
    })
  }, [users, search, roleFilter, statusFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  )

  const rangeStart = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, filtered.length)

  return (
    <div className="space-y-4">
      {/* Search + Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="ค้นหา email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={roleFilter}
          onValueChange={(v) => setRoleFilter(v as UserRole | 'all')}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('')
              setRoleFilter('all')
              setStatusFilter('all')
            }}
          >
            <X className="size-4" />
            ล้างตัวกรอง
          </Button>
        )}
      </div>

      {/* Table or Empty State */}
      {paginated.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Users className="mx-auto mb-3 size-12 text-muted-foreground" />
          {hasFilter ? (
            <p className="text-muted-foreground">
              ไม่พบผู้ใช้ที่ตรงกับเงื่อนไข
            </p>
          ) : (
            <>
              <p className="font-medium">ยังไม่มีผู้ใช้</p>
              <p className="mt-1 text-sm text-muted-foreground">
                กด &ldquo;สร้างผู้ใช้&rdquo; เพื่อเพิ่มผู้ใช้คนแรก
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>อีเมล</TableHead>
                <TableHead>บทบาท</TableHead>
                <TableHead>Sponsor</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>วันที่สร้าง</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((user) => (
                <TableRow key={user.userId}>
                  <TableCell>
                    <Avatar className="size-8">
                      <AvatarFallback
                        className={`text-xs ${ROLE_AVATAR_CLASS[user.role]}`}
                      >
                        {initials(null, user.email)}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>
                    <RoleBadge role={user.role} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.sponsorName ?? '—'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={user.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(user.createdAt, 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/users/${user.userId}`}>
                        <Pencil className="size-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            แสดง {rangeStart}–{rangeEnd} จาก {filtered.length} รายการ
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="size-4" />
              ก่อนหน้า
            </Button>
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              ถัดไป
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/dashboard/users/_components/users-table.tsx"
git commit -m "feat: add UsersTable client component with search, filter, and pagination"
```

---

## Task 5: Redesign List page

**Files:**
- Modify: `app/(dashboard)/dashboard/users/page.tsx`

- [ ] **Step 1: แทนที่เนื้อหาทั้งหมดในไฟล์**

```tsx
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
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/dashboard/users/page.tsx"
git commit -m "feat: redesign users list page with search, filter, and pagination"
```

---

## Task 6: Redesign Create page

**Files:**
- Modify: `app/(dashboard)/dashboard/users/new/page.tsx`
- Modify: `app/(dashboard)/dashboard/users/new/new-user-form.tsx`

### 6a — page.tsx

- [ ] **Step 1: แทนที่เนื้อหาทั้งหมดใน `new/page.tsx`**

```tsx
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
```

### 6b — new-user-form.tsx

- [ ] **Step 2: แทนที่เนื้อหาทั้งหมดใน `new/new-user-form.tsx`**

```tsx
'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Phone,
  ShieldCheck,
  KeyRound,
  UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createUserAction } from '../actions'
import type { UserRole } from '@/lib/rbac'

type Sponsor = { sponsorId: string; sponsorName: string }

const ROLE_OPTIONS: Record<string, { value: UserRole; label: string }[]> = {
  super_admin_owner: [
    { value: 'super_admin_owner', label: 'Owner' },
    { value: 'super_admin_manager', label: 'Manager' },
    { value: 'super_admin_viewer', label: 'Viewer' },
    { value: 'sponsor_admin', label: 'Sponsor Admin' },
    { value: 'sponsor_staff', label: 'Sponsor Staff' },
  ],
  super_admin_manager: [
    { value: 'super_admin_viewer', label: 'Viewer' },
    { value: 'sponsor_admin', label: 'Sponsor Admin' },
    { value: 'sponsor_staff', label: 'Sponsor Staff' },
  ],
  sponsor_admin: [{ value: 'sponsor_staff', label: 'Sponsor Staff' }],
}

const SPONSOR_ROLES: UserRole[] = ['sponsor_admin', 'sponsor_staff']

interface Props {
  creatorRole: UserRole
  creatorSponsorId: string | null
  sponsors: Sponsor[]
}

export function NewUserForm({ creatorRole, creatorSponsorId, sponsors }: Props) {
  const [state, action, isPending] = useActionState(createUserAction, undefined)

  const roleOptions = ROLE_OPTIONS[creatorRole] ?? []
  const defaultRole = roleOptions[0]?.value ?? 'sponsor_staff'
  const [selectedRole, setSelectedRole] = useState<UserRole>(defaultRole)
  const [showPassword, setShowPassword] = useState(false)

  const isSponsorAdmin = creatorRole === 'sponsor_admin'
  const showSponsorSelect =
    !isSponsorAdmin && SPONSOR_ROLES.includes(selectedRole)

  return (
    <form action={action} className="flex flex-col gap-4">
      {/* Card 1 — ข้อมูลบัญชี */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4" />
            ข้อมูลบัญชี
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">อีเมล</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                name="email"
                type="email"
                className="pl-9"
                placeholder="email@example.com"
                required
                autoComplete="off"
                aria-invalid={
                  state && 'fieldErrors' in state && !!state.fieldErrors?.email
                }
              />
            </div>
            {state && 'fieldErrors' in state && state.fieldErrors?.email && (
              <p className="text-sm text-destructive">
                {state.fieldErrors.email[0]}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">รหัสผ่าน</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                className="pl-9 pr-9"
                placeholder="อย่างน้อย 8 ตัวอักษร"
                required
                autoComplete="new-password"
                aria-invalid={
                  state &&
                  'fieldErrors' in state &&
                  !!state.fieldErrors?.password
                }
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            {state && 'fieldErrors' in state && state.fieldErrors?.password && (
              <p className="text-sm text-destructive">
                {state.fieldErrors.password[0]}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Card 2 — ข้อมูลติดต่อ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Phone className="size-4" />
            ข้อมูลติดต่อ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <Label htmlFor="phoneNumber">เบอร์โทรศัพท์ (ไม่บังคับ)</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="phoneNumber"
                name="phoneNumber"
                type="text"
                className="pl-9"
                placeholder="0812345678"
                autoComplete="off"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 3 — สิทธิ์การใช้งาน */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4" />
            สิทธิ์การใช้งาน
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="role">บทบาท</Label>
            {isSponsorAdmin ? (
              <>
                <Input
                  id="role"
                  type="text"
                  value="Sponsor Staff"
                  disabled
                  readOnly
                />
                <input type="hidden" name="role" value="sponsor_staff" />
              </>
            ) : (
              <Select
                name="role"
                defaultValue={defaultRole}
                onValueChange={(v) => setSelectedRole(v as UserRole)}
              >
                <SelectTrigger id="role" className="w-full">
                  <SelectValue placeholder="เลือกบทบาท" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {showSponsorSelect && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="sponsorId">Sponsor</Label>
              <Select name="sponsorId">
                <SelectTrigger id="sponsorId" className="w-full">
                  <SelectValue placeholder="เลือก Sponsor" />
                </SelectTrigger>
                <SelectContent>
                  {sponsors.map((s) => (
                    <SelectItem key={s.sponsorId} value={s.sponsorId}>
                      {s.sponsorName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {state &&
                'fieldErrors' in state &&
                state.fieldErrors?.sponsorId && (
                  <p className="text-sm text-destructive">
                    {state.fieldErrors.sponsorId[0]}
                  </p>
                )}
            </div>
          )}
        </CardContent>
      </Card>

      {state && 'error' in state && !state.fieldErrors && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          <UserPlus className="size-4" />
          {isPending ? 'กำลังสร้าง...' : 'สร้างผู้ใช้'}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard/users">ยกเลิก</Link>
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: ไม่มี error

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/dashboard/users/new/page.tsx" "app/(dashboard)/dashboard/users/new/new-user-form.tsx"
git commit -m "feat: redesign create user page with card sections and password toggle"
```

---

## Task 7: Create `ToggleUserStatusButton`

**Files:**
- Create: `app/(dashboard)/dashboard/users/[id]/toggle-user-status-button.tsx`

> หมายเหตุ: ยังไม่ลบ `disable-user-button.tsx` ในขั้นตอนนี้ — จะลบพร้อมกับอัพเดต page.tsx ใน Task 9

- [ ] **Step 1: สร้างไฟล์ `toggle-user-status-button.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import { CheckCircle2, ShieldAlert, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { disableUserAction, enableUserAction } from '../actions'

interface Props {
  userId: string
  currentStatus: 'active' | 'hidden' | 'inactive'
}

export function ToggleUserStatusButton({ userId, currentStatus }: Props) {
  const isActive = currentStatus === 'active'

  const boundDisable = disableUserAction.bind(null, userId)
  const boundEnable = enableUserAction.bind(null, userId)

  const [disableState, disableAction, isDisablePending] = useActionState(
    boundDisable,
    undefined,
  )
  const [enableState, enableAction, isEnablePending] = useActionState(
    boundEnable,
    undefined,
  )

  const error =
    (disableState && 'error' in disableState && disableState.error) ||
    (enableState && 'error' in enableState && enableState.error)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="size-4" />
          สถานะบัญชี
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <div>
            {isActive ? (
              <>
                <div className="flex items-center gap-2 font-medium">
                  <XCircle className="size-4 text-destructive" />
                  ปิดใช้งานบัญชี
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  ผู้ใช้จะไม่สามารถเข้าสู่ระบบได้
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="size-4 text-green-600" />
                  เปิดใช้งานบัญชี
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  ผู้ใช้จะสามารถเข้าสู่ระบบได้อีกครั้ง
                </p>
              </>
            )}
          </div>
          {isActive ? (
            <form action={disableAction}>
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                disabled={isDisablePending}
              >
                {isDisablePending ? 'กำลังปิด...' : 'ปิดใช้งาน'}
              </Button>
            </form>
          ) : (
            <form action={enableAction}>
              <Button
                type="submit"
                variant="default"
                size="sm"
                disabled={isEnablePending}
              >
                {isEnablePending ? 'กำลังเปิด...' : 'เปิดใช้งาน'}
              </Button>
            </form>
          )}
        </div>
        {error && (
          <p className="mt-3 text-sm text-destructive">{error}</p>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/dashboard/users/[id]/toggle-user-status-button.tsx"
git commit -m "feat: add ToggleUserStatusButton supporting both enable and disable"
```

---

## Task 8: Update `EditUserForm` with icons and toast feedback

**Files:**
- Modify: `app/(dashboard)/dashboard/users/[id]/edit-user-form.tsx`

- [ ] **Step 1: แทนที่เนื้อหาทั้งหมดใน `edit-user-form.tsx`**

```tsx
'use client'

import { useActionState, useEffect } from 'react'
import Link from 'next/link'
import { Mail, Phone, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateUserAction } from '../actions'

interface Props {
  userId: string
  defaultValues: {
    email: string
    phoneNumber: string
  }
}

export function EditUserForm({ userId, defaultValues }: Props) {
  const boundAction = updateUserAction.bind(null, userId)
  const [state, action, isPending] = useActionState(boundAction, undefined)

  useEffect(() => {
    if (!state) return
    if ('success' in state && state.success) {
      toast.success('บันทึกสำเร็จ')
    } else if ('error' in state && !state.fieldErrors?.email) {
      toast.error(state.error)
    }
  }, [state])

  return (
    <form action={action} className="flex flex-col gap-5">
      {/* Email */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">อีเมล</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            name="email"
            type="email"
            className="pl-9"
            defaultValue={defaultValues.email}
            required
            autoComplete="off"
            aria-invalid={
              state && 'fieldErrors' in state && !!state.fieldErrors?.email
            }
          />
        </div>
        {state && 'fieldErrors' in state && state.fieldErrors?.email && (
          <p className="text-sm text-destructive">
            {state.fieldErrors.email[0]}
          </p>
        )}
      </div>

      {/* Phone */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="phoneNumber">เบอร์โทรศัพท์ (ไม่บังคับ)</Label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="phoneNumber"
            name="phoneNumber"
            type="text"
            className="pl-9"
            defaultValue={defaultValues.phoneNumber}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          <Save className="size-4" />
          {isPending ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard/users">ยกเลิก</Link>
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/dashboard/users/[id]/edit-user-form.tsx"
git commit -m "feat: update EditUserForm with input icons and toast feedback"
```

---

## Task 9: Redesign Edit page and remove old `DisableUserButton`

**Files:**
- Modify: `app/(dashboard)/dashboard/users/[id]/page.tsx`
- Delete: `app/(dashboard)/dashboard/users/[id]/disable-user-button.tsx`

- [ ] **Step 1: แทนที่เนื้อหาทั้งหมดใน `[id]/page.tsx`**

```tsx
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
```

- [ ] **Step 2: ลบ `disable-user-button.tsx`** (ถูกแทนที่โดย `ToggleUserStatusButton` แล้ว)

```bash
git rm "app/(dashboard)/dashboard/users/[id]/disable-user-button.tsx"
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: ไม่มี error

- [ ] **Step 4: Manual verification**

```bash
pnpm dev
```

เปิด `http://localhost:3000/dashboard/users` และตรวจสอบ:
- [ ] หน้า list แสดง Avatar + RoleBadge + StatusBadge ถูกต้อง
- [ ] Search box กรอง email ได้
- [ ] Role dropdown กรองตาม role ได้
- [ ] Status dropdown กรองตาม สถานะ ได้
- [ ] ปุ่ม "ล้างตัวกรอง" ปรากฏเมื่อ filter active และล้างได้
- [ ] Pagination แสดงเมื่อมี > 20 รายการ

เปิด `http://localhost:3000/dashboard/users/new`:
- [ ] มีปุ่ม "← ผู้ใช้งาน" กลับหน้า list ได้
- [ ] Form แบ่งเป็น 3 card (ข้อมูลบัญชี / ข้อมูลติดต่อ / สิทธิ์การใช้งาน)
- [ ] icon ใน input fields แสดงถูกต้อง
- [ ] ปุ่ม eye toggle ในช่องรหัสผ่านทำงาน

เปิด `http://localhost:3000/dashboard/users/{id}`:
- [ ] Profile header card แสดง avatar, email, role badge, status badge
- [ ] บันทึกสำเร็จแสดง toast แทน inline text
- [ ] ปุ่ม enable/disable สมมาตรตาม status ปัจจุบัน

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/dashboard/users/[id]/page.tsx"
git commit -m "feat: redesign edit user page with profile header card and toggle status"
```
