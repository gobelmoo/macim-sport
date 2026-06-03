import { auth } from '@/auth'
import { isMacimAdmin } from '@/lib/rbac'

const ROLE_WELCOME: Record<string, string> = {
  super_admin_owner: 'ยินดีต้อนรับ — Owner',
  super_admin_manager: 'ยินดีต้อนรับ — Manager',
  super_admin_viewer: 'ยินดีต้อนรับ — Viewer',
  sponsor_admin: 'ยินดีต้อนรับ — Sponsor Admin',
}

export default async function DashboardPage() {
  const session = await auth()
  const role = session?.user?.role ?? 'super_admin_viewer'
  const title = ROLE_WELCOME[role] ?? 'ยินดีต้อนรับ'

  return (
    <main className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {isMacimAdmin(role)
            ? 'ภาพรวมระบบ MACIM SPORT'
            : 'ภาพรวม Recovery Zone ของ Sponsor ท่าน'}
        </p>
      </div>

      <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
        Dashboard stats — จะพัฒนาใน Phase 8 (Core Pages)
      </div>
    </main>
  )
}
