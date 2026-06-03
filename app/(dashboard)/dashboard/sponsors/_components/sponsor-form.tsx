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
import type { SponsorActionState } from '../actions'
import type { SponsorRow } from '@/db/queries/sponsors'

interface SponsorFormProps {
  action: (prevState: SponsorActionState, formData: FormData) => Promise<SponsorActionState>
  sponsor?: SponsorRow
  submitLabel: string
}

const initialState: SponsorActionState = {}

export function SponsorForm({ action, sponsor, submitLabel }: SponsorFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState)

  return (
    <form action={formAction} className="space-y-6 max-w-2xl">
      {state.message && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}

      {/* Hidden sponsorId for update */}
      {sponsor && (
        <input type="hidden" name="sponsorId" value={sponsor.sponsorId} />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Sponsor Name */}
        <div className="space-y-1.5">
          <Label htmlFor="sponsorName">ชื่อ Sponsor *</Label>
          <Input
            id="sponsorName"
            name="sponsorName"
            defaultValue={sponsor?.sponsorName ?? ''}
            placeholder="ชื่อบริษัท / องค์กร"
            aria-invalid={!!state.errors?.sponsorName}
          />
          {state.errors?.sponsorName && (
            <p className="text-sm text-destructive">{state.errors.sponsorName[0]}</p>
          )}
        </div>

        {/* Company Reg Number */}
        <div className="space-y-1.5">
          <Label htmlFor="companyRegNumber">เลขทะเบียนบริษัท *</Label>
          <Input
            id="companyRegNumber"
            name="companyRegNumber"
            defaultValue={sponsor?.companyRegNumber ?? ''}
            placeholder="0-0000-00000-00-0"
            aria-invalid={!!state.errors?.companyRegNumber}
          />
          {state.errors?.companyRegNumber && (
            <p className="text-sm text-destructive">{state.errors.companyRegNumber[0]}</p>
          )}
        </div>

        {/* Contact Name */}
        <div className="space-y-1.5">
          <Label htmlFor="contactName">ชื่อผู้ติดต่อ *</Label>
          <Input
            id="contactName"
            name="contactName"
            defaultValue={sponsor?.contactName ?? ''}
            placeholder="ชื่อ-นามสกุล"
            aria-invalid={!!state.errors?.contactName}
          />
          {state.errors?.contactName && (
            <p className="text-sm text-destructive">{state.errors.contactName[0]}</p>
          )}
        </div>

        {/* Contact Email */}
        <div className="space-y-1.5">
          <Label htmlFor="contactEmail">อีเมลติดต่อ *</Label>
          <Input
            id="contactEmail"
            name="contactEmail"
            type="email"
            defaultValue={sponsor?.contactEmail ?? ''}
            placeholder="contact@example.com"
            aria-invalid={!!state.errors?.contactEmail}
          />
          {state.errors?.contactEmail && (
            <p className="text-sm text-destructive">{state.errors.contactEmail[0]}</p>
          )}
        </div>

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

        {/* Logo URL */}
        <div className="space-y-1.5">
          <Label htmlFor="logoUrl">URL โลโก้</Label>
          <Input
            id="logoUrl"
            name="logoUrl"
            type="url"
            defaultValue={sponsor?.logoUrl ?? ''}
            placeholder="https://example.com/logo.png"
            aria-invalid={!!state.errors?.logoUrl}
          />
          {state.errors?.logoUrl && (
            <p className="text-sm text-destructive">{state.errors.logoUrl[0]}</p>
          )}
        </div>

        {/* Brand Color */}
        <div className="space-y-1.5">
          <Label htmlFor="brandColor">Brand Color</Label>
          <Input
            id="brandColor"
            name="brandColor"
            defaultValue={sponsor?.brandColor ?? ''}
            placeholder="#FF5733"
            aria-invalid={!!state.errors?.brandColor}
          />
          {state.errors?.brandColor && (
            <p className="text-sm text-destructive">{state.errors.brandColor[0]}</p>
          )}
        </div>

        {/* Status — edit mode only */}
        {sponsor && (
          <div className="space-y-1.5">
            <Label htmlFor="status">สถานะ</Label>
            <Select name="status" defaultValue={sponsor.status}>
              <SelectTrigger id="status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">ใช้งาน</SelectItem>
                <SelectItem value="hidden">ซ่อน</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
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

      <div className="flex gap-3">
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
