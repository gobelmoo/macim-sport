'use client'

import { useActionState, useEffect } from 'react'
import Link from 'next/link'
import { Mail, Phone, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateUserAction } from '../actions'

interface Props {
  userId: string
  defaultValues: {
    email: string
    phoneNumber: string
  }
}

export function EditUserForm({ userId, defaultValues }: Props) {
  const boundAction = updateUserAction.bind(null, userId)
  const [state, action, isPending] = useActionState(boundAction, undefined)

  useEffect(() => {
    if (!state) return
    if ('success' in state && state.success) {
      toast.success('บันทึกสำเร็จ')
    } else if ('error' in state && !state.fieldErrors?.email) {
      toast.error(state.error)
    }
  }, [state])

  return (
    <form action={action} className="flex flex-col gap-5">
      {/* Email */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">อีเมล</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            name="email"
            type="email"
            className="pl-9"
            defaultValue={defaultValues.email}
            required
            autoComplete="off"
            aria-invalid={
              state && 'fieldErrors' in state && !!state.fieldErrors?.email
            }
          />
        </div>
        {state && 'fieldErrors' in state && state.fieldErrors?.email && (
          <p className="text-sm text-destructive">
            {state.fieldErrors.email[0]}
          </p>
        )}
      </div>

      {/* Phone */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="phoneNumber">เบอร์โทรศัพท์ (ไม่บังคับ)</Label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="phoneNumber"
            name="phoneNumber"
            type="text"
            className="pl-9"
            defaultValue={defaultValues.phoneNumber}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          <Save className="size-4" />
          {isPending ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard/users">ยกเลิก</Link>
        </Button>
      </div>
    </form>
  )
}
