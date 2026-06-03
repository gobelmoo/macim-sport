'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ActionState } from '../actions'

type Sponsor = { sponsorId: string; sponsorName: string }

type EventFormProps = {
  sponsors: Sponsor[]
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>
  defaultValues?: {
    sponsorId?: string
    eventName?: string
    eventLocation?: string
    eventCity?: string
    eventType?: string
    organizerName?: string
    startDate?: string
    endDate?: string
  }
}

export function EventForm({ sponsors, action, defaultValues }: EventFormProps) {
  const [state, formAction, isPending] = useActionState(action, {})

  return (
    <form action={formAction} className="space-y-5 max-w-xl">
      {state.error && (
        <p className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      {/* Sponsor */}
      <div className="space-y-1.5">
        <Label htmlFor="sponsorId">Sponsor</Label>
        <select
          id="sponsorId"
          name="sponsorId"
          defaultValue={defaultValues?.sponsorId ?? ''}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          required
        >
          <option value="" disabled>
            เลือก Sponsor
          </option>
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

      {/* Event Name */}
      <div className="space-y-1.5">
        <Label htmlFor="eventName">ชื่องาน</Label>
        <Input
          id="eventName"
          name="eventName"
          defaultValue={defaultValues?.eventName}
          placeholder="เช่น MACIM Run 2025"
          required
        />
        {state.fieldErrors?.eventName && (
          <p className="text-xs text-destructive">
            {state.fieldErrors.eventName[0]}
          </p>
        )}
      </div>

      {/* Organizer Name */}
      <div className="space-y-1.5">
        <Label htmlFor="organizerName">ชื่อผู้จัด</Label>
        <Input
          id="organizerName"
          name="organizerName"
          defaultValue={defaultValues?.organizerName}
          placeholder="เช่น MACIM SPORT Co., Ltd."
          required
        />
        {state.fieldErrors?.organizerName && (
          <p className="text-xs text-destructive">
            {state.fieldErrors.organizerName[0]}
          </p>
        )}
      </div>

      {/* Event Type */}
      <div className="space-y-1.5">
        <Label htmlFor="eventType">ประเภทกีฬา</Label>
        <select
          id="eventType"
          name="eventType"
          defaultValue={defaultValues?.eventType ?? 'run'}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="run">วิ่ง (Run)</option>
          <option value="triathlon">ไตรกีฬา (Triathlon)</option>
          <option value="other">อื่นๆ (Other)</option>
        </select>
        {state.fieldErrors?.eventType && (
          <p className="text-xs text-destructive">
            {state.fieldErrors.eventType[0]}
          </p>
        )}
      </div>

      {/* Location */}
      <div className="space-y-1.5">
        <Label htmlFor="eventLocation">สถานที่จัดงาน</Label>
        <Input
          id="eventLocation"
          name="eventLocation"
          defaultValue={defaultValues?.eventLocation}
          placeholder="เช่น สนามกีฬาแห่งชาติ"
          required
        />
        {state.fieldErrors?.eventLocation && (
          <p className="text-xs text-destructive">
            {state.fieldErrors.eventLocation[0]}
          </p>
        )}
      </div>

      {/* City */}
      <div className="space-y-1.5">
        <Label htmlFor="eventCity">เมือง / จังหวัด</Label>
        <Input
          id="eventCity"
          name="eventCity"
          defaultValue={defaultValues?.eventCity}
          placeholder="เช่น กรุงเทพมหานคร"
          required
        />
        {state.fieldErrors?.eventCity && (
          <p className="text-xs text-destructive">
            {state.fieldErrors.eventCity[0]}
          </p>
        )}
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="startDate">วันที่เริ่ม</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={defaultValues?.startDate}
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
            defaultValue={defaultValues?.endDate}
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
        {isPending ? 'กำลังบันทึก...' : 'บันทึก'}
      </Button>
    </form>
  )
}
