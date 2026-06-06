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

type Step = 'bib1' | 'bib2' | 'profile'

function StepDots({ step }: { step: Step }) {
  const filled = step === 'bib1' ? 1 : step === 'bib2' ? 2 : 3
  return (
    <div className="flex gap-2 justify-center mb-4">
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className={`h-2 w-2 rounded-full ${n <= filled ? 'bg-primary' : 'bg-muted'}`}
        />
      ))}
    </div>
  )
}

export default function RegisterPage({ searchParams }: Props) {
  const { eventId = '', bib: bibFromUrl = '' } = use(searchParams)

  // LIFF
  const [idToken, setIdToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [liffError, setLiffError] = useState<string | null>(null)

  // Steps
  const [step, setStep] = useState<Step>('bib1')
  const [bib1, setBib1] = useState(bibFromUrl)
  const [bib2, setBib2] = useState('')
  const [confirmedBib, setConfirmedBib] = useState('')
  const [bibError, setBibError] = useState('')

  // Profile (controlled, pre-fillable)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gender, setGender] = useState('')

  // Form action
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
      setBib1(profile.existingBib ?? bibFromUrl)
      // bib2 intentionally left empty — user must re-type
      setFirstName(profile.firstName)
      setLastName(profile.lastName)
      setDateOfBirth(profile.dateOfBirth)
      setGender(profile.gender)
    })
  }, [idToken, eventId])

  function handleBib1Next() {
    const trimmed = bib1.trim()
    if (!trimmed) {
      setBibError('กรุณากรอกหมายเลข BIB')
      return
    }
    if (!/^[A-Za-z0-9\-]{1,10}$/.test(trimmed)) {
      setBibError('BIB ต้องมี 1–10 ตัว (ตัวเลข / อักษรอังกฤษ / -)')
      return
    }
    setBibError('')
    setBib2('')
    setStep('bib2')
  }

  function handleBib2Confirm() {
    if (bib2.trim() !== bib1.trim()) {
      setBibError('หมายเลข BIB ไม่ตรงกัน กรุณากรอกใหม่')
      setBib2('')
      return
    }
    setConfirmedBib(bib1.trim())
    setBibError('')
    setStep('profile')
  }

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

  if (step === 'bib1') {
    return (
      <div className="mx-auto max-w-md p-6">
        <Card>
          <CardHeader>
            <StepDots step={step} />
            <CardTitle>หมายเลข BIB</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              BIB ของคุณใช้รับสิทธิ์ฟรีที่บูธ MACIM-SPORT กรุณากรอกให้ถูกต้อง
            </p>
            <div className="space-y-1">
              <Label htmlFor="bib1">หมายเลข BIB</Label>
              <Input
                id="bib1"
                value={bib1}
                onChange={(e) => {
                  setBib1(e.target.value.toUpperCase())
                  setBibError('')
                }}
                placeholder="เช่น A001"
                className="text-lg tracking-widest font-mono"
              />
            </div>
            {bibError && <p className="text-sm text-red-600">{bibError}</p>}
            <Button className="w-full" onClick={handleBib1Next}>
              ถัดไป →
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (step === 'bib2') {
    return (
      <div className="mx-auto max-w-md p-6">
        <Card>
          <CardHeader>
            <StepDots step={step} />
            <CardTitle>ยืนยันหมายเลข BIB</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              กรุณากรอกหมายเลข BIB อีกครั้งเพื่อยืนยันความถูกต้อง
            </p>
            <div className="space-y-1">
              <Label htmlFor="bib2">ยืนยันหมายเลข BIB</Label>
              <Input
                id="bib2"
                value={bib2}
                onChange={(e) => {
                  setBib2(e.target.value.toUpperCase())
                  setBibError('')
                }}
                placeholder="กรอกอีกครั้ง"
                className="text-lg tracking-widest font-mono"
              />
            </div>
            {bibError && <p className="text-sm text-red-600">{bibError}</p>}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setBibError('')
                  setStep('bib1')
                }}
              >
                ← กลับ
              </Button>
              <Button className="flex-1" onClick={handleBib2Confirm}>
                ยืนยัน →
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // step === 'profile'
  return (
    <div className="mx-auto max-w-md p-6">
      <Card>
        <CardHeader>
          <StepDots step={step} />
          <CardTitle>ข้อมูลส่วนตัว</CardTitle>
        </CardHeader>
        <CardContent>
          {/* BIB badge */}
          <div className="mb-4 rounded-md bg-muted px-3 py-2 text-sm">
            BIB: <span className="font-mono font-bold tracking-widest">{confirmedBib}</span>
            <span className="ml-2 text-xs text-muted-foreground">· ใช้รับสิทธิ์ฟรีที่บูธ MACIM-SPORT</span>
          </div>

          <form action={action} className="space-y-4">
            <input type="hidden" name="liffIdToken" value={idToken ?? ''} />
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="bib" value={confirmedBib} />

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

            {state && !state.ok && (
              <p className="text-sm text-red-600">{state.error}</p>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setBib2('')
                  setBibError('')
                  setStep('bib2')
                }}
                disabled={pending}
              >
                ← กลับ
              </Button>
              <Button type="submit" className="flex-1" disabled={pending || !gender}>
                {pending ? 'กำลังบันทึก...' : 'ยืนยันการลงทะเบียน'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
