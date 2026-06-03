'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS } from '@/lib/rbac'
import {
  createSponsor,
  updateSponsor,
  hasSponsorDependencies,
  deleteSponsor,
} from '@/db/queries/sponsors'

const serviceTypeValues = ['physical_and_digital', 'digital_only'] as const
const statusValues = ['active', 'hidden'] as const

const sponsorSchema = z.object({
  sponsorName: z.string().min(1, 'กรุณากรอกชื่อ Sponsor'),
  companyRegNumber: z.string().min(1, 'กรุณากรอกเลขทะเบียน'),
  isInternal: z.boolean().default(false),
  serviceType: z.enum(serviceTypeValues),
  contactName: z.string().min(1, 'กรุณากรอกชื่อผู้ติดต่อ'),
  contactEmail: z.email('รูปแบบอีเมลไม่ถูกต้อง'),
  logoUrl: z.string().url('รูปแบบ URL ไม่ถูกต้อง').optional().or(z.literal('')),
  brandColor: z.string().optional(),
  status: z.enum(statusValues).optional(),
})

export type SponsorActionState = {
  errors?: Record<string, string[]>
  message?: string
}

export async function createSponsorAction(
  _prevState: SponsorActionState,
  formData: FormData,
): Promise<SponsorActionState> {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const authz = { role: session.user.role, permissions: session.user.permissions }
  if (!canAccess(PERMISSIONS.SPONSOR_CREATE, authz)) {
    return { message: 'คุณไม่มีสิทธิ์สร้าง Sponsor' }
  }

  const raw = {
    sponsorName: formData.get('sponsorName') as string,
    companyRegNumber: formData.get('companyRegNumber') as string,
    isInternal: formData.get('isInternal') === 'on',
    serviceType: formData.get('serviceType') as string,
    contactName: formData.get('contactName') as string,
    contactEmail: formData.get('contactEmail') as string,
    logoUrl: (formData.get('logoUrl') as string) || undefined,
    brandColor: (formData.get('brandColor') as string) || undefined,
  }

  const parsed = sponsorSchema.safeParse(raw)
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const { logoUrl, ...rest } = parsed.data
  await createSponsor({
    ...rest,
    logoUrl: logoUrl || null,
  })

  revalidatePath('/dashboard/sponsors')
  redirect('/dashboard/sponsors')
}

export async function updateSponsorAction(
  _prevState: SponsorActionState,
  formData: FormData,
): Promise<SponsorActionState> {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const authz = { role: session.user.role, permissions: session.user.permissions }
  if (!canAccess(PERMISSIONS.SPONSOR_EDIT, authz)) {
    return { message: 'คุณไม่มีสิทธิ์แก้ไข Sponsor' }
  }

  const sponsorId = formData.get('sponsorId') as string
  if (!sponsorId) return { message: 'ไม่พบ Sponsor' }

  const raw = {
    sponsorName: formData.get('sponsorName') as string,
    companyRegNumber: formData.get('companyRegNumber') as string,
    isInternal: formData.get('isInternal') === 'on',
    serviceType: formData.get('serviceType') as string,
    contactName: formData.get('contactName') as string,
    contactEmail: formData.get('contactEmail') as string,
    logoUrl: (formData.get('logoUrl') as string) || undefined,
    brandColor: (formData.get('brandColor') as string) || undefined,
    status: (formData.get('status') as string) || undefined,
  }

  const parsed = sponsorSchema.safeParse(raw)
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const { logoUrl, ...rest } = parsed.data
  await updateSponsor(sponsorId, {
    ...rest,
    logoUrl: logoUrl || null,
  })

  revalidatePath('/dashboard/sponsors')
  revalidatePath(`/dashboard/sponsors/${sponsorId}`)
  redirect('/dashboard/sponsors')
}

export type DeleteSponsorState = { message?: string }

export async function deleteSponsorAction(
  sponsorId: string,
): Promise<DeleteSponsorState> {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const authz = { role: session.user.role, permissions: session.user.permissions }
  if (!canAccess(PERMISSIONS.SPONSOR_EDIT, authz)) {
    return { message: 'คุณไม่มีสิทธิ์ลบ Sponsor' }
  }

  const linked = await hasSponsorDependencies(sponsorId)
  if (linked) {
    return { message: 'ไม่สามารถลบ Sponsor นี้ได้ เนื่องจากมีข้อมูลที่ผูกอยู่' }
  }

  await deleteSponsor(sponsorId)
  revalidatePath('/dashboard/sponsors')
  redirect('/dashboard/sponsors')
}
