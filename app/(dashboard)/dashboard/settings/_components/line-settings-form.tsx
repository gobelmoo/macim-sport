'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { SettingsActionState } from '../actions'
import type { LineSettings } from '@/db/queries/line'

interface Props {
  action: (prev: SettingsActionState, formData: FormData) => Promise<SettingsActionState>
  settings: LineSettings
}

const initialState: SettingsActionState = {}

export function LineSettingsForm({ action, settings }: Props) {
  const [state, formAction, isPending] = useActionState(action, initialState)

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      {state.message && (
        <p className={`text-sm ${state.success ? 'text-green-600' : 'text-destructive'}`}>
          {state.message}
        </p>
      )}

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          name="fallbackEnabled"
          defaultChecked={settings.fallbackEnabled}
          className="size-4 accent-primary"
        />
        <span className="text-sm font-medium">เปิดการตอบกลับอัตโนมัติ (fallback)</span>
      </label>

      <div className="space-y-1.5">
        <Label htmlFor="fallbackMessage">ข้อความตอบกลับ</Label>
        <Textarea
          id="fallbackMessage"
          name="fallbackMessage"
          rows={4}
          defaultValue={settings.fallbackMessage}
          placeholder="เช่น ขณะนี้ยังไม่มีกิจกรรมเปิดรับสมัคร พิมพ์ 'event' เพื่อดูรายการ"
          aria-invalid={!!state.errors?.fallbackMessage}
        />
        <p className="text-xs text-muted-foreground">
          ใช้ตอบเมื่อผู้ใช้พิมพ์ข้อความที่ไม่ตรงคำสั่ง หรือยังไม่มีกิจกรรมเปิดรับสมัคร
        </p>
        {state.errors?.fallbackMessage && (
          <p className="text-sm text-destructive">{state.errors.fallbackMessage[0]}</p>
        )}
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? 'กำลังบันทึก…' : 'บันทึก'}
      </Button>
    </form>
  )
}
