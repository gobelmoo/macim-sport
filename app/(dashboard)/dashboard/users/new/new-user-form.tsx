'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Phone,
  ShieldCheck,
  KeyRound,
  UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  const [showPassword, setShowPassword] = useState(false)

  const isSponsorAdmin = creatorRole === 'sponsor_admin'
  const showSponsorSelect =
    !isSponsorAdmin && SPONSOR_ROLES.includes(selectedRole)

  return (
    <form action={action} className="flex flex-col gap-4">
      {/* Card 1 — ข้อมูลบัญชี */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4" />
            ข้อมูลบัญชี
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">อีเมล</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                name="email"
                type="email"
                className="pl-9"
                placeholder="email@example.com"
                required
                autoComplete="off"
                aria-invalid={
                  state && 'fieldErrors' in state && !!state.fieldErrors?.email
                }
              />
            </div>
            {state && 'fieldErrors' in state && state.fieldErrors?.email && (
              <p className="text-sm text-destructive">
                {state.fieldErrors.email[0]}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">รหัสผ่าน</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                className="pl-9 pr-9"
                placeholder="อย่างน้อย 8 ตัวอักษร"
                required
                autoComplete="new-password"
                aria-invalid={
                  state &&
                  'fieldErrors' in state &&
                  !!state.fieldErrors?.password
                }
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            {state && 'fieldErrors' in state && state.fieldErrors?.password && (
              <p className="text-sm text-destructive">
                {state.fieldErrors.password[0]}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Card 2 — ข้อมูลติดต่อ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Phone className="size-4" />
            ข้อมูลติดต่อ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <Label htmlFor="phoneNumber">เบอร์โทรศัพท์ (ไม่บังคับ)</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="phoneNumber"
                name="phoneNumber"
                type="text"
                className="pl-9"
                placeholder="0812345678"
                autoComplete="off"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 3 — สิทธิ์การใช้งาน */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4" />
            สิทธิ์การใช้งาน
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="role">บทบาท</Label>
            {isSponsorAdmin ? (
              <>
                <Input
                  id="role"
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
              {state &&
                'fieldErrors' in state &&
                state.fieldErrors?.sponsorId && (
                  <p className="text-sm text-destructive">
                    {state.fieldErrors.sponsorId[0]}
                  </p>
                )}
            </div>
          )}
        </CardContent>
      </Card>

      {state && 'error' in state && !state.fieldErrors && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          <UserPlus className="size-4" />
          {isPending ? 'กำลังสร้าง...' : 'สร้างผู้ใช้'}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard/users">ยกเลิก</Link>
        </Button>
      </div>
    </form>
  )
}
