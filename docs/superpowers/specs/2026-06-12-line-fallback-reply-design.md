# LINE Fallback Auto-Reply — ตั้งค่าได้จากหน้าเว็บ

วันที่: 2026-06-12

## ปัญหา

ปัจจุบันเมื่อผู้ใช้ส่งข้อความเข้า LINE OA แล้ว "ไม่เข้าเงื่อนไข" ระบบจะเงียบหรือส่งข้อความ
hardcode:

- `lib/line-state.ts:77` — พิมพ์ข้อความที่ไม่ใช่ keyword (`event`/`promotion`) → `return` เงียบ ไม่ตอบอะไร
- `lib/line-state.ts` — ไม่มี event เปิดรับสมัคร → ส่ง `errorMessage('no_events')` (hardcode 2 จุด)

ต้องการให้ผู้ดูแลตั้งข้อความตอบกลับอัตโนมัติ (fallback) สำหรับเคสเหล่านี้ได้จากหน้า dashboard
โดยไม่ต้องแก้โค้ด/redeploy

## เป้าหมาย

- เก็บข้อความ fallback + สวิตช์เปิด/ปิด ใน DB
- ตอบ fallback ใน **ทุกเคสที่ไม่มีข้อมูลตอบ** (พิมพ์ไม่ตรง keyword, ไม่มี event เปิด)
- จัดการได้จากหน้า dashboard ใหม่ `/dashboard/settings` (สิทธิ์ระดับแอดมินระบบ)
- รูปแบบข้อความ: **ข้อความล้วน (text)** เท่านั้น

### Non-goals (YAGNI)

- ไม่ทำ rich/flex message สำหรับ fallback
- ไม่แยกข้อความ fallback ตามเคส — ใช้ข้อความเดียวครอบทุกเคส
- ไม่ทำหน้า settings รวมสำหรับ config อื่น ๆ (ทำเฉพาะ LINE fallback)

## แนวทางที่เลือก: ตาราง singleton แบบ typed

เลือกตาราง `line_settings` ที่มีคอลัมน์ชัดเจน (type-safe ตรงสไตล์ drizzle เดิม) แทน key-value
generic หรือ env var (แก้ runtime บนเว็บไม่ได้)

## ดีไซน์

### 1. Schema — `db/schema/line.ts` (เพิ่มในไฟล์เดิม)

```ts
export const lineSettings = pgTable('line_settings', {
  id: text().primaryKey().default('singleton'),   // บังคับแถวเดียว
  fallbackEnabled: boolean().default(true).notNull(),
  fallbackMessage: text().notNull(),
  updatedAt: timestamp({ mode: 'date' }).defaultNow().notNull(),
})
```

- ค่า seed เริ่มต้นของ `fallbackMessage` = ข้อความ `no_events` เดิม
  (`'ขณะนี้ไม่มีงานที่เปิดรับลงทะเบียน\nกรุณาติดตามประกาศจากผู้จัดงาน'`)
  → พฤติกรรมไม่เปลี่ยนจนกว่าแอดมินจะแก้

### 2. Queries — `db/queries/line.ts` (เพิ่ม)

- `getLineSettings()` → คืนแถว singleton; ถ้ายังไม่มี ให้ insert ค่า default แล้วคืน
  (กัน edge case ที่ migration seed ไม่ทำงาน)
- `updateLineSettings(input: { fallbackEnabled: boolean; fallbackMessage: string })`
  → upsert แถว singleton, อัปเดต `updatedAt`

### 3. Webhook logic — `lib/line-state.ts`

เพิ่ม helper:

```ts
async function replyFallback(replyToken: string): Promise<void> {
  const s = await getLineSettings()
  if (s.fallbackEnabled && s.fallbackMessage.trim()) {
    await replyMessage(replyToken, [textMessage(s.fallbackMessage)])
  }
  // ถ้าปิดอยู่ หรือข้อความว่าง → เงียบ (ไม่ตอบ)
}
```

(ใช้ helper `textMessage()` จาก `lib/line-messages.ts` — เพิ่มถ้ายังไม่มี)

แก้จุด "ไม่มีข้อมูลตอบ" ให้เรียก `replyFallback`:

- `handleText` — เดิม `if (!TRIGGER_KEYWORDS.has(...)) return` → เปลี่ยนเป็นเรียก `replyFallback(replyToken)`
- `startFlow` — จุดที่ส่ง `errorMessage('no_events')` (กรณี athlete ไม่มี event ว่าง + กรณีไม่มี
  active event) → เปลี่ยนเป็น `replyFallback(replyToken)`

จุดที่ **มีข้อมูล** (welcomeNew / welcomeBack / athleteSummaryFlex) คงเดิมไม่แตะ

> หมายเหตุ: `errorMessage('no_events')` จะไม่ถูกเรียกจาก flow นี้อีก แต่คงฟังก์ชันไว้
> (ไม่ลบ เผื่อมีการอ้างอิงอื่น — ตรวจ grep ตอน implement)

### 4. Dashboard — หน้าใหม่ `/dashboard/settings`

- **Nav** (`lib/nav.ts`) — เพิ่ม item "ตั้งค่า LINE" ในกลุ่ม "ระบบ", `anyOf: ['user:manage']`
  ใช้ icon ที่เหมาะ (เช่น `MessageSquare` หรือ `Settings`)
- **`app/(dashboard)/dashboard/settings/page.tsx`** (server component)
  - `auth()` + เช็ค `canAccess(USER_MANAGE)` ไม่ผ่าน → redirect
  - โหลด `getLineSettings()` ส่งเป็น prop ให้ฟอร์ม
- **`_components/line-settings-form.tsx`** (client)
  - toggle เปิด/ปิด (`fallbackEnabled`)
  - textarea (`fallbackMessage`)
  - ปุ่มบันทึก — ใช้แพตเทิร์น `useActionState` เหมือน `sponsor-form.tsx`
  - แสดง error/success message
- **`app/(dashboard)/dashboard/settings/actions.ts`**
  - `updateLineSettingsAction(prevState, formData)`:
    `auth()` → `canAccess(USER_MANAGE)` → zod validate → `updateLineSettings()` →
    `revalidatePath('/dashboard/settings')`
  - zod: `fallbackMessage` max length (เช่น 1000 ตามลิมิต LINE 5000 แต่เผื่อ),
    `fallbackEnabled` boolean

### 5. สิทธิ์

ใช้ `PERMISSIONS.USER_MANAGE` (`user:manage`) — สิทธิ์ระดับแอดมินระบบ MACIM
(owner ผ่าน `*`, manager มีใน list; ฝั่ง sponsor ไม่มี) ไม่ต้องเพิ่ม permission ใหม่

### 6. Migration

- `pnpm db:generate` สร้าง SQL สำหรับตาราง `line_settings`
- เพิ่ม seed แถว default (id `singleton`, message = ข้อความ no_events เดิม) —
  ใส่ใน migration SQL (`INSERT ... ON CONFLICT DO NOTHING`) หรือ seed script
- apply ตามแนวทาง migration ของโปรเจกต์

## Data flow

```
ผู้ใช้พิมพ์ข้อความ → webhook → handleText/startFlow
  ├─ เข้าเงื่อนไข (keyword/มี event)  → flex/welcome เดิม
  └─ ไม่เข้าเงื่อนไข                   → replyFallback()
                                          ├─ getLineSettings()
                                          ├─ enabled && message → ส่ง text
                                          └─ ปิด/ว่าง           → เงียบ

แอดมิน → /dashboard/settings → form → updateLineSettingsAction → updateLineSettings() → DB
```

## Error handling

- `getLineSettings()` ภายใน `replyFallback` — ถ้า query ล้มเหลว ให้ catch แล้วเงียบ
  (ไม่ throw ออกจาก webhook handler เพราะ `Promise.allSettled` จับอยู่แล้ว แต่กันไว้ดีกว่า)
- action ฝั่ง dashboard — validation error คืนผ่าน state, แสดงในฟอร์ม

## Testing

- unit: `replyFallback` — enabled+message → ส่ง, disabled → ไม่ส่ง, message ว่าง → ไม่ส่ง
- unit: `handleText` พิมพ์ไม่ตรง keyword → เรียก fallback
- query: `getLineSettings` สร้าง default เมื่อยังไม่มีแถว; `updateLineSettings` upsert ถูกต้อง
- (ถ้ามี integration) action validate + update
