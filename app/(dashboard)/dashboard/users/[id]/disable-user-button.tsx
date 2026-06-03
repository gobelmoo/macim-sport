'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { disableUserAction } from '../actions'

interface Props {
  userId: string
}

export function DisableUserButton({ userId }: Props) {
  const boundAction = disableUserAction.bind(null, userId)
  const [state, action, isPending] = useActionState(boundAction, undefined)

  return (
    <form action={action}>
      <Button type="submit" variant="destructive" disabled={isPending}>
        {isPending ? 'กำลังปิดใช้งาน...' : 'ปิดใช้งาน'}
      </Button>
      {state && 'error' in state && (
        <p className="mt-2 text-sm text-destructive">{state.error}</p>
      )}
    </form>
  )
}
