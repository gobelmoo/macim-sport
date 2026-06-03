'use client'

import { useActionState } from 'react'
import { Tag, User, MapPin, Building2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
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

function IconField({
  icon: Icon, label, id, name, type, defaultValue, placeholder, error,
}: {
  icon: LucideIcon; label: string; id: string; name: string
  type?: string; defaultValue?: string; placeholder?: string; error?: string[]
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id} name={name} type={type} className="pl-9"
          defaultValue={defaultValue ?? ''} placeholder={placeholder}
          aria-invalid={!!error}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error[0]}</p>}
    </div>
  )
}

export function EventEditForm({ sponsors, defaultValues, action }: EventEditFormProps) {
  const [state, formAction, isPending] = useActionState(action, {})

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <p className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      {/* Sponsor */}
      <div className="space-y-1.5">
        <Label htmlFor="sponsorId">Sponsor</Label>
        <Select name="sponsorId" defaultValue={defaultValues.sponsorId}>
          <SelectTrigger id="sponsorId" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sponsors.map((s) => (
              <SelectItem key={s.sponsorId} value={s.sponsorId}>
                {s.sponsorName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.fieldErrors?.sponsorId && (
          <p className="text-xs text-destructive">{state.fieldErrors.sponsorId[0]}</p>
        )}
      </div>

      <IconField
        icon={Tag} label="ชื่องาน" id="eventName" name="eventName"
        defaultValue={defaultValues.eventName} error={state.fieldErrors?.eventName}
      />
      <IconField
        icon={User} label="ชื่อผู้จัด" id="organizerName" name="organizerName"
        defaultValue={defaultValues.organizerName} error={state.fieldErrors?.organizerName}
      />

      {/* Event Type */}
      <div className="space-y-1.5">
        <Label htmlFor="eventType">ประเภทกีฬา</Label>
        <Select name="eventType" defaultValue={defaultValues.eventType}>
          <SelectTrigger id="eventType" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="run">วิ่ง (Run)</SelectItem>
            <SelectItem value="triathlon">ไตรกีฬา (Triathlon)</SelectItem>
            <SelectItem value="other">อื่นๆ (Other)</SelectItem>
          </SelectContent>
        </Select>
        {state.fieldErrors?.eventType && (
          <p className="text-xs text-destructive">{state.fieldErrors.eventType[0]}</p>
        )}
      </div>

      <IconField
        icon={MapPin} label="สถานที่จัดงาน" id="eventLocation" name="eventLocation"
        defaultValue={defaultValues.eventLocation} error={state.fieldErrors?.eventLocation}
      />
      <IconField
        icon={Building2} label="เมือง / จังหวัด" id="eventCity" name="eventCity"
        defaultValue={defaultValues.eventCity} error={state.fieldErrors?.eventCity}
      />

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="startDate">วันที่เริ่ม</Label>
          <Input id="startDate" name="startDate" type="date"
            defaultValue={defaultValues.startDate} required />
          {state.fieldErrors?.startDate && (
            <p className="text-xs text-destructive">{state.fieldErrors.startDate[0]}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endDate">วันที่สิ้นสุด</Label>
          <Input id="endDate" name="endDate" type="date"
            defaultValue={defaultValues.endDate} required />
          {state.fieldErrors?.endDate && (
            <p className="text-xs text-destructive">{state.fieldErrors.endDate[0]}</p>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
        </Button>
        <Button variant="outline" asChild>
          <a href="..">ยกเลิก</a>
        </Button>
      </div>
    </form>
  )
}
