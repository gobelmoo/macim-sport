# LINE Auto-Reply Master Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่ม master switch บน dashboard เพื่อปิด/เปิดข้อความตอบกลับอัตโนมัติของ LINE bot ทั้งหมด

**Architecture:** เพิ่มคอลัมน์ `autoReplyEnabled` ในตาราง singleton `line_settings` แล้ว gate ที่ทางเข้า webhook — เมื่อปิด webhook ยัง verify signature + ตอบ 200 แต่ไม่ส่ง reply ใดๆ UI เพิ่ม toggle บนสุดของฟอร์ม settings เดิม และ disable ส่วน fallback เมื่อ master ปิด

**Tech Stack:** Next.js App Router, drizzle-orm (PostgreSQL), Zod, React (useActionState), Vitest

## Global Constraints

- คอลัมน์ DB ใช้ชื่อ camelCase ตรงตาม property (ไม่มี casing config) — เช่น `autoReplyEnabled`
- `autoReplyEnabled` default = `true` เสมอ เพื่อคงพฤติกรรมปัจจุบันหลัง migration
- ข้อความ UI เป็นภาษาไทย
- Migration สร้างด้วย `pnpm db:generate` (ห้ามแก้ไฟล์ SQL ด้วยมือ) — ไฟล์ถัดไปคือ `0007_*`
- รัน test ด้วย `pnpm test`; typecheck ด้วย `pnpm typecheck`
- Commit message ลงท้ายด้วย: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 1: DB layer — เพิ่มคอลัมน์ autoReplyEnabled

**Files:**
- Modify: `db/schema/line.ts:35-40` (ตาราง `lineSettings`)
- Modify: `db/queries/line.ts:287-342` (interface `LineSettings` + `updateLineSettings`)
- Create: `db/migrations/0007_*.sql` (สร้างโดย `pnpm db:generate`)

**Interfaces:**
- Produces: `interface LineSettings { id: string; autoReplyEnabled: boolean; fallbackEnabled: boolean; fallbackMessage: string; updatedAt: Date }`
- Produces: `updateLineSettings(input: { autoReplyEnabled: boolean; fallbackEnabled: boolean; fallbackMessage: string }): Promise<void>`
- Produces: `getLineSettings(): Promise<LineSettings>` (ส่งคืนค่า `autoReplyEnabled` ด้วย — ค่า default จาก column)

- [ ] **Step 1: เพิ่มคอลัมน์ใน schema**

ใน `db/schema/line.ts` แก้ตาราง `lineSettings` (เพิ่มบรรทัด `autoReplyEnabled` ก่อน `fallbackEnabled`):

```ts
export const lineSettings = pgTable('line_settings', {
  id: text().primaryKey().default('singleton'),
  autoReplyEnabled: boolean().notNull().default(true),
  fallbackEnabled: boolean().notNull().default(true),
  fallbackMessage: text().notNull(),
  updatedAt: timestamp({ mode: 'date' }).defaultNow().notNull(),
})
```

- [ ] **Step 2: อัปเดต interface + query ใน db/queries/line.ts**

แก้ `interface LineSettings` (บรรทัด ~287):

```ts
export interface LineSettings {
  id: string
  autoReplyEnabled: boolean
  fallbackEnabled: boolean
  fallbackMessage: string
  updatedAt: Date
}
```

แก้ signature และ body ของ `updateLineSettings` (บรรทัด ~322):

```ts
export async function updateLineSettings(input: {
  autoReplyEnabled: boolean
  fallbackEnabled: boolean
  fallbackMessage: string
}): Promise<void> {
  await db
    .insert(lineSettings)
    .values({
      id: LINE_SETTINGS_ID,
      autoReplyEnabled: input.autoReplyEnabled,
      fallbackEnabled: input.fallbackEnabled,
      fallbackMessage: input.fallbackMessage,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: lineSettings.id,
      set: {
        autoReplyEnabled: input.autoReplyEnabled,
        fallbackEnabled: input.fallbackEnabled,
        fallbackMessage: input.fallbackMessage,
        updatedAt: new Date(),
      },
    })
}
```

`getLineSettings` ไม่ต้องแก้ — การ insert default ใช้ column default (`autoReplyEnabled = true`) และ `select()` คืนทุกคอลัมน์อยู่แล้ว

- [ ] **Step 3: สร้าง migration**

Run: `pnpm db:generate`
Expected: สร้างไฟล์ `db/migrations/0007_*.sql` ที่มี `ALTER TABLE "line_settings" ADD COLUMN "autoReplyEnabled" boolean DEFAULT true NOT NULL;`

ตรวจไฟล์ที่ได้ว่ามี `ADD COLUMN "autoReplyEnabled"` และ `DEFAULT true NOT NULL`

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: ไม่มี error (ผ่าน)

- [ ] **Step 5: Commit**

```bash
git add db/schema/line.ts db/queries/line.ts db/migrations/
git commit -m "feat: add autoReplyEnabled column to line_settings

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Webhook gate — pure helper + wiring

**Files:**
- Modify: `lib/line-state.ts:21-32` (เพิ่ม helper `shouldAutoReply` ใกล้ `resolveFallbackText`)
- Modify: `app/api/line/webhook/route.ts:2-3,31-37` (import + gate)
- Test: `tests/line-state.test.ts`

**Interfaces:**
- Consumes: `getLineSettings(): Promise<LineSettings>` จาก Task 1
- Produces: `shouldAutoReply(settings: { autoReplyEnabled: boolean }): boolean`

- [ ] **Step 1: เขียน failing test**

เพิ่มใน `tests/line-state.test.ts` — แก้บรรทัด import บนสุดเป็น:

```ts
import { isValidBib, resolveFallbackText, shouldAutoReply } from '@/lib/line-state'
```

แล้วเพิ่ม describe block ท้ายไฟล์:

```ts
describe('shouldAutoReply', () => {
  it('คืน true เมื่อเปิด', () => {
    expect(shouldAutoReply({ autoReplyEnabled: true })).toBe(true)
  })
  it('คืน false เมื่อปิด', () => {
    expect(shouldAutoReply({ autoReplyEnabled: false })).toBe(false)
  })
})
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `pnpm test -- tests/line-state.test.ts`
Expected: FAIL — `shouldAutoReply is not a function` / import error

- [ ] **Step 3: เพิ่ม helper**

ใน `lib/line-state.ts` เพิ่มหลังฟังก์ชัน `isValidBib` (บรรทัด ~23):

```ts
export function shouldAutoReply(settings: { autoReplyEnabled: boolean }): boolean {
  return settings.autoReplyEnabled
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `pnpm test -- tests/line-state.test.ts`
Expected: PASS ทุก test

- [ ] **Step 5: Wire เข้า webhook route**

ใน `app/api/line/webhook/route.ts` แก้ import (บรรทัด 3):

```ts
import { handlePostback, handleText, startFlow, shouldAutoReply } from '@/lib/line-state'
```

เพิ่ม import query บนสุด (หลังบรรทัด 3):

```ts
import { getLineSettings } from '@/db/queries/line'
```

แล้วเพิ่ม gate หลังบล็อกเช็ค `Array.isArray(payload.events)` (หลังบรรทัด 35 เดิม ก่อน `const results = await Promise.allSettled`):

```ts
  const settings = await getLineSettings()
  if (!shouldAutoReply(settings)) {
    return NextResponse.json({ ok: true })
  }
```

- [ ] **Step 6: Typecheck + รัน test ทั้งหมด**

Run: `pnpm typecheck && pnpm test`
Expected: ผ่านทั้งหมด

- [ ] **Step 7: Commit**

```bash
git add lib/line-state.ts app/api/line/webhook/route.ts tests/line-state.test.ts
git commit -m "feat: gate LINE webhook replies on autoReplyEnabled

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Server action — รับ/บันทึก autoReplyEnabled

**Files:**
- Modify: `app/(dashboard)/dashboard/settings/actions.ts:10-15,35-43`

**Interfaces:**
- Consumes: `updateLineSettings({ autoReplyEnabled, fallbackEnabled, fallbackMessage })` จาก Task 1
- Produces: action เดิม `updateLineSettingsAction` (signature ไม่เปลี่ยน) บันทึก `autoReplyEnabled` เพิ่ม

- [ ] **Step 1: เพิ่มฟิลด์ใน schema**

ใน `app/(dashboard)/dashboard/settings/actions.ts` แก้ `settingsSchema` (บรรทัด 10):

```ts
const settingsSchema = z.object({
  autoReplyEnabled: z.boolean(),
  fallbackEnabled: z.boolean(),
  fallbackMessage: z
    .string()
    .max(2000, 'ข้อความยาวเกินไป (สูงสุด 2000 ตัวอักษร)'),
})
```

- [ ] **Step 2: อ่านจาก FormData**

แก้ `safeParse` (บรรทัด 35):

```ts
  const parsed = settingsSchema.safeParse({
    autoReplyEnabled: formData.get('autoReplyEnabled') === 'on',
    fallbackEnabled: formData.get('fallbackEnabled') === 'on',
    fallbackMessage: (formData.get('fallbackMessage') ?? '').toString(),
  })
```

`updateLineSettings(parsed.data)` (บรรทัด 43) ไม่ต้องแก้ — `parsed.data` มี 3 ฟิลด์ตรง signature ใหม่แล้ว

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: ผ่าน

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/dashboard/settings/actions.ts"
git commit -m "feat: persist autoReplyEnabled in settings action

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: UI — master toggle + disable fallback เมื่อปิด

**Files:**
- Modify: `app/(dashboard)/dashboard/settings/_components/line-settings-form.tsx`

**Interfaces:**
- Consumes: `settings: LineSettings` (มี `autoReplyEnabled`) จาก Task 1; action จาก Task 3

- [ ] **Step 1: เพิ่ม client state + master toggle + disable fallback**

แทนที่ทั้งไฟล์ `app/(dashboard)/dashboard/settings/_components/line-settings-form.tsx` ด้วย:

```tsx
'use client'

import { useActionState, useState } from 'react'
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
  const [autoReply, setAutoReply] = useState(settings.autoReplyEnabled)

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      {state.message && (
        <p className={`text-sm ${state.success ? 'text-green-600' : 'text-destructive'}`}>
          {state.message}
        </p>
      )}

      <div className="space-y-1.5 rounded-md border p-4">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            name="autoReplyEnabled"
            checked={autoReply}
            onChange={(e) => setAutoReply(e.target.checked)}
            className="size-4 accent-primary"
          />
          <span className="text-sm font-medium">เปิดการตอบกลับอัตโนมัติของบอท</span>
        </label>
        <p className="text-xs text-muted-foreground">
          {autoReply
            ? 'บอทจะตอบกลับข้อความตามปกติ'
            : 'ปิดอยู่ — บอทจะไม่ส่งข้อความใดๆ จนกว่าจะเปิดอีกครั้ง'}
        </p>
      </div>

      <fieldset
        disabled={!autoReply}
        className={`space-y-5 ${autoReply ? '' : 'opacity-50'}`}
      >
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
      </fieldset>

      <Button type="submit" disabled={isPending}>
        {isPending ? 'กำลังบันทึก…' : 'บันทึก'}
      </Button>
    </form>
  )
}
```

หมายเหตุ: `<fieldset disabled>` ทำให้ checkbox `fallbackEnabled` และ textarea ไม่ถูกส่งใน FormData เมื่อ master ปิด แต่ Task 3 อ่านด้วย `=== 'on'` (เป็น `false`/ค่าว่างเมื่อ disabled) ซึ่งปลอดภัย — ค่าที่บันทึกไว้ก่อนหน้ายังอยู่ในฐานข้อมูล จะแสดงกลับเมื่อเปิด master อีกครั้ง (หน้า revalidate หลังบันทึก)

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: ผ่าน

- [ ] **Step 3: ตรวจด้วยตา (dev server)**

Run: `pnpm dev` แล้วเปิด `/dashboard/settings`
Expected:
- มี toggle "เปิดการตอบกลับอัตโนมัติของบอท" บนสุด
- เมื่อ uncheck → ส่วน fallback จางลงและกดไม่ได้, ข้อความเปลี่ยนเป็น "ปิดอยู่ — บอทจะไม่ส่งข้อความใดๆ…"
- กดบันทึกแล้วขึ้น "บันทึกการตั้งค่าแล้ว"

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/dashboard/settings/_components/line-settings-form.tsx"
git commit -m "feat: add bot auto-reply master toggle to settings UI

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Data model (autoReplyEnabled column, default true) → Task 1 ✓
- Webhook gate (จุดเดียวที่ทางเข้า + pure helper) → Task 2 ✓
- UI toggle บนสุด + disable fallback → Task 4 ✓
- Server action ขยาย schema → Task 3 ✓
- Testing (`shouldAutoReply`, ไม่แตะ `resolveFallbackText`) → Task 2 ✓

**Type consistency:** `LineSettings`/`updateLineSettings` signature (Task 1) ตรงกับที่ใช้ใน webhook (Task 2), action (Task 3), form (Task 4) — ใช้ชื่อ `autoReplyEnabled` ตลอด ✓

**Placeholder scan:** ไม่มี TBD/TODO — โค้ดครบทุก step ✓
