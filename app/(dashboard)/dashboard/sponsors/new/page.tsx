import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, Plus } from 'lucide-react'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
        <Link href="/dashboard/sponsors">
          <ChevronLeft className="size-4" />
          Sponsors
        </Link>
      </Button>

      <div className="mb-6 flex items-center gap-2">
        <Plus className="size-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">สร้าง Sponsor ใหม่</h1>
      </div>

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="size-4" />
              ข้อมูล Sponsor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SponsorForm action={createSponsorAction} submitLabel="สร้าง Sponsor" />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
