import { Building2, CheckCircle2, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const SERVICE_TYPE_LABEL: Record<string, string> = {
  physical_and_digital: 'กายภาพ + ดิจิทัล',
  digital_only: 'ดิจิทัลเท่านั้น',
}

export function SponsorStatusBadge({ status }: { status: string }) {
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

export function SponsorTypeBadge({ serviceType }: { serviceType: string }) {
  return (
    <Badge variant="outline">
      {SERVICE_TYPE_LABEL[serviceType] ?? serviceType}
    </Badge>
  )
}

export function InternalBadge() {
  return (
    <Badge variant="secondary" className="gap-1">
      <Building2 className="size-3" />
      Internal
    </Badge>
  )
}
