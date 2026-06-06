'use client'

import { use, useActionState, useEffect, useState } from 'react'
import liff from '@line/liff'
import { fetchAthleteProfile, registerViaLine } from './actions'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  searchParams: Promise<{ eventId?: string; bib?: string }>
}

export default function RegisterPage({ searchParams }: Props) {
  const { eventId = '', bib: bibFromUrl = '' } = use(searchParams)

  const [idToken, setIdToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [liffError, setLiffError] = useState<string | null>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gender, setGender] = useState('')
  const [bib, setBib] = useState(bibFromUrl)

  const [state, action, pending] = useActionState(registerViaLine, null)

  useEffect(() => {
    liff
      .init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! })
      .then(async () => {
        if (!liff.isLoggedIn()) {
          liff.login()
          return
        }
        const token = liff.getIDToken()
        setIdToken(token)
        setReady(true)
      })
      .catch(() => setLiffError('ไม่สามารถเชื่อมต่อ LINE ได้ กรุณาเปิดผ่าน LINE'))
  }, [])

  useEffect(() => {
    if (!idToken || !eventId) return
    fetchAthleteProfile(idToken, eventId).then((profile) => {
      if (!profile) return
      setFirstName(profile.firstName)
      setLastName(profile.lastName)
      setDateOfBirth(profile.dateOfBirth)
      setGender(profile.gender)
      setBib(profile.existingBib ?? bibFromUrl)
    })
  }, [idToken, eventId])

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
    <div className="mx-auto max-w-md p-6">
      <Card>
        <CardHeader>
          <CardTitle>ลงทะเบียน</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <input type="hidden" name="liffIdToken" value={idToken ?? ''} />
            <input type="hidden" name="eventId" value={eventId} />

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

            <div className="space-y-1">
              <Label htmlFor="dateOfBirth">วันเกิด</Label>
              <Input
                id="dateOfBirth"
                name="dateOfBirth"
                type="date"
                required
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
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

            <Button type="submit" className="w-full" disabled={pending || !gender}>
              {pending ? 'กำลังบันทึก...' : 'ยืนยันการลงทะเบียน'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
