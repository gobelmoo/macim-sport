'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
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
import { createUserAction } from '../actions'
import type { UserRole } from '@/lib/rbac'

type Sponsor = { sponsorId: string; sponsorName: string }

const ROLE_OPTIONS: Record<string, { value: UserRole; label: string }[]> = {
  super_admin_owner: [
    { value: 'super_admin_owner', label: 'Owner' },
    { value: 'super_admin_manager', label: 'Manager' },
    { value: 'super_admin_viewer', label: 'Viewer' },
    { value: 'sponsor_admin', label: 'Sponsor Admin' },
    { value: 'sponsor_staff', label: 'Sponsor Staff' },
  ],
  super_admin_manager: [
    { value: 'super_admin_viewer', label: 'Viewer' },
    { value: 'sponsor_admin', label: 'Sponsor Admin' },
    { value: 'sponsor_staff', label: 'Sponsor Staff' },
  ],
  sponsor_admin: [{ value: 'sponsor_staff', label: 'Sponsor Staff' }],
}

const SPONSOR_ROLES: UserRole[] = ['sponsor_admin', 'sponsor_staff']

interface Props {
  creatorRole: UserRole
  creatorSponsorId: string | null
  sponsors: Sponsor[]
}

export function NewUserForm({ creatorRole, creatorSponsorId, sponsors }: Props) {
  const [state, action, isPending] = useActionState(createUserAction, undefined)

  const roleOptions = ROLE_OPTIONS[creatorRole] ?? []
  const defaultRole = roleOptions[0]?.value ?? 'sponsor_staff'
  const [selectedRole, setSelectedRole] = useState<UserRole>(defaultRole)

  const isSponsorAdmin = creatorRole === 'sponsor_admin'
  // Show sponsorId selector only for owner/manager when selected role needs it
  const showSponsorSelect =
    !isSponsorAdmin && SPONSOR_ROLES.includes(selectedRole)

  return (
    <form action={action} className="flex flex-col gap-5">
      {/* Email */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">อีเมล</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="email@example.com"
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

      {/* Password */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">รหัสผ่าน</Label>
        <Input
          id="password"
          name="password"
          type="text"
          placeholder="อย่างน้อย 8 ตัวอักษร"
          required
          autoComplete="new-password"
          aria-invalid={
            state && 'fieldErrors' in state && !!state.fieldErrors?.password
          }
        />
        {state && 'fieldErrors' in state && state.fieldErrors?.password && (
          <p className="text-sm text-destructive">
            {state.fieldErrors.password[0]}
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
          placeholder="0812345678"
          autoComplete="off"
        />
      </div>

      {/* Role */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="role">บทบาท</Label>
        {isSponsorAdmin ? (
          <>
            <Input
              id="role"
              name="role"
              type="text"
              value="Sponsor Staff"
              disabled
              readOnly
            />
            <input type="hidden" name="role" value="sponsor_staff" />
          </>
        ) : (
          <Select
            name="role"
            defaultValue={defaultRole}
            onValueChange={(v) => setSelectedRole(v as UserRole)}
          >
            <SelectTrigger id="role" className="w-full">
              <SelectValue placeholder="เลือกบทบาท" />
            </SelectTrigger>
            <SelectContent>
              {roleOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* SponsorId — only for owner/manager when role requires it */}
      {showSponsorSelect && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="sponsorId">Sponsor</Label>
          <Select name="sponsorId">
            <SelectTrigger id="sponsorId" className="w-full">
              <SelectValue placeholder="เลือก Sponsor" />
            </SelectTrigger>
            <SelectContent>
              {sponsors.map((s) => (
                <SelectItem key={s.sponsorId} value={s.sponsorId}>
                  {s.sponsorName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {state && 'fieldErrors' in state && state.fieldErrors?.sponsorId && (
            <p className="text-sm text-destructive">
              {state.fieldErrors.sponsorId[0]}
            </p>
          )}
        </div>
      )}

      {state && 'error' in state && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'กำลังสร้าง...' : 'สร้างผู้ใช้'}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard/users">ยกเลิก</Link>
        </Button>
      </div>
    </form>
  )
}
