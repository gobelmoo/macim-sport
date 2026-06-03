'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import {
  Search,
  X,
  Pencil,
  Building2,
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
import type { SponsorRow } from '@/db/queries/sponsors'
import { SponsorStatusBadge, SponsorTypeBadge, InternalBadge } from './sponsor-badges'

const PAGE_SIZE = 20

const STATUS_OPTIONS = [
  { value: 'all', label: 'ทุกสถานะ' },
  { value: 'active', label: 'ใช้งาน' },
  { value: 'inactive', label: 'ปิดใช้งาน' },
] as const

interface Props {
  sponsors: SponsorRow[]
}

export function SponsorsTable({ sponsors }: Props) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [page, setPage] = useState(1)

  const hasFilter = search !== '' || statusFilter !== 'all'

  const filtered = useMemo(() => {
    const lower = search.toLowerCase()
    return sponsors.filter((s) => {
      if (
        search &&
        !s.sponsorName.toLowerCase().includes(lower) &&
        !s.contactEmail.toLowerCase().includes(lower)
      )
        return false
      if (statusFilter !== 'all' && s.status !== statusFilter) return false
      return true
    })
  }, [sponsors, search, statusFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const rangeStart = (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, filtered.length)

  return (
    <div className="space-y-4">
      {/* Search + Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="ค้นหาชื่อหรืออีเมล..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
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
              setStatusFilter('all')
              setPage(1)
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
          <Building2 className="mx-auto mb-3 size-12 text-muted-foreground" />
          {hasFilter ? (
            <p className="text-muted-foreground">ไม่พบ Sponsor ที่ตรงกับเงื่อนไข</p>
          ) : (
            <>
              <p className="font-medium">ยังไม่มี Sponsor</p>
              <p className="mt-1 text-sm text-muted-foreground">
                กด &ldquo;สร้าง Sponsor&rdquo; เพื่อเพิ่ม Sponsor แรก
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
                <TableHead>ชื่อ Sponsor</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead>บริการ</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>อีเมลติดต่อ</TableHead>
                <TableHead>วันที่สร้าง</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((sponsor) => (
                <TableRow key={sponsor.sponsorId}>
                  <TableCell>
                    <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                      <Building2 className="size-4 text-muted-foreground" />
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{sponsor.sponsorName}</TableCell>
                  <TableCell>
                    {sponsor.isInternal && <InternalBadge />}
                  </TableCell>
                  <TableCell>
                    <SponsorTypeBadge serviceType={sponsor.serviceType} />
                  </TableCell>
                  <TableCell>
                    <SponsorStatusBadge status={sponsor.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {sponsor.contactEmail}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(sponsor.createdAt, 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/sponsors/${sponsor.sponsorId}`}>
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
