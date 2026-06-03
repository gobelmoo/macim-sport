'use client'

import Link from 'next/link'
import { Dumbbell } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { filterNav, NAV } from '@/lib/nav'
import { NavMain } from './nav-main'
import { NavUser } from './nav-user'
import type { NavUserProps } from './nav-user'

export interface SidebarAuthz {
  permissions: readonly string[]
}

interface Props extends React.ComponentProps<typeof Sidebar> {
  authz: SidebarAuthz
  user: NavUserProps['user']
  signOutAction: NavUserProps['signOutAction']
}

export function AppSidebar({ authz, user, signOutAction, ...props }: Props) {
  const groups = filterNav(NAV, authz)
  return (
    <Sidebar {...props} collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Dumbbell className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">MACIM SPORT</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Recovery Zone Management
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={groups} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} signOutAction={signOutAction} />
      </SidebarFooter>
    </Sidebar>
  )
}
