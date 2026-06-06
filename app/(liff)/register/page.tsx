'use client'

import { useActionState, useEffect, useState } from 'react'
import liff from '@line/liff'
import { fetchAthleteProfile, fetchEventInfo, registerViaLine } from './actions'
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
import { Calendar } from 'lucide-react'

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
  'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
  'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

const BE_YEARS = Array.from({ length: 78 }, (_, i) => 2557 - i) // 2557–2480 BE

export default function RegisterPage() {
  const [idToken, setIdToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [liffError, setLiffError] = useState<string | null>(null)
  const [eventId, setEventId] = useState('')
  const [eventInfo, setEventInfo] = useState<{
    eventName: string
    eventLogoUrl: string | null
    description: string | null
  } | null>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [gender, setGender] = useState('')
  const [bib, setBib] = useState('')

  // DOB — separate day/month/year (BE)
  const [dobDay, setDobDay] = useState('')
  const [dobMonth, setDobMonth] = useState('')
  const [dobYear, setDobYear] = useState('') // BE year string

  const dobCe = (() => {
    if (!dobDay || !dobMonth || !dobYear) return ''
    const ceYear = parseInt(dobYear) - 543
    const month = parseInt(dobMonth)
    const day = parseInt(dobDay)
    const date = new Date(ceYear, month - 1, day)
    if (date.getFullYear() !== ceYear || date.getMonth() + 1 !== month || date.getDate() !== day) return ''
    return `${String(ceYear).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  })()

  const [state, action, pending] = useActionState(registerViaLine, null)

  useEffect(() => {
    liff
      .init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! })
      .then(async () => {
        if (!liff.isLoggedIn()) {
          liff.login()
          return
        }
        const params = new URLSearchParams(window.location.search)
        const resolvedEventId = params.get('eventId') ?? ''
        const resolvedBib = params.get('bib') ?? ''
        const token = liff.getIDToken()

        const [profile, info] = await Promise.all([
          resolvedEventId && token ? fetchAthleteProfile(token, resolvedEventId) : null,
          resolvedEventId ? fetchEventInfo(resolvedEventId) : null,
        ])

        if (profile) {
          setFirstName(profile.firstName)
          setLastName(profile.lastName)
          setGender(profile.gender)
          // Parse CE date → BE parts
          if (profile.dateOfBirth) {
            const [ceYear, ceMonth, ceDay] = profile.dateOfBirth.split('-')
            setDobDay(String(parseInt(ceDay)))
            setDobMonth(String(parseInt(ceMonth)))
            setDobYear(String(parseInt(ceYear) + 543))
          }
        }
        setBib(profile?.existingBib ?? resolvedBib)
        setEventInfo(info)
        setEventId(resolvedEventId)
        setIdToken(token)
        setReady(true)
      })
      .catch(() => setLiffError('ไม่สามารถเชื่อมต่อ LINE ได้ กรุณาเปิดผ่าน LINE'))
  }, [])

  if (liffError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-center text-red-600">{liffError}</p>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">กำลังโหลด...</p>
      </div>
    )
  }

  if (!eventId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-center text-red-600">ลิงก์ไม่ถูกต้อง กรุณาขอลิงก์ใหม่จาก LINE OA</p>
      </div>
    )
  }

  if (state?.ok) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-4xl">✅</p>
        <h1 className="text-xl font-bold">
          {state.updated ? 'แก้ไขข้อมูลสำเร็จ!' : 'ลงทะเบียนสำเร็จ!'}
        </h1>
        <p className="text-muted-foreground">
          {state.firstName} · BIB {state.bib}
          <br />
          {state.eventName}
        </p>
        <Button onClick={() => liff.closeWindow()}>ปิดหน้านี้</Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Event Hero */}
      {eventInfo?.eventLogoUrl ? (
        <img
          src={eventInfo.eventLogoUrl}
          alt={eventInfo.eventName}
          className="h-48 w-full object-cover"
        />
      ) : (
        <div className="flex h-32 w-full items-center justify-center bg-muted">
          <Calendar className="size-12 text-muted-foreground" />
        </div>
      )}

      <div className="space-y-6 p-5">
        {/* Event Header */}
        <div>
          <h1 className="text-2xl font-bold">{eventInfo?.eventName ?? 'ลงทะเบียน'}</h1>
          {eventInfo?.description && (
            <p className="mt-3 text-sm leading-relaxed">
              {eventInfo.description}
            </p>
          )}
        </div>

        {/* Form */}
        <form action={action} className="space-y-4">
          <input type="hidden" name="liffIdToken" value={idToken ?? ''} />
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="dateOfBirth" value={dobCe} />

          <div className="space-y-1">
            <Label htmlFor="firstName">ชื่อจริง</Label>
            <Input
              id="firstName"
              name="firstName"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="ชื่อจริง"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="lastName">นามสกุล</Label>
            <Input
              id="lastName"
              name="lastName"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="นามสกุล"
            />
          </div>

          {/* DOB — แยก 3 selects */}
          <div className="space-y-1">
            <Label>วันเกิด (พ.ศ.)</Label>
            <div className="grid grid-cols-3 gap-2">
              <Select value={dobDay} onValueChange={setDobDay}>
                <SelectTrigger>
                  <SelectValue placeholder="วัน" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={dobMonth} onValueChange={setDobMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="เดือน" />
                </SelectTrigger>
                <SelectContent>
                  {THAI_MONTHS.map((name, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={dobYear} onValueChange={setDobYear}>
                <SelectTrigger>
                  <SelectValue placeholder="ปี พ.ศ." />
                </SelectTrigger>
                <SelectContent>
                  {BE_YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>เพศ</Label>
            <Select name="gender" value={gender} onValueChange={setGender} required>
              <SelectTrigger>
                <SelectValue placeholder="เลือกเพศ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">ชาย</SelectItem>
                <SelectItem value="female">หญิง</SelectItem>
                <SelectItem value="other">อื่นๆ</SelectItem>
              </SelectContent>
            </Select>
            <input type="hidden" name="gender" value={gender} />
          </div>

          <div className="rounded-md border-2 border-primary/30 bg-primary/5 p-4 space-y-2">
            <div className="space-y-1">
              <Label htmlFor="bib" className="text-base font-semibold">
                หมายเลข BIB
              </Label>
              <Input
                id="bib"
                name="bib"
                required
                value={bib}
                onChange={(e) => setBib(e.target.value.toUpperCase())}
                placeholder="เช่น A001"
                className="text-lg tracking-widest font-mono"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              ⚠️ เลข BIB จะใช้ในการรับสิทธิ์ฟรี ที่บูธ MACIM-SPORT — กรุณากรอกให้ถูกต้อง
            </p>
          </div>

          {state && !state.ok && (
            <p className="text-sm text-red-600">{state.error}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={pending || !gender || !dobCe}
          >
            {pending ? 'กำลังบันทึก...' : 'ยืนยันการลงทะเบียน'}
          </Button>
        </form>
      </div>
    </div>
  )
}
