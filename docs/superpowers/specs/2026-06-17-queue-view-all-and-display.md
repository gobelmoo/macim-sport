# ดูคิวทั้งหมด (operator) + หน้าจอแสดงคิว (public display) — Design

วันที่: 2026-06-17
สถานะ: รอ review spec ก่อนทำ implementation plan

## เป้าหมาย
1. **คนคุมคิว ดูคิวทั้งหมดได้** — board หลักโชว์แค่ "กำลังเรียก + 3 ถัดไป" เพิ่มปุ่ม "ดูทั้งหมด" เปิด modal เห็นทุกคิว active
2. **หน้าจอแสดงคิว (public)** — route ใหม่ตั้งจอ/TV ที่ station ให้นักกีฬาดูคิวปัจจุบัน + 10 ถัดไป + QR รับคิว

ไม่มี migration / ไม่แตะ schema

---

## ฟีเจอร์ 1 — ดูคิวทั้งหมด (operator board)

### พฤติกรรม
- เพิ่มปุ่ม **"ดูทั้งหมด (N)"** บน board (ข้างหัว "คิวถัดไป" ใน `up-next-list`) — N = จำนวนคิว active (waiting + serving + skipped)
- กด → **Dialog** แสดงรายการทุกสถานะ active แยกกลุ่ม เรียงตามลำดับการเรียก:
  - **กำลังเรียก** (1 รายการ ไฮไลต์สีหลัก)
  - **รอเรียก** (waiting ทั้งหมด เรียง sortSeq — ไม่จำกัด 3)
  - **ถูกข้าม** (skipped — เส้นประ)
- แต่ละแถว: `displayNumber` + ป้าย (ชื่อ/bib หรือ "ไม่ใช่สมาชิก") — ฝั่งคนคุมเห็นชื่อได้ (ใช้ `entryLabel`)
- **view-only** (ไม่มี action ใน modal — board หลักจัดการได้อยู่แล้ว)

### Data
- `BoardData` เพิ่ม field `waiting: EntryView[]` (รายการ waiting เต็ม) — `getBoard` ดึงอยู่แล้ว (หลัง /simplify) แค่ส่งออกเพิ่ม
- `waitingCount` เดิม = `waiting.length` (คงไว้); `upcoming` เดิม = `waiting.slice(0,3)` (คงไว้)
- N (count บนปุ่ม) = `serving ? 1 : 0` + `waiting.length` + `skipped.length`

### Component
- `app/(station-queue)/station-queue/[token]/_components/all-queues-dialog.tsx` — รับ `{ serving, waiting, skipped }` แสดง Dialog (controlled open state) จัดกลุ่ม + `entryLabel`
- เรียกใช้จาก `up-next-list.tsx` (ปุ่ม trigger) หรือ `queue-board.tsx` — วางปุ่มที่หัว "คิวถัดไป"

---

## ฟีเจอร์ 2 — หน้าจอแสดงคิว (public display)

### Route + access
- ใหม่ `app/(queue-display)/queue-display/[token]/page.tsx` — **public, no-login, read-only** (route group ใหม่ ไม่มี layout เฉพาะ ใช้ root layout เหมือน `(station-queue)`)
- **token scope ใหม่ `display`** — เพิ่มใน `QueueTokenScope = 'request' | 'operate' | 'display'` (`lib/queue-token.ts`). page verify `'display'` → notFound ถ้าไม่ตรง
- display token อ่านอย่างเดียว ไม่ให้สิทธิ์คุม/ขอคิว → ปลอดภัยแม้ลิงก์หลุด

### แสดงผล (เลข + BIB ตัวเล็ก, ไม่มีชื่อ)
- **กำลังเรียก:** เลขใหญ่เต็มจอ (`text-8xl`/`text-9xl`) + BIB ตัวเล็กใต้เลข (ถ้ามี); ถ้าไม่มีคิว → "—"
- **คิวถัดไป (10):** chip มน เรียงแถว แต่ละ chip = เลขคิว + BIB ตัวเล็ก; non-member (ไม่มี bib) → โชว์เลขอย่างเดียว
- **QR รับคิว** มุมขวาบน + ข้อความ "สแกนรับคิว" (request scope token — sign ในหน้า page)
- **หัวจอ:** ชื่อ counter + สถานะ (เปิด/ปิดรับคิว); ถ้าปิด → แสดงแถบ "ปิดรับคิว"
- **สวยงาม:** คอนทราสต์สูง, ตัวเลขใหญ่อ่านไกล, รองรับจอแนวนอน/TV (จัดกลางจอ), การ์ดมุมมน
- **auto-refresh** ทุก ~5 วิ (client poll API หรือ `router.refresh()` บน force-dynamic) — เลือก client poll lightweight API ให้ลื่นบนจอตั้งโชว์

### Data (query เบา — ไม่ join ชื่อ)
- เพิ่ม `getQueueDisplay(counterId): Promise<QueueDisplay | null>` ใน `db/queries/queue.ts`:
```ts
export type QueueDisplay = {
  counterName: string
  isOpen: boolean
  serving: { displayNumber: number; bibNumber: string | null } | null
  next: { displayNumber: number; bibNumber: string | null }[] // waiting 10 ตัวแรก
}
```
- select เฉพาะ `displayNumber`, `bibNumber` ของ serving (1) + waiting (10, order sortSeq) ของ session ปัจจุบัน — ไม่ join `athletes` (เบากว่า เพราะ poll บ่อย)
- API route สำหรับ poll: `app/api/queue/display/[token]/route.ts` GET → verify display token → `getQueueDisplay` → JSON (คล้าย `api/queue/status/[token]`)

### Component
- `app/(queue-display)/queue-display/[token]/page.tsx` — verify display token, render `<QueueDisplayView token={token} initial={...} />` (ส่ง initial + liffUrl)
- `app/(queue-display)/queue-display/[token]/_components/display-view.tsx` (client) — poll `/api/queue/display/[token]` ทุก 5 วิ, แสดงผลตาม layout

### ลิงก์ display มาจากไหน
- เพิ่มใน **ShareDialog** ของ board (QR/ลิงก์ที่ 3: "หน้าจอแสดงคิว")
- board page sign `displayUrl = ${APP_BASE}/queue-display/${sign({counterId,eventId,scope:'display'})}` ส่งเข้า QueueBoard → BoardHeader → ShareDialog
- (stations "จัดการคิว" modal คงเดิม — admin เปิด board แล้วหยิบลิงก์ display จาก ShareDialog)

---

## ไฟล์ที่กระทบ

**แก้:**
- `lib/queue-token.ts` — เพิ่ม `'display'` ใน scope union
- `db/queries/queue.ts` — เพิ่ม `waiting` ใน `BoardData`/`getBoard`; เพิ่ม `getQueueDisplay` + type `QueueDisplay`
- `app/(station-queue)/station-queue/[token]/page.tsx` — sign `displayUrl` ส่งเข้า board
- `app/(station-queue)/station-queue/[token]/_components/queue-board.tsx` — รับ/ส่ง `displayUrl`, รับ `waiting`/count ไป all-queues
- `.../_components/board-header.tsx` + `share-dialog.tsx` — เพิ่ม QR display (3rd)
- `.../_components/up-next-list.tsx` — เพิ่มปุ่ม "ดูทั้งหมด (N)" + render AllQueuesDialog

**สร้าง:**
- `.../_components/all-queues-dialog.tsx`
- `app/api/queue/display/[token]/route.ts`
- `app/(queue-display)/queue-display/[token]/page.tsx`
- `app/(queue-display)/queue-display/[token]/_components/display-view.tsx`

**ไม่แตะ:** schema/migration, board actions (token-only เดิม), LIFF request, status page

## Edge cases
- display token invalid/scope ผิด → `notFound()`
- counter reset → display query ตาม sessionId ปัจจุบัน → แสดงคิวว่าง (เริ่มใหม่) ปกติ
- ปิดรับคิว → display ยังแสดงคิวปัจจุบัน + แถบ "ปิดรับคิว" (ยังเรียกคิวที่ค้างได้)
- next < 10 → แสดงเท่าที่มี; ไม่มีคิวรอ → "ไม่มีคิวถัดไป"
- non-member ไม่มี bib → display โชว์เลขอย่างเดียว

## Out of scope (คงไว้)
- operate token ไม่มี expiry/revoke
- ETA บนหน้า display (ยังไม่ทำ — โชว์เลขอย่างเดียว)
- เสียงเรียกคิว
