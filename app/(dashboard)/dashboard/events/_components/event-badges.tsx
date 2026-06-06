import {
  FileEdit,
  Eye,
  Radio,
  XCircle,
  Archive,
  Timer,
  Activity,
  Tag,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { eventStatusEnum, eventTypeEnum } from '@/db/schema/events'

type EventStatus = (typeof eventStatusEnum.enumValues)[number]
type EventType = (typeof eventTypeEnum.enumValues)[number]

const STATUS_CONFIG: Record<
  EventStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: LucideIcon; className?: string }
> = {
  draft:     { label: 'ร่าง',               variant: 'outline',     icon: FileEdit },
  published: { label: 'เผยแพร่',             variant: 'secondary',   icon: Eye },
  active:    { label: 'เปิดลงทะเบียน',      variant: 'secondary',   icon: Radio,
               className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  closed:    { label: 'ปิด',                variant: 'destructive', icon: XCircle },
  archived:  { label: 'เก็บถาวร',           variant: 'outline',     icon: Archive },
}

const TYPE_CONFIG: Record<EventType, { label: string; icon: LucideIcon }> = {
  run:       { label: 'วิ่ง',      icon: Timer },
  triathlon: { label: 'ไตรกีฬา',   icon: Activity },
  other:     { label: 'อื่นๆ',     icon: Tag },
}

export function EventStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as EventStatus]
  if (!cfg) return <Badge variant="outline">{status}</Badge>
  const Icon = cfg.icon
  return (
    <Badge variant={cfg.variant} className={cn('gap-1', cfg.className)}>
      <Icon className="size-3" />
      {cfg.label}
    </Badge>
  )
}

export function EventTypeBadge({ eventType }: { eventType: string }) {
  const cfg = TYPE_CONFIG[eventType as EventType]
  if (!cfg) return <Badge variant="outline">{eventType}</Badge>
  const Icon = cfg.icon
  return (
    <Badge variant="outline" className="gap-1">
      <Icon className="size-3" />
      {cfg.label}
    </Badge>
  )
}
