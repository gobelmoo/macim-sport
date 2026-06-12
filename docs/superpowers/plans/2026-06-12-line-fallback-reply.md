# LINE Fallback Auto-Reply Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้ผู้ดูแลตั้งข้อความตอบกลับอัตโนมัติ (fallback) ของ LINE OA สำหรับเคสที่ "ไม่มีข้อมูลตอบ" ได้จากหน้า dashboard พร้อมสวิตช์เปิด/ปิด

**Architecture:** เพิ่มตาราง singleton `line_settings` (typed) เก็บ `fallbackEnabled` + `fallbackMessage`. Webhook อ่านค่าผ่าน query แล้วตอบ text เมื่อเข้าเคส fallback. หน้า `/dashboard/settings` ใช้ server action + `useActionState` แก้ค่า. Decision logic แยกเป็น pure function เพื่อ unit test ได้แบบเดียวกับ test เดิม

**Tech Stack:** Next.js App Router (RSC + server actions), Drizzle ORM + Neon Postgres, Zod, vitest, shadcn/ui

---

## File Structure

- `db/schema/line.ts` — **Modify**: เพิ่ม `lineSettings` table (auto-register ผ่าน `...line` ใน `db/index.ts`)
- `db/migrations/00XX_*.sql` — **Create** (generated): สร้างตาราง `line_settings`
- `lib/line-messages.ts` — **Modify**: เพิ่ม `textMessage(text)` helper
- `lib/line-state.ts` — **Modify**: เพิ่ม `resolveFallbackText()` (pure) + `replyFallback()` + แทนจุด fallback
- `db/queries/line.ts` — **Modify**: เพิ่ม `LineSettings` type, `getLineSettings()`, `updateLineSettings()`
- `app/(dashboard)/dashboard/settings/page.tsx` — **Create**: หน้า settings (server)
- `app/(dashboard)/dashboard/settings/actions.ts` — **Create**: `updateLineSettingsAction`
- `app/(dashboard)/dashboard/settings/_components/line-settings-form.tsx` — **Create**: ฟอร์ม (client)
- `lib/nav.ts` — **Modify**: เพิ่ม nav item "ตั้งค่า LINE"
- `tests/line-messages.test.ts` — **Modify**: test `textMessage`
- `tests/line-state.test.ts` — **Modify**: test `resolveFallbackText`

**Default fallback message constant** (ใช้ซ้ำหลายที่ — กำหนดครั้งเดียวใน `db/queries/line.ts`):
```
'ขณะนี้ไม่มีงานที่เปิดรับลงทะเบียน\nกรุณาติดตามประกาศจากผู้จัดงาน'
```
(เท่ากับข้อความ `no_events` เดิม → พฤติกรรมไม่เปลี่ยนจนกว่าแอดมินจะแก้)

---

## Task 1: เพิ่มตาราง `line_settings` ใน schema

**Files:**
- Modify: `db/schema/line.ts`

- [ ] **Step 1: เพิ่ม table definition**

ต่อท้ายไฟล์ `db/schema/line.ts` (import `text, boolean, timestamp, pgTable` มีอยู่แล้วบรรทัดบนสุด):

```ts
export const lineSettings = pgTable('line_settings', {
  id: text().primaryKey().default('singleton'),
  fallbackEnabled: boolean().notNull().default(true),
  fallbackMessage: text().notNull(),
  updatedAt: timestamp({ mode: 'date' }).defaultNow().notNull(),
})
```

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck`
Expected: PASS (ไม่มี error ใหม่)

- [ ] **Step 3: Commit**

```bash
git add db/schema/line.ts
git commit -m "feat: add line_settings schema table"
```

---

## Task 2: สร้างและ apply migration

**Files:**
- Create (generated): `db/migrations/00XX_*.sql`

- [ ] **Step 1: generate migration**

Run: `pnpm db:generate`
Expected: สร้างไฟล์ `db/migrations/00XX_*.sql` ที่มี `CREATE TABLE "line_settings"` (id, fallback_enabled, fallback_message, updated_at)

- [ ] **Step 2: ตรวจ SQL ที่ generate**

เปิดไฟล์ SQL ใหม่ ยืนยันว่ามี 4 คอลัมน์ และ `"id" text PRIMARY KEY DEFAULT 'singleton'`
(ไม่ต้องเพิ่ม INSERT seed — `getLineSettings()` จะสร้างแถว default เองตอนอ่านครั้งแรกใน Task 4)

- [ ] **Step 3: apply migration**

Run: `pnpm tsx --env-file=.env.local scripts/run-migration.mts`
Expected: `Migration completed successfully`

- [ ] **Step 4: ยืนยันตารางถูกสร้าง**

Run: `pnpm tsx --env-file=.env.local -e "import {neon} from '@neondatabase/serverless'; const sql=neon(process.env.DATABASE_URL); const r=await sql\`select column_name from information_schema.columns where table_name='line_settings' order by column_name\`; console.log(r.map(x=>x.column_name))"`
Expected: `[ 'fallback_enabled', 'fallback_message', 'id', 'updated_at' ]`

- [ ] **Step 5: Commit**

```bash
git add db/migrations
git commit -m "feat: migration for line_settings table"
```

---

## Task 3: helper `textMessage()` ใน line-messages (TDD)

**Files:**
- Modify: `lib/line-messages.ts`
- Test: `tests/line-messages.test.ts`

- [ ] **Step 1: เขียน failing test**

เพิ่มใน `tests/line-messages.test.ts` (เพิ่ม `textMessage` ใน import จาก `@/lib/line-messages`):

```ts
import { textMessage } from '@/lib/line-messages'

describe('textMessage', () => {
  it('สร้าง text message object', () => {
    expect(textMessage('สวัสดี')).toEqual({ type: 'text', text: 'สวัสดี' })
  })
})
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `pnpm test -- tests/line-messages.test.ts`
Expected: FAIL — `textMessage is not a function` / import error

- [ ] **Step 3: เพิ่ม implementation**

ใน `lib/line-messages.ts` เพิ่มฟังก์ชัน (วางใกล้ ๆ `errorMessage`):

```ts
export function textMessage(text: string): LineMessage {
  return { type: 'text', text }
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `pnpm test -- tests/line-messages.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/line-messages.ts tests/line-messages.test.ts
git commit -m "feat: add textMessage helper"
```

---

## Task 4: queries `getLineSettings` / `updateLineSettings`

**Files:**
- Modify: `db/queries/line.ts`

- [ ] **Step 1: เพิ่ม import ตาราง**

แก้บรรทัด import schema ด้านบนของ `db/queries/line.ts`:

```ts
import { lineSessions, lineStateEnum, athleteConsents, lineSettings } from '@/db/schema/line'
```

- [ ] **Step 2: เพิ่ม type + constant + queries**

ต่อท้ายไฟล์ `db/queries/line.ts`:

```ts
export const DEFAULT_FALLBACK_MESSAGE =
  'ขณะนี้ไม่มีงานที่เปิดรับลงทะเบียน\nกรุณาติดตามประกาศจากผู้จัดงาน'

const LINE_SETTINGS_ID = 'singleton'

export interface LineSettings {
  id: string
  fallbackEnabled: boolean
  fallbackMessage: string
  updatedAt: Date
}

export async function getLineSettings(): Promise<LineSettings> {
  const [row] = await db
    .select()
    .from(lineSettings)
    .where(eq(lineSettings.id, LINE_SETTINGS_ID))
    .limit(1)

  if (row) return row

  const [created] = await db
    .insert(lineSettings)
    .values({ id: LINE_SETTINGS_ID, fallbackMessage: DEFAULT_FALLBACK_MESSAGE })
    .onConflictDoNothing()
    .returning()

  if (created) return created

  // แข่งกัน insert พร้อมกัน → onConflictDoNothing ไม่คืนแถว, อ่านซ้ำ
  const [existing] = await db
    .select()
    .from(lineSettings)
    .where(eq(lineSettings.id, LINE_SETTINGS_ID))
    .limit(1)
  return existing
}

export async function updateLineSettings(input: {
  fallbackEnabled: boolean
  fallbackMessage: string
}): Promise<void> {
  await db
    .insert(lineSettings)
    .values({
      id: LINE_SETTINGS_ID,
      fallbackEnabled: input.fallbackEnabled,
      fallbackMessage: input.fallbackMessage,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: lineSettings.id,
      set: {
        fallbackEnabled: input.fallbackEnabled,
        fallbackMessage: input.fallbackMessage,
        updatedAt: new Date(),
      },
    })
}
```

(`eq` import อยู่แล้วในไฟล์)

- [ ] **Step 3: typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add db/queries/line.ts
git commit -m "feat: add getLineSettings/updateLineSettings queries"
```

---

## Task 5: pure function `resolveFallbackText` (TDD)

**Files:**
- Modify: `lib/line-state.ts`
- Test: `tests/line-state.test.ts`

- [ ] **Step 1: เขียน failing test**

เพิ่มใน `tests/line-state.test.ts` (เพิ่ม `resolveFallbackText` ใน import จาก `@/lib/line-state`):

```ts
import { resolveFallbackText } from '@/lib/line-state'

describe('resolveFallbackText', () => {
  it('คืนข้อความเมื่อเปิดและมีข้อความ', () => {
    expect(resolveFallbackText({ fallbackEnabled: true, fallbackMessage: 'hi' })).toBe('hi')
  })
  it('คืน null เมื่อปิด', () => {
    expect(resolveFallbackText({ fallbackEnabled: false, fallbackMessage: 'hi' })).toBeNull()
  })
  it('คืน null เมื่อข้อความว่าง/มีแต่ช่องว่าง', () => {
    expect(resolveFallbackText({ fallbackEnabled: true, fallbackMessage: '   ' })).toBeNull()
  })
  it('trim ช่องว่างหัวท้าย', () => {
    expect(resolveFallbackText({ fallbackEnabled: true, fallbackMessage: ' hi ' })).toBe('hi')
  })
})
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `pnpm test -- tests/line-state.test.ts`
Expected: FAIL — `resolveFallbackText is not a function`

- [ ] **Step 3: เพิ่ม implementation**

ใน `lib/line-state.ts` เพิ่ม (วางใกล้ ๆ `isValidBib`):

```ts
export function resolveFallbackText(settings: {
  fallbackEnabled: boolean
  fallbackMessage: string
}): string | null {
  if (!settings.fallbackEnabled) return null
  const text = settings.fallbackMessage.trim()
  return text.length > 0 ? text : null
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `pnpm test -- tests/line-state.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/line-state.ts tests/line-state.test.ts
git commit -m "feat: add resolveFallbackText pure helper"
```

---

## Task 6: ต่อ `replyFallback` เข้า webhook flow

**Files:**
- Modify: `lib/line-state.ts`

- [ ] **Step 1: เพิ่ม import**

แก้ import ด้านบนของ `lib/line-state.ts`:

```ts
import {
  getActiveEvents,
  getAthleteByLineUserId,
  getRegisteredActiveEventsWithBib,
  getLineSettings,
} from '@/db/queries/line'
```

และเพิ่ม `textMessage` เข้า import จาก `@/lib/line-messages` (เอา `errorMessage` ออกถ้าไม่เหลือที่ใช้แล้ว — ดู Step 3):

```ts
import {
  athleteSummaryFlex,
  textMessage,
  welcomeBackMessage,
  welcomeNewMessage,
} from '@/lib/line-messages'
```

- [ ] **Step 2: เพิ่ม `replyFallback` helper**

ใน `lib/line-state.ts` เพิ่มฟังก์ชัน (หลัง `resolveFallbackText`):

```ts
async function replyFallback(replyToken: string): Promise<void> {
  try {
    const settings = await getLineSettings()
    const text = resolveFallbackText(settings)
    if (text) await replyMessage(replyToken, [textMessage(text)])
  } catch (err) {
    console.error('[replyFallback] failed', err)
  }
}
```

- [ ] **Step 3: แทนจุด fallback ทั้งหมด**

ใน `startFlow` — แทน 2 จุดที่เป็น `await replyMessage(replyToken, [errorMessage('no_events')])`:

จุดที่ 1 (athlete มีอยู่ แต่ไม่มี event ว่าง, `available.length === 0`):
```ts
    if (available.length === 0) {
      await replyFallback(replyToken)
      return
    }
```

จุดที่ 2 (ไม่มี active event เลย):
```ts
  if (allActive.length === 0) {
    await replyFallback(replyToken)
    return
  }
```

ใน `handleText` — แทน `return` เงียบ:
```ts
export async function handleText(
  lineUserId: string,
  text: string,
  replyToken: string,
): Promise<void> {
  if (!TRIGGER_KEYWORDS.has(text.toLowerCase())) {
    await replyFallback(replyToken)
    return
  }
  await startFlow(lineUserId, replyToken)
}
```

- [ ] **Step 4: ตรวจว่า `errorMessage` ยังถูกใช้ที่อื่นไหม**

Run: `grep -rn "errorMessage" lib app`
ถ้าไม่เหลือการใช้ → ลบออกจาก import ของ `lib/line-state.ts` (Step 1 ทำแล้ว) แต่ **คงฟังก์ชัน `errorMessage` ใน `lib/line-messages.ts` ไว้** (ไม่ลบ)

- [ ] **Step 5: typecheck + test**

Run: `pnpm typecheck && pnpm test`
Expected: PASS ทั้งหมด (ไม่มี unused import warning)

- [ ] **Step 6: Commit**

```bash
git add lib/line-state.ts
git commit -m "feat: reply configurable fallback on no-data cases"
```

---

## Task 7: server action `updateLineSettingsAction`

**Files:**
- Create: `app/(dashboard)/dashboard/settings/actions.ts`

- [ ] **Step 1: เขียน action**

สร้าง `app/(dashboard)/dashboard/settings/actions.ts`:

```ts
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS } from '@/lib/rbac'
import { updateLineSettings } from '@/db/queries/line'

const settingsSchema = z.object({
  fallbackEnabled: z.boolean(),
  fallbackMessage: z
    .string()
    .max(2000, 'ข้อความยาวเกินไป (สูงสุด 2000 ตัวอักษร)'),
})

export type SettingsActionState = {
  errors?: Record<string, string[]>
  message?: string
  success?: boolean
}

export async function updateLineSettingsAction(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const authz = { role: session.user.role, permissions: session.user.permissions }
  if (!canAccess(PERMISSIONS.USER_MANAGE, authz)) {
    return { message: 'ไม่มีสิทธิ์แก้ไขการตั้งค่า' }
  }

  const parsed = settingsSchema.safeParse({
    fallbackEnabled: formData.get('fallbackEnabled') === 'on',
    fallbackMessage: (formData.get('fallbackMessage') ?? '').toString(),
  })
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  await updateLineSettings(parsed.data)
  revalidatePath('/dashboard/settings')
  return { success: true, message: 'บันทึกการตั้งค่าแล้ว' }
}
```

> หมายเหตุ: ใช้ `parsed.error.flatten().fieldErrors` ให้ตรงกับ `sponsors/actions.ts:60` (โปรเจกต์ใช้ zod v4 แต่ยังเรียก `.flatten()`)

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/dashboard/settings/actions.ts"
git commit -m "feat: add updateLineSettingsAction"
```

---

## Task 8: ฟอร์ม client `line-settings-form.tsx`

**Files:**
- Create: `app/(dashboard)/dashboard/settings/_components/line-settings-form.tsx`

- [ ] **Step 1: เขียนฟอร์ม**

สร้าง `app/(dashboard)/dashboard/settings/_components/line-settings-form.tsx`:

```tsx
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
```

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/dashboard/settings/_components/line-settings-form.tsx"
git commit -m "feat: add line settings form component"
```

---

## Task 9: หน้า settings `page.tsx`

**Files:**
- Create: `app/(dashboard)/dashboard/settings/page.tsx`

- [ ] **Step 1: เขียนหน้า**

สร้าง `app/(dashboard)/dashboard/settings/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
import { auth } from '@/auth'
import { canAccess, PERMISSIONS } from '@/lib/rbac'
import { getLineSettings } from '@/db/queries/line'
import { LineSettingsForm } from './_components/line-settings-form'
import { updateLineSettingsAction } from './actions'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const authz = { role: session.user.role, permissions: session.user.permissions }
  if (!canAccess(PERMISSIONS.USER_MANAGE, authz)) {
    redirect('/dashboard')
  }

  const settings = await getLineSettings()

  return (
    <main className="p-6 lg:p-8">
      <div className="mb-6 flex items-center gap-3">
        <MessageSquare className="size-5 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-semibold">ตั้งค่า LINE</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            ข้อความตอบกลับอัตโนมัติเมื่อไม่เข้าเงื่อนไข
          </p>
        </div>
      </div>

      <LineSettingsForm action={updateLineSettingsAction} settings={settings} />
    </main>
  )
}
```

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/dashboard/settings/page.tsx"
git commit -m "feat: add LINE settings dashboard page"
```

---

## Task 10: เพิ่ม nav item

**Files:**
- Modify: `lib/nav.ts`

- [ ] **Step 1: เพิ่ม import icon**

แก้ import บนสุดของ `lib/nav.ts` — เพิ่ม `MessageSquare`:

```ts
import {
  Activity,
  CalendarDays,
  Home,
  BarChart3,
  Building2,
  MessageSquare,
  Users,
} from 'lucide-react'
```

- [ ] **Step 2: เพิ่ม item ในกลุ่ม "ระบบ"**

ในกลุ่ม `label: 'ระบบ'` เพิ่ม item ต่อจาก "รายงาน":

```ts
      {
        title: 'ตั้งค่า LINE',
        href: '/dashboard/settings',
        icon: MessageSquare,
        anyOf: ['user:manage'],
      },
```

- [ ] **Step 3: typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add lib/nav.ts
git commit -m "feat: add LINE settings nav item"
```

---

## Task 11: ตรวจสอบรวม + manual verify

- [ ] **Step 1: รัน lint + typecheck + test ทั้งหมด**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: PASS ทั้งหมด

- [ ] **Step 2: รัน dev แล้วเปิดหน้า settings**

Run: `pnpm dev` แล้วเปิด `http://localhost:3000/dashboard/settings` (ล็อกอินเป็น owner/manager)
Expected:
- เห็นฟอร์ม: checkbox ติ๊กอยู่ (default true) + textarea มีข้อความ no_events เดิม
- แก้ข้อความ + กดบันทึก → ขึ้น "บันทึกการตั้งค่าแล้ว" สีเขียว
- refresh → ค่าที่บันทึกคงอยู่
- nav ซ้ายมี "ตั้งค่า LINE"

- [ ] **Step 3: ทดสอบ webhook fallback (จริงผ่าน LINE หรือ manual)**

ทางเลือก A (LINE จริง): พิมพ์ข้อความมั่ว ๆ (ไม่ใช่ `event`/`promotion`) เข้า OA → ได้ข้อความ fallback
ทางเลือก B: ปิด toggle → บันทึก → พิมพ์มั่ว → ไม่มีข้อความตอบ (เงียบ)

- [ ] **Step 4: ยืนยันผลด้วยตา** — บันทึกผลการทดสอบ (ผ่าน/ไม่ผ่าน) ก่อนปิดงาน

---

## Self-Review Notes

- **Spec coverage:** schema (Task 1-2), queries (Task 4), webhook ทุกเคส no-data (Task 5-6), หน้า dashboard + action + form (Task 7-9), nav + สิทธิ์ user:manage (Task 10), text-only + toggle (Task 8) — ครบทุกข้อใน spec
- **Default-preserve behavior:** `DEFAULT_FALLBACK_MESSAGE` = ข้อความ no_events เดิม, seed ผ่าน create-on-read ใน `getLineSettings` (Task 4) — ไม่ต้องแก้ SQL มือ
- **Type consistency:** `LineSettings`, `getLineSettings`, `updateLineSettings`, `resolveFallbackText`, `textMessage`, `SettingsActionState`, `updateLineSettingsAction` ชื่อตรงกันทุก task
- **errorMessage:** คงไว้ใน line-messages.ts (ไม่ลบ), เอาออกจาก import line-state.ts เท่านั้น (Task 6 Step 4 ตรวจ grep)
