import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS } from '@/lib/rbac'
import { getSponsor, hasSponsorDependencies } from '@/db/queries/sponsors'
import { updateSponsorAction } from '../actions'
import { SponsorForm } from '../_components/sponsor-form'
import { DeleteSponsorButton } from '../_components/delete-sponsor-button'

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
      <div className="mb-6 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold">{sponsor.sponsorName}</h1>
        {canEdit && (
          linkedToEvents
            ? <p className="text-sm text-muted-foreground">ไม่สามารถลบได้ เนื่องจากมีข้อมูลที่ผูกอยู่</p>
            : <DeleteSponsorButton sponsorId={sponsor.sponsorId} sponsorName={sponsor.sponsorName} />
        )}
      </div>

      {canEdit ? (
        <SponsorForm
          action={updateSponsorAction}
          sponsor={sponsor}
          submitLabel="บันทึกการเปลี่ยนแปลง"
        />
      ) : (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          คุณไม่มีสิทธิ์แก้ไข Sponsor
        </div>
      )}
    </main>
  )
}
