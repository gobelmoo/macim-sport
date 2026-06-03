import type { userRoleEnum } from '@/db/schema/users'

export type UserRole = (typeof userRoleEnum.enumValues)[number]

export const ROLES = {
  SUPER_ADMIN_OWNER: 'super_admin_owner',
  SUPER_ADMIN_MANAGER: 'super_admin_manager',
  SUPER_ADMIN_VIEWER: 'super_admin_viewer',
  SPONSOR_ADMIN: 'sponsor_admin',
  SPONSOR_STAFF: 'sponsor_staff',
} as const satisfies Record<string, UserRole>

export const PERMISSIONS = {
  // Sponsor
  SPONSOR_VIEW: 'sponsor:view',
  SPONSOR_CREATE: 'sponsor:create',
  SPONSOR_EDIT: 'sponsor:edit',
  // Event
  EVENT_VIEW: 'event:view',
  EVENT_VIEW_OWN: 'event:view_own',
  EVENT_CREATE: 'event:create',
  EVENT_EDIT: 'event:edit',
  // Station
  STATION_MANAGE: 'station:manage',
  // Import
  IMPORT_MANAGE: 'import:manage',
  // User
  USER_MANAGE: 'user:manage',
  USER_MANAGE_STAFF: 'user:manage_staff',
  // Athlete
  ATHLETE_VIEW: 'athlete:view',
  ATHLETE_VIEW_OWN: 'athlete:view_own',
  // Report
  REPORT_VIEW: 'report:view',
  REPORT_VIEW_OWN: 'report:view_own',
  // Check-in
  CHECKIN_CREATE: 'checkin:create',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

const MACIM_MANAGER_PERMS: Permission[] = [
  PERMISSIONS.SPONSOR_VIEW,
  PERMISSIONS.SPONSOR_CREATE,
  PERMISSIONS.SPONSOR_EDIT,
  PERMISSIONS.EVENT_VIEW,
  PERMISSIONS.EVENT_CREATE,
  PERMISSIONS.EVENT_EDIT,
  PERMISSIONS.STATION_MANAGE,
  PERMISSIONS.IMPORT_MANAGE,
  PERMISSIONS.USER_MANAGE,
  PERMISSIONS.ATHLETE_VIEW,
  PERMISSIONS.REPORT_VIEW,
  PERMISSIONS.CHECKIN_CREATE,
]

export const ROLE_PERMISSIONS: Record<UserRole, Permission[] | '*'> = {
  super_admin_owner: '*',
  super_admin_manager: MACIM_MANAGER_PERMS,
  super_admin_viewer: [PERMISSIONS.REPORT_VIEW],
  sponsor_admin: [
    PERMISSIONS.EVENT_VIEW_OWN,
    PERMISSIONS.ATHLETE_VIEW_OWN,
    PERMISSIONS.REPORT_VIEW_OWN,
    PERMISSIONS.USER_MANAGE_STAFF,
  ],
  sponsor_staff: [PERMISSIONS.CHECKIN_CREATE],
}

export function getPermissionsForRole(role: UserRole): Permission[] {
  const perms = ROLE_PERMISSIONS[role]
  if (perms === '*') return Object.values(PERMISSIONS) as Permission[]
  return perms
}

export function isMacimAdmin(role: UserRole): boolean {
  return (
    role === 'super_admin_owner' ||
    role === 'super_admin_manager' ||
    role === 'super_admin_viewer'
  )
}

export function canAccess(
  required: Permission | undefined,
  authz: { role: UserRole; permissions: readonly string[] },
): boolean {
  if (!required) return true
  if (authz.role === 'super_admin_owner') return true
  return authz.permissions.includes(required)
}
