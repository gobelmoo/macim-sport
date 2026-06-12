'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS } from '@/lib/rbac'
import { updateLineSettings } from '@/db/queries/line'

const settingsSchema = z.object({
  fallbackEnabled: z.boolean(),
  fallbackMessage: z
    .string()
    .max(2000, 'ข้อความยาวเกินไป (สูงสุด 2000 ตัวอักษร)'),
})

export type SettingsActionState = {
  errors?: Record<string, string[]>
  message?: string
  success?: boolean
}

export async function updateLineSettingsAction(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const authz = { role: session.user.role, permissions: session.user.permissions }
  if (!canAccess(PERMISSIONS.USER_MANAGE, authz)) {
    return { message: 'ไม่มีสิทธิ์แก้ไขการตั้งค่า' }
  }

  const parsed = settingsSchema.safeParse({
    fallbackEnabled: formData.get('fallbackEnabled') === 'on',
    fallbackMessage: (formData.get('fallbackMessage') ?? '').toString(),
  })
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  await updateLineSettings(parsed.data)
  revalidatePath('/dashboard/settings')
  return { success: true, message: 'บันทึกการตั้งค่าแล้ว' }
}
