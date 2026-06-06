'use client'

import { useActionState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ActionState } from '../actions'

type StationFormProps = {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>
  defaultValues?: {
    stationType?: string
    stationName?: string
  }
  submitLabel?: string
  onSuccess?: () => void
}

export function StationForm({
  action,
  defaultValues,
  submitLabel = 'เพิ่ม Station',
  onSuccess,
}: StationFormProps) {
  const [state, formAction, isPending] = useActionState(action, {})

  useEffect(() => {
    if (state.success) onSuccess?.()
  }, [state.success, onSuccess])

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="stationType">ประเภท Station</Label>
        <select
          id="stationType"
          name="stationType"
          defaultValue={defaultValues?.stationType ?? 'air_recovery'}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="air_recovery">Air Recovery</option>
          <option value="ice_bath">Ice Bath</option>
          <option value="other">อื่นๆ (Other)</option>
        </select>
        {state.fieldErrors?.stationType && (
          <p className="text-xs text-destructive">
            {state.fieldErrors.stationType[0]}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="stationName">ชื่อ Station</Label>
        <Input
          id="stationName"
          name="stationName"
          defaultValue={defaultValues?.stationName}
          placeholder="เช่น Air Recovery Zone A"
          required
        />
        {state.fieldErrors?.stationName && (
          <p className="text-xs text-destructive">
            {state.fieldErrors.stationName[0]}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? 'กำลังบันทึก...' : submitLabel}
      </Button>
    </form>
  )
}
