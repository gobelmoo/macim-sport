import {
  Activity,
  CalendarDays,
  Home,
  BarChart3,
  Building2,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Permission } from '@/lib/rbac'

export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  // แสดงถ้า user มี permission ใด permission หนึ่งใน anyOf (OR logic)
  anyOf?: Permission[]
}

export interface NavGroup {
  label?: string
  items: NavItem[]
}

export const NAV: NavGroup[] = [
  {
    items: [
      { title: 'แดชบอร์ด', href: '/dashboard', icon: Home },
    ],
  },
  {
    label: 'จัดการ',
    items: [
      {
        title: 'Sponsor',
        href: '/dashboard/sponsors',
        icon: Building2,
        anyOf: ['sponsor:view'],
      },
      {
        title: 'Event',
        href: '/dashboard/events',
        icon: CalendarDays,
        anyOf: ['event:view', 'event:view_own'],
      },
{
        title: 'นักกีฬา',
        href: '/dashboard/athletes',
        icon: Activity,
        anyOf: ['athlete:view', 'athlete:view_own'],
      },
    ],
  },
  {
    label: 'ระบบ',
    items: [
      {
        title: 'ผู้ใช้งาน',
        href: '/dashboard/users',
        icon: Users,
        anyOf: ['user:manage', 'user:manage_staff'],
      },
      {
        title: 'รายงาน',
        href: '/dashboard/reports',
        icon: BarChart3,
        anyOf: ['report:view', 'report:view_own'],
      },
    ],
  },
]

export function filterNav(
  groups: NavGroup[],
  authz: { permissions: readonly string[] },
): NavGroup[] {
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        if (!item.anyOf) return true
        return item.anyOf.some((p) => authz.permissions.includes(p))
      }),
    }))
    .filter((g) => g.items.length > 0)
}
