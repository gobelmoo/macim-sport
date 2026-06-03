'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ActionState } from './actions'

type Sponsor = { sponsorId: string; sponsorName: string }

type EventEditFormProps = {
  sponsors: Sponsor[]
  defaultValues: {
    sponsorId: string
    eventName: string
    eventLocation: string
    eventCity: string
    eventType: string
    organizerName: string
    startDate: string
    endDate: string
  }
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>
}

export function EventEditForm({
  sponsors,
  defaultValues,
  action,
}: EventEditFormProps) {
  const [state, formAction, isPending] = useActionState(action, {})

  return (
    <form action={formAction} className="space-y-5 max-w-xl">
      {state.error && (
        <p className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="sponsorId">Sponsor</Label>
        <select
          id="sponsorId"
          name="sponsorId"
          defaultValue={defaultValues.sponsorId}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {sponsors.map((s) => (
            <option key={s.sponsorId} value={s.sponsorId}>
              {s.sponsorName}
            </option>
          ))}
        </select>
        {state.fieldErrors?.sponsorId && (
          <p className="text-xs text-destructive">
            {state.fieldErrors.sponsorId[0]}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="eventName">ชื่องาน</Label>
        <Input
          id="eventName"
          name="eventName"
          defaultValue={defaultValues.eventName}
          required
        />
        {state.fieldErrors?.eventName && (
          <p className="text-xs text-destructive">
            {state.fieldErrors.eventName[0]}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="organizerName">ชื่อผู้จัด</Label>
        <Input
          id="organizerName"
          name="organizerName"
          defaultValue={defaultValues.organizerName}
          required
        />
        {state.fieldErrors?.organizerName && (
          <p className="text-xs text-destructive">
            {state.fieldErrors.organizerName[0]}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="eventType">ประเภทกีฬา</Label>
        <select
          id="eventType"
          name="eventType"
          defaultValue={defaultValues.eventType}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="run">วิ่ง (Run)</option>
          <option value="triathlon">ไตรกีฬา (Triathlon)</option>
          <option value="other">อื่นๆ (Other)</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="eventLocation">สถานที่จัดงาน</Label>
        <Input
          id="eventLocation"
          name="eventLocation"
          defaultValue={defaultValues.eventLocation}
          required
        />
        {state.fieldErrors?.eventLocation && (
          <p className="text-xs text-destructive">
            {state.fieldErrors.eventLocation[0]}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="eventCity">เมือง / จังหวัด</Label>
        <Input
          id="eventCity"
          name="eventCity"
          defaultValue={defaultValues.eventCity}
          required
        />
        {state.fieldErrors?.eventCity && (
          <p className="text-xs text-destructive">
            {state.fieldErrors.eventCity[0]}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="startDate">วันที่เริ่ม</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={defaultValues.startDate}
            required
          />
          {state.fieldErrors?.startDate && (
            <p className="text-xs text-destructive">
              {state.fieldErrors.startDate[0]}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endDate">วันที่สิ้นสุด</Label>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={defaultValues.endDate}
            required
          />
          {state.fieldErrors?.endDate && (
            <p className="text-xs text-destructive">
              {state.fieldErrors.endDate[0]}
            </p>
          )}
        </div>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
      </Button>
    </form>
  )
}
