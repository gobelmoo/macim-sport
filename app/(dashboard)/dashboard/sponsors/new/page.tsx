import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS } from '@/lib/rbac'
import { createSponsorAction } from '../actions'
import { SponsorForm } from '../_components/sponsor-form'

export default async function NewSponsorPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const authz = { role: session.user.role, permissions: session.user.permissions }

  if (!canAccess(PERMISSIONS.SPONSOR_CREATE, authz)) {
    redirect('/dashboard/sponsors')
  }

  return (
    <main className="p-6 lg:p-8">
      <h1 className="text-2xl font-semibold mb-6">สร้าง Sponsor ใหม่</h1>
      <SponsorForm action={createSponsorAction} submitLabel="สร้าง Sponsor" />
    </main>
  )
}
