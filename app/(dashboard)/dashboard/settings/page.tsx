import { redirect } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS } from '@/lib/rbac'
import { getLineSettings } from '@/db/queries/line'
import { LineSettingsForm } from './_components/line-settings-form'
import { updateLineSettingsAction } from './actions'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const authz = { role: session.user.role, permissions: session.user.permissions }
  if (!canAccess(PERMISSIONS.USER_MANAGE, authz)) {
    redirect('/dashboard')
  }

  const settings = await getLineSettings()

  return (
    <main className="p-6 lg:p-8">
      <div className="mb-6 flex items-center gap-3">
        <MessageSquare className="size-5 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-semibold">ตั้งค่า LINE</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            ข้อความตอบกลับอัตโนมัติเมื่อไม่เข้าเงื่อนไข
          </p>
        </div>
      </div>

      <LineSettingsForm action={updateLineSettingsAction} settings={settings} />
    </main>
  )
}
