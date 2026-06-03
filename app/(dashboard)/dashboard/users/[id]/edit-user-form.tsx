'use client'

import { useActionState } from 'react'
import Link from 'next/link'
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

  return (
    <form action={action} className="flex flex-col gap-5">
      {/* Email */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">อีเมล</Label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={defaultValues.email}
          required
          autoComplete="off"
          aria-invalid={
            state && 'fieldErrors' in state && !!state.fieldErrors?.email
          }
        />
        {state && 'fieldErrors' in state && state.fieldErrors?.email && (
          <p className="text-sm text-destructive">
            {state.fieldErrors.email[0]}
          </p>
        )}
      </div>

      {/* Phone */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="phoneNumber">เบอร์โทรศัพท์ (ไม่บังคับ)</Label>
        <Input
          id="phoneNumber"
          name="phoneNumber"
          type="text"
          defaultValue={defaultValues.phoneNumber}
          autoComplete="off"
        />
      </div>

      {/* Success / Error feedback */}
      {state && 'success' in state && state.success && (
        <p className="text-sm text-green-600">บันทึกสำเร็จ</p>
      )}
      {state && 'error' in state && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard/users">กลับ</Link>
        </Button>
      </div>
    </form>
  )
}
