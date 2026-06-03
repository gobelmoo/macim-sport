import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { ThemeSwitcher } from '@/components/layout/theme-switcher'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { signOutAction } from './actions'

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  // sponsor_staff ไม่ควรเข้า dashboard — redirect ไปหน้า check-in
  if (session.user.role === 'sponsor_staff') redirect('/checkin')

  const authz = {
    permissions: session.user.permissions,
  }

  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get('sidebar_state')?.value !== 'false'

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar
        authz={authz}
        user={{
          email: session.user.email ?? '',
          role: session.user.role,
        }}
        signOutAction={signOutAction}
      />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur lg:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mx-1 h-4" />
          <div className="ml-auto flex items-center gap-2">
            <ThemeSwitcher />
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
