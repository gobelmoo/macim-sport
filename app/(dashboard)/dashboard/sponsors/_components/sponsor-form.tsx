'use client'

import { useActionState, useState } from 'react'
import { Building2, Hash, User, Mail, Link2 } from 'lucide-react'
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
import type { SponsorActionState } from '../actions'
import type { SponsorRow } from '@/db/queries/sponsors'

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

function IconField({
  icon: Icon,
  label,
  id,
  name,
  type,
  defaultValue,
  placeholder,
  error,
}: {
  icon: LucideIcon
  label: string
  id: string
  name: string
  type?: string
  defaultValue?: string
  placeholder?: string
  error?: string[]
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          name={name}
          type={type}
          className="pl-9"
          defaultValue={defaultValue ?? ''}
          placeholder={placeholder}
          aria-invalid={!!error}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error[0]}</p>}
    </div>
  )
}

interface SponsorFormProps {
  action: (prevState: SponsorActionState, formData: FormData) => Promise<SponsorActionState>
  sponsor?: SponsorRow
  submitLabel: string
}

const initialState: SponsorActionState = {}

export function SponsorForm({ action, sponsor, submitLabel }: SponsorFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState)
  const [brandColor, setBrandColor] = useState(sponsor?.brandColor ?? '')

  return (
    <form action={formAction} className="space-y-5">
      {state.message && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}

      {sponsor && (
        <input type="hidden" name="sponsorId" value={sponsor.sponsorId} />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <IconField
          icon={Building2}
          label="ชื่อ Sponsor *"
          id="sponsorName"
          name="sponsorName"
          defaultValue={sponsor?.sponsorName}
          placeholder="ชื่อบริษัท / องค์กร"
          error={state.errors?.sponsorName}
        />
        <IconField
          icon={Hash}
          label="เลขทะเบียนบริษัท *"
          id="companyRegNumber"
          name="companyRegNumber"
          defaultValue={sponsor?.companyRegNumber}
          placeholder="0-0000-00000-00-0"
          error={state.errors?.companyRegNumber}
        />
        <IconField
          icon={User}
          label="ชื่อผู้ติดต่อ *"
          id="contactName"
          name="contactName"
          defaultValue={sponsor?.contactName}
          placeholder="ชื่อ-นามสกุล"
          error={state.errors?.contactName}
        />
        <IconField
          icon={Mail}
          label="อีเมลติดต่อ *"
          id="contactEmail"
          name="contactEmail"
          type="email"
          defaultValue={sponsor?.contactEmail}
          placeholder="contact@example.com"
          error={state.errors?.contactEmail}
        />

        {/* Service Type */}
        <div className="space-y-1.5">
          <Label htmlFor="serviceType">ประเภทบริการ *</Label>
          <Select
            name="serviceType"
            defaultValue={sponsor?.serviceType ?? 'physical_and_digital'}
          >
            <SelectTrigger id="serviceType" className="w-full">
              <SelectValue placeholder="เลือกประเภทบริการ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="physical_and_digital">กายภาพ + ดิจิทัล</SelectItem>
              <SelectItem value="digital_only">ดิจิทัลเท่านั้น</SelectItem>
            </SelectContent>
          </Select>
          {state.errors?.serviceType && (
            <p className="text-sm text-destructive">{state.errors.serviceType[0]}</p>
          )}
        </div>

        <IconField
          icon={Link2}
          label="URL โลโก้"
          id="logoUrl"
          name="logoUrl"
          type="url"
          defaultValue={sponsor?.logoUrl ?? ''}
          placeholder="https://example.com/logo.png"
          error={state.errors?.logoUrl}
        />

        {/* Brand Color */}
        <div className="space-y-1.5">
          <Label htmlFor="brandColor">Brand Color</Label>
          <div className="flex gap-2">
            <input
              type="color"
              value={HEX_COLOR_RE.test(brandColor) ? brandColor : '#000000'}
              onChange={(e) => setBrandColor(e.target.value)}
              className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-1"
              aria-label="เลือกสี"
              tabIndex={-1}
            />
            <Input
              id="brandColor"
              name="brandColor"
              className="flex-1"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              placeholder="#FF5733"
              aria-invalid={!!state.errors?.brandColor}
            />
          </div>
          {state.errors?.brandColor && (
            <p className="text-sm text-destructive">{state.errors.brandColor[0]}</p>
          )}
        </div>
      </div>

      {/* Is Internal */}
      <div className="flex items-center gap-2">
        <input
          id="isInternal"
          name="isInternal"
          type="checkbox"
          defaultChecked={sponsor?.isInternal ?? false}
          className="h-4 w-4 rounded border-input accent-primary"
        />
        <Label htmlFor="isInternal" className="cursor-pointer">
          Sponsor ภายใน (Internal)
        </Label>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'กำลังบันทึก...' : submitLabel}
        </Button>
        <Button type="button" variant="outline" asChild>
          <a href="/dashboard/sponsors">ยกเลิก</a>
        </Button>
      </div>
    </form>
  )
}
