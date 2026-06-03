import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Building2, Pencil } from 'lucide-react'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS } from '@/lib/rbac'
import { getSponsor, hasSponsorDependencies } from '@/db/queries/sponsors'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { updateSponsorAction } from '../actions'
import { SponsorForm } from '../_components/sponsor-form'
import { DeleteSponsorButton } from '../_components/delete-sponsor-button'
import { ToggleSponsorStatusButton } from '../_components/toggle-sponsor-status-button'
import { SponsorStatusBadge, SponsorTypeBadge, InternalBadge } from '../_components/sponsor-badges'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditSponsorPage({ params }: Props) {
  const { id } = await params

  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const authz = { role: session.user.role, permissions: session.user.permissions }

  if (!canAccess(PERMISSIONS.SPONSOR_VIEW, authz)) {
    redirect('/dashboard')
  }

  const sponsor = await getSponsor(id)
  if (!sponsor) notFound()

  const canEdit = canAccess(PERMISSIONS.SPONSOR_EDIT, authz)
  const linkedToEvents = canEdit ? await hasSponsorDependencies(id) : false

  return (
    <main className="p-6 lg:p-8">
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
        <Link href="/dashboard/sponsors">
          <ChevronLeft className="size-4" />
          Sponsors
        </Link>
      </Button>

      <div className="mb-6 flex items-center gap-2">
        <Pencil className="size-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">แก้ไข Sponsor</h1>
      </div>

      <div className="max-w-2xl space-y-4">
        {/* Profile Header Card */}
        <Card>
          <CardContent className="flex items-center justify-between gap-4 pt-6">
            <div className="flex items-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-full bg-muted">
                <Building2 className="size-7 text-muted-foreground" />
              </div>
              <div className="space-y-1.5">
                <p className="font-semibold">{sponsor.sponsorName}</p>
                <div className="flex flex-wrap gap-2">
                  <SponsorStatusBadge status={sponsor.status} />
                  {sponsor.isInternal && <InternalBadge />}
                  <SponsorTypeBadge serviceType={sponsor.serviceType} />
                </div>
              </div>
            </div>
            {canEdit && (
              linkedToEvents ? (
                <p className="text-xs text-muted-foreground">ไม่สามารถลบได้ เนื่องจากมีข้อมูลที่ผูกอยู่</p>
              ) : (
                <DeleteSponsorButton sponsorId={sponsor.sponsorId} sponsorName={sponsor.sponsorName} />
              )
            )}
          </CardContent>
        </Card>

        {/* Edit Form Card */}
        {canEdit ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Pencil className="size-4" />
                แก้ไขข้อมูล
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SponsorForm
                action={updateSponsorAction}
                sponsor={sponsor}
                submitLabel="บันทึกการเปลี่ยนแปลง"
              />
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
            คุณไม่มีสิทธิ์แก้ไข Sponsor
          </div>
        )}

        {/* Toggle Status Card */}
        {canEdit && (
          <ToggleSponsorStatusButton
            sponsorId={sponsor.sponsorId}
            currentStatus={sponsor.status}
          />
        )}
      </div>
    </main>
  )
}
