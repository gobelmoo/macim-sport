# Design: Master Switch ปิดข้อความอัตโนมัติ LINE

วันที่: 2026-06-17

## ปัญหา / เป้าหมาย

ผู้ดูแลต้องการปุ่มบนเว็บ (dashboard) เพื่อ **ปิดการตอบกลับอัตโนมัติของ LINE bot ทั้งหมด** ชั่วคราวเมื่อต้องการ
(เช่น ช่วงต้องการตอบมือเอง หรือไม่ต้องการให้บอทส่งข้อความใดๆ) แล้วเปิดกลับได้ภายหลัง

flag `fallbackEnabled` ที่มีอยู่เดิมคุมเฉพาะข้อความ fallback (กรณีไม่ตรงคำสั่ง / ไม่มีกิจกรรม) เท่านั้น
— ข้อความต้อนรับ (welcome) และ flex สรุปข้อมูลยังถูกส่งอยู่ จึงต้องมี master switch แยกที่ครอบทุกกรณี

## ขอบเขต

- **ในขอบเขต:** เพิ่ม master switch `autoReplyEnabled` ที่เมื่อปิดแล้ว webhook จะไม่ส่งข้อความตอบกลับใดๆ
  (welcome / flex / fallback / postback reply)
- **นอกขอบเขต:** การลงทะเบียนผ่าน LIFF (server action คนละ route — ไม่กระทบ),
  การปิด webhook ระดับ LINE Developers Console, การตั้งเวลาเปิด/ปิดอัตโนมัติ

## พฤติกรรมที่ต้องการ

เมื่อ `autoReplyEnabled === false`:
- webhook ยัง verify signature และตอบ HTTP 200 ตามปกติ (LINE จะไม่ retry)
- ไม่มีการเรียก `replyMessage` ใดๆ — บอทเงียบสนิททุกกรณี
- การลงทะเบียนผ่าน LIFF ทำงานได้ตามปกติ

เมื่อ `autoReplyEnabled === true` (ค่าเริ่มต้น): พฤติกรรมเหมือนปัจจุบันทุกประการ

## Data model

เพิ่มคอลัมน์ในตาราง `line_settings` (singleton row, `id = 'singleton'`):

```
autoReplyEnabled  boolean  NOT NULL  DEFAULT true
```

- ค่า default = `true` เพื่อคงพฤติกรรมปัจจุบันไว้หลัง deploy/migration
- ปรับ `db/schema/line.ts`, interface `LineSettings`, และ query `updateLineSettings()` ใน `db/queries/line.ts`
- เพิ่ม migration ตามแพทเทิร์น drizzle ที่ใช้อยู่ (ตามไฟล์ migration ของ `line_settings` เดิม)

โครงสร้าง `line_settings` หลังเปลี่ยน: `id`, `autoReplyEnabled`, `fallbackEnabled`, `fallbackMessage`, `updatedAt`

## จุด gate ใน webhook (หัวใจของฟีเจอร์)

ใน `app/api/line/webhook/route.ts` หลัง verify signature + parse payload สำเร็จ และก่อนเข้า `Promise.allSettled`:

1. ดึง `getLineSettings()` หนึ่งครั้ง
2. ถ้า `autoReplyEnabled === false` → `return NextResponse.json({ ok: true })` ทันที

แยก pure helper เล็กๆ (ตามแพทเทิร์น `resolveFallbackText`) เพื่อให้ test เงื่อนไขได้ง่าย เช่น:

```ts
// คืน true ถ้าควรประมวลผล event และตอบกลับ
export function shouldAutoReply(settings: { autoReplyEnabled: boolean }): boolean {
  return settings.autoReplyEnabled
}
```

**ทางเลือกที่ไม่เลือก:** gate รายตัวในแต่ละ handler ของ `line-state.ts` — ละเอียดเกินจำเป็น
และเสี่ยงพลาดบาง path ใหม่ในอนาคต การ gate จุดเดียวที่ทางเข้า webhook ครอบทุกกรณีและอ่านง่ายกว่า

## UI (หน้า LINE settings เดิม)

ใน `app/(dashboard)/dashboard/settings/_components/line-settings-form.tsx`:

- วาง toggle ใหม่ "เปิด/ปิดการตอบกลับอัตโนมัติของบอท" ไว้**บนสุด**ของฟอร์ม (เหนือส่วน fallback)
- มีข้อความอธิบายสถานะ — เมื่อปิดขึ้นว่า "บอทจะไม่ส่งข้อความใดๆ จนกว่าจะเปิดอีกครั้ง"
- เมื่อ master = ปิด → ส่วน fallback ทั้งหมด (checkbox + textarea) ถูก **disable/จางลง**
  โดยใช้ client state จากค่า checkbox ของ master switch
  - ค่า fallback ยังถูกเก็บไว้ในฐานข้อมูล ไม่หาย เพียงแต่ไม่มีผลขณะปิด

## Server action

ขยาย `updateLineSettingsAction` + schema ใน `app/(dashboard)/dashboard/settings/actions.ts`:

- เพิ่ม `autoReplyEnabled: z.boolean()` ใน `settingsSchema`
- อ่านจาก FormData: `formData.get('autoReplyEnabled') === 'on'`
- ส่งต่อไปยัง `updateLineSettings()` ที่ขยายรับฟิลด์ใหม่
- RBAC / permission check เดิมไม่เปลี่ยน

## Testing

- `resolveFallbackText` เดิม: ไม่เปลี่ยน
- เพิ่ม unit test ของ `shouldAutoReply` (กรณี enabled / disabled)
- อัปเดต test ที่เกี่ยวกับ settings (ถ้ามี) ให้ครอบฟิลด์ใหม่ `autoReplyEnabled`
- (ไม่บังคับ) integration-style test ของ webhook route ตามแพทเทิร์นที่มีอยู่ ถ้าครอบคลุมได้

## ไฟล์ที่เกี่ยวข้อง

- `db/schema/line.ts` — เพิ่มคอลัมน์
- migration ใหม่ (drizzle)
- `db/queries/line.ts` — interface + `getLineSettings` (default) + `updateLineSettings`
- `app/api/line/webhook/route.ts` — gate
- `lib/line-state.ts` — pure helper `shouldAutoReply` (หรือไฟล์ helper ที่เหมาะสม)
- `app/(dashboard)/dashboard/settings/actions.ts` — schema + action
- `app/(dashboard)/dashboard/settings/_components/line-settings-form.tsx` — toggle + disable fallback
- tests ที่เกี่ยวข้อง
