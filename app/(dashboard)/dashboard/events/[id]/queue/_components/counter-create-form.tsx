'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createCounterAction, type CounterFormState } from '../actions'

export function CounterCreateForm({ eventId }: { eventId: string }) {
  const action = createCounterAction.bind(null, eventId)
  const [state, formAction, isPending] = useActionState<
    CounterFormState,
    FormData
  >(action, null)

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
      <Input
        name="counterName"
        placeholder="ชื่อจุดบริการ เช่น จุดนวด 1"
        className="sm:max-w-xs"
        required
      />
      <Button type="submit" disabled={isPending}>
        {isPending ? 'กำลังเพิ่ม...' : 'เพิ่มจุดบริการ'}
      </Button>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  )
}
