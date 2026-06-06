'use client'

import { use, useActionState, useEffect, useState } from 'react'
import liff from '@line/liff'
import { registerViaLine } from './actions'
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
  params: Promise<{ eventId: string }>
  searchParams: Promise<{ bib?: string }>
}

export default function RegisterPage({ params, searchParams }: Props) {
  const { eventId } = use(params)
  const { bib = '' } = use(searchParams)
  const [idToken, setIdToken] = useState<string | null>(null)
  const [firstName, setFirstName] = useState('')
  const [gender, setGender] = useState('')
  const [ready, setReady] = useState(false)
  const [liffError, setLiffError] = useState<string | null>(null)
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
        const profile = await liff.getProfile()
        setIdToken(token)
        setFirstName(profile.displayName.split(' ')[0])
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

  if (state?.ok) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-4xl">✅</p>
        <h1 className="text-xl font-bold">ลงทะเบียนสำเร็จ!</h1>
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
          <CardTitle>ลงทะเบียนนักกีฬา</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <input type="hidden" name="liffIdToken" value={idToken ?? ''} />
            <input type="hidden" name="eventId" value={eventId} />

            <div className="space-y-1">
              <Label>หมายเลข BIB</Label>
              <Input name="bib" value={bib} readOnly className="bg-muted" />
            </div>

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
              <Input id="lastName" name="lastName" required placeholder="นามสกุล" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="dateOfBirth">วันเกิด</Label>
              <Input id="dateOfBirth" name="dateOfBirth" type="date" required />
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

            <Button type="submit" className="w-full" disabled={pending || !gender}>
              {pending ? 'กำลังบันทึก...' : 'ยืนยันการลงทะเบียน'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
