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
