'use client'

import { useMemo, useState } from 'react'
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

  const filtered = useMemo(() => {
    const lowerSearch = search.toLowerCase()
    return users.filter((u) => {
      if (search && !u.email.toLowerCase().includes(lowerSearch)) return false
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (statusFilter !== 'all' && u.status !== statusFilter) return false
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
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <Select
          value={roleFilter}
          onValueChange={(v) => { setRoleFilter(v as UserRole | 'all'); setPage(1) }}
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
          onValueChange={(v) => { setStatusFilter(v as typeof statusFilter); setPage(1) }}
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
      {filtered.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            แสดง {rangeStart}–{rangeEnd} จาก {filtered.length} รายการ
          </p>
          {totalPages > 1 && (
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
          )}
        </div>
      )}
    </div>
  )
}
