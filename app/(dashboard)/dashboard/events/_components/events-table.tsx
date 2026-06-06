'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import {
  Search,
  X,
  Pencil,
  Calendar,
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
import type { EventRow } from '@/db/queries/events'
import { EventStatusBadge, EventTypeBadge } from './event-badges'

const PAGE_SIZE = 20

const STATUS_OPTIONS = [
  { value: 'all', label: 'ทุกสถานะ' },
  { value: 'draft', label: 'แบบร่าง' },
  { value: 'published', label: 'เผยแพร่' },
  { value: 'active', label: 'กำลังจัดงาน' },
  { value: 'closed', label: 'ปิดแล้ว' },
] as const

const TYPE_OPTIONS = [
  { value: 'all', label: 'ทุกประเภท' },
  { value: 'run', label: 'วิ่ง' },
  { value: 'triathlon', label: 'ไตรกีฬา' },
  { value: 'other', label: 'อื่นๆ' },
] as const

interface Props {
  events: EventRow[]
  canCreate: boolean
}

export function EventsTable({ events, canCreate }: Props) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published' | 'active' | 'closed'>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'run' | 'triathlon' | 'other'>('all')
  const [page, setPage] = useState(1)

  const hasFilter = search !== '' || statusFilter !== 'all' || typeFilter !== 'all'

  const filtered = useMemo(() => {
    const lower = search.toLowerCase()
    return events.filter((e) => {
      if (
        search &&
        !e.eventName.toLowerCase().includes(lower) &&
        !e.sponsorName.toLowerCase().includes(lower)
      )
        return false
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      if (typeFilter !== 'all' && e.eventType !== typeFilter) return false
      return true
    })
  }, [events, search, statusFilter, typeFilter])

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
            placeholder="ค้นหาชื่องานหรือ Sponsor..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => { setStatusFilter(v as typeof statusFilter); setPage(1) }}
        >
          <SelectTrigger className="w-[150px]">
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
        <Select
          value={typeFilter}
          onValueChange={(v) => { setTypeFilter(v as typeof typeFilter); setPage(1) }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((o) => (
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
              setTypeFilter('all')
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
          <Calendar className="mx-auto mb-3 size-12 text-muted-foreground" />
          {hasFilter ? (
            <p className="text-muted-foreground">ไม่พบงานกีฬาที่ตรงกับเงื่อนไข</p>
          ) : (
            <>
              <p className="font-medium">ยังไม่มีงานกีฬา</p>
              {canCreate && (
                <p className="mt-1 text-sm text-muted-foreground">
                  กด &ldquo;สร้างงาน&rdquo; เพื่อเพิ่มงานกีฬาแรก
                </p>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>ชื่องาน</TableHead>
                <TableHead>Sponsor</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>วันที่เริ่ม</TableHead>
                <TableHead>วันที่สิ้นสุด</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((event) => (
                <TableRow key={event.eventId}>
                  <TableCell>
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted overflow-hidden">
                      {event.eventLogoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={event.eventLogoUrl} alt="" className="size-8 object-cover" />
                      ) : (
                        <Calendar className="size-4 text-muted-foreground" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{event.eventName}</TableCell>
                  <TableCell className="text-muted-foreground">{event.sponsorName}</TableCell>
                  <TableCell>
                    <EventTypeBadge eventType={event.eventType} />
                  </TableCell>
                  <TableCell>
                    <EventStatusBadge status={event.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(event.startDate), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(event.endDate), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/events/${event.eventId}`}>
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
