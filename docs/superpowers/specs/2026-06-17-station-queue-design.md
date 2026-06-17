# Station Queue (จองคิว) — Design

วันที่: 2026-06-17
สถานะ: อนุมัติ design แล้ว รอ review spec ก่อนทำ implementation plan

## 1. ภาพรวมและเป้าหมาย

ฟีเจอร์ระบบจองคิวที่หน้า station ต่อยอดจาก station check-in เดิม ให้แอดมิน/staff
gen ลิงก์ (QR) ไว้ที่จุดบริการ นักกีฬาสแกน QR เปิด LINE LIFF เพื่อขอเลขคิว
ได้เลขคิวผ่าน flex message พร้อมลิงก์ดูสถานะ (อีกกี่คิว / เวลาประมาณการรอ)
แอดมินคุมการเรียกคิวจากกระดานคุมคิว

### Reuse จากระบบเดิม
- JWT station token + QR generation (`lib/station-token.ts`, `qrcode.react`)
- LIFF register flow (`registerViaLine` ใน `app/(liff)/register/actions.ts`)
- LINE flex / push / reply (`lib/line-client.ts`, `lib/line-messages.ts`)
- RBAC (`lib/rbac.ts`)
- ConfirmActionButton (`app/_components/confirm-action-button.tsx`)
- Drizzle schema pattern (`db/schema/_common.ts` → `idColumn`, `createdAtColumn`, `statusEnum`)

### การตัดสินใจหลัก (ยืนยันกับผู้ใช้แล้ว)
- **หลายจุดบริการคิวต่อ event** — แต่ละจุด (counter) มีลำดับเลขคิวของตัวเอง แยกจาก stations check-in
- **ETA = rolling average จริง** — เฉลี่ยเวลา serve ต่อคิวจากสถานการณ์จริง × จำนวนคิวข้างหน้า
- **Realtime = polling** — หน้า status poll สถานะทุก ~5–10 วินาที (ไม่เพิ่ม websocket infra)

## 2. Data Model

ตารางใหม่ 2 ตาราง เก็บใน `db/schema/queue.ts` ตาม pattern เดิม (idColumn / createdAtColumn / statusEnum)

### 2.1 `queue_counters` — จุดบริการคิว

| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| `counterId` | id (PK) | `idColumn()` |
| `eventId` | text → events.eventId | onDelete cascade |
| `counterName` | text notNull | เช่น "จุดนวด 1" |
| `isOpen` | boolean default false | เปิด/ปิดรับคิว |
| `sessionId` | text notNull | เปลี่ยนค่าทุกครั้งที่ reset → ใช้ทำให้ลิงก์/สถานะคิวเก่าหมดอายุ |
| `lastDisplayNumber` | integer default 0 | ตัวนับเลขคิวล่าสุด เพิ่มแบบ atomic |
| `avgServiceSeconds` | integer nullable | rolling average; null = ยังไม่มีประวัติ ใช้ seed default |
| `status` | statusEnum default active | |
| `createdAt` | createdAtColumn | |

### 2.2 `queue_entries` — เลขคิว (1 แถว = 1 คิว)

| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| `entryId` | id (PK) | |
| `counterId` | text → queue_counters.counterId | onDelete cascade |
| `sessionId` | text notNull | session ที่ออกคิวนี้ (ต้องตรงกับ counter.sessionId ปัจจุบัน ถึงจะ valid) |
| `displayNumber` | integer notNull | **เลขคิวที่โชว์ ไม่เปลี่ยนตลอดอายุ entry** |
| `sortSeq` | numeric notNull | **ลำดับการเรียก แยกจาก displayNumber** ใช้เรียงคิว waiting |
| `entryStatus` | text notNull | `waiting` \| `serving` \| `done` \| `skipped` \| `cancelled` |
| `athleteId` | text → athletes nullable | walk-in non-member = null |
| `registrationId` | text → athlete_event_registrations nullable | |
| `bibNumber` | text nullable | |
| `lineUserId` | text nullable | มีเฉพาะคิวที่ขอผ่าน LIFF → ใช้ตัดสินว่าส่ง flex/push ได้ไหม |
| `isNonMember` | boolean default false | true = แอดมินเพิ่มคนที่ไม่ใช่ member |
| `displayLabel` | text nullable | ชื่อ/ป้ายกำกับสำหรับ walk-in non-member |
| `statusToken` | text notNull | token สุ่มเดาไม่ได้ ใส่ในลิงก์ flex (กันดูคิวคนอื่นด้วยการเดา) |
| `enqueuedAt` | timestamp notNull defaultNow | |
| `calledAt` | timestamp nullable | เวลาที่ถูกเรียก (serving) |
| `completedAt` | timestamp nullable | เวลาที่ done/skip — ใช้คำนวณ rolling avg |
| `createdAt` | createdAtColumn | |

### 2.3 Index / Constraint
- index: `(counterId, entryStatus)` สำหรับ query กระดาน
- **Partial unique index (dedup, advisor #2):** 1 active entry ต่อ athlete และต่อ bib ต่อ counter
  - `unique (counterId, athleteId) where entryStatus in ('waiting','serving','skipped')`
  - `unique (counterId, bibNumber) where entryStatus in ('waiting','serving','skipped')`
  - ขอคิวซ้ำ (สแกน QR / กดซ้ำ) → คืน entry เดิม ไม่ออกเลขใหม่

### 2.4 หลักการแยก displayNumber กับ sortSeq (advisor #1)
- `displayNumber` = เลขที่นักกีฬาเห็น (monotonic ต่อ session, ไม่เปลี่ยน)
- `sortSeq` = คีย์จัดลำดับการเรียก (numeric ให้แทรกค่ากลางได้)
  - enqueue ปกติ: `sortSeq = lastDisplayNumber ใหม่` (เพิ่มท้ายแถว)
  - แทรกคิวที่ข้ามกลับมา: set `sortSeq` ให้อยู่ "ถัดจากคิวที่กำลังเรียก" = ค่าระหว่าง serving ปัจจุบันกับ waiting ตัวแรก (เช่น min(sortSeq ของ waiting) − 1 หรือค่ากลาง) → ดันขึ้นเป็นลำดับถัดไป
- ลำดับคิวที่จะเรียก = `entryStatus='waiting' AND sessionId=counter.sessionId ORDER BY sortSeq ASC`

## 3. หน้าจอ

| Route | ผู้ใช้ | หน้าที่ |
|---|---|---|
| `/dashboard/events/[id]/queue` | แอดมิน | จัดการ counters (CRUD), gen QR ต่อ counter |
| `/dashboard/events/[id]/queue/[counterId]/board` | แอดมิน/staff | กระดานคุมคิว |
| `/queue/[token]` (LIFF group) | นักกีฬา | สแกน QR → ขอคิว (3 เคส) |
| `/q/[statusToken]` (public) | นักกีฬา | หน้า status — เลขคิว, อีกกี่คิว, ETA, polling |

`token` ของ LIFF = JWT signed (reuse `signStationToken` pattern) บรรจุ `{ counterId, eventId }`
`statusToken` = token ต่อ entry (advisor #6) — public route ไม่บังคับ login

## 4. Flow ขอคิวผ่าน LIFF (3 เคส)

หน้า `/queue/[token]`:
1. verify token → ได้ counterId, eventId
2. ถ้า counter `isOpen = false` → reject นุ่มนวล "ยังไม่เปิดรับคิว / ปิดรับคิวแล้ว" (advisor #4)
3. LIFF init + ดึง lineUserId (idToken)
4. แยกเคสตามสถานะ athlete:
   - **เคส 1 — member + ลงทะเบียน event แล้ว:** ขอคิวได้เลย → ออก entry
   - **เคส 2 — member + ยังไม่ลงทะเบียน event:** ฟอร์มกรอก bib → สร้าง registration (reuse logic จาก `registerViaLine`) → ออก entry
   - **เคส 3 — ยังไม่เป็น member:** ฟอร์มกรอกข้อมูล + bib → สร้าง athlete + registration + consent (reuse `registerViaLine`) → ออก entry
5. การออก entry (enqueue) ต้อง **atomic** (advisor #5): ใน transaction เดียว increment `counter.lastDisplayNumber` แล้วสร้าง entry ด้วย displayNumber/sortSeq นั้น พร้อม dedup ตาม §2.3 (ถ้ามี active entry อยู่แล้วคืนตัวเดิม)
6. ส่ง **flex message**: เลขคิว + ปุ่มลิงก์ `/q/[statusToken]`
7. LIFF แสดงเลขคิว + ปิดหน้าต่าง

## 5. Flow กระดานคุมคิว (แอดมิน)

หน้า `/dashboard/events/[id]/queue/[counterId]/board` (force-dynamic + auto-refresh/poll ฝั่ง admin):
- แสดง **คิวที่กำลังเรียก (serving)** + **incoming 3 ลำดับถัดไป**
- แสดงรายการ skipped ที่ยังแทรกกลับได้

Actions (server actions + RBAC):
| Action | รายละเอียด | Confirm dialog |
|---|---|---|
| เริ่ม/หยุดรับคิว | toggle `isOpen` | ไม่ต้อง |
| Reset คิว | เปลี่ยน `sessionId`, set `lastDisplayNumber=0`, `avgServiceSeconds=null`, ปิด/ยกเลิก entry ค้างทั้งหมด | **ต้อง** — เตือน "คิวค้างทั้งหมดจะถูกล้าง" |
| Next คิว | set serving ปัจจุบัน → done (completedAt=now), เรียก waiting ตัวแรก → serving (calledAt=now); อัปเดต rolling `avgServiceSeconds` | ไม่ต้อง (กดบ่อย) |
| ข้ามคิว (skip) | serving/waiting → skipped | ไม่ต้อง |
| แทรกคิวที่ข้าม | เลือก skipped → set sortSeq ถัดจาก serving → waiting | ไม่ต้อง |
| เพิ่มคิวด้วย bib | แอดมินกรอก bib → lookup registration → enqueue (lineUserId อาจ null) | ไม่ต้อง |
| เพิ่มคิว non-member | กรอกชื่อ/label → entry `isNonMember=true`, athleteId=null, แสดงป้าย "ไม่ใช่ member" | ไม่ต้อง |
| ลบ counter | ลบจุดบริการ (cascade entries) | **ต้อง** |

**ข้อจำกัด push/flex (advisor #3):** entry ที่ไม่มี `lineUserId` (เพิ่มด้วย bib หรือ non-member) ส่ง flex/แจ้งเตือนทาง LINE ไม่ได้ → แอดมินต้องแจ้งเลขคิวเอง ระบุชัดบน UI

## 6. หน้า status (`/q/[statusToken]`)

- public route, ดึง entry จาก `statusToken`
- ตรวจ `entry.sessionId === counter.sessionId` — ถ้าไม่ตรง (โดน reset) → แสดง "คิวถูกรีเซ็ต" (advisor #4)
- แสดง: เลขคิวของฉัน, สถานะ (รออยู่/กำลังเรียก/เสร็จแล้ว/ถูกข้าม), จำนวนคิวข้างหน้า, ETA
- **Polling** ทุก ~5–10 วิ (client `setInterval` เรียก lightweight API/route handler คืน status JSON)

## 7. ETA — rolling average (advisor #7)

- `avgServiceSeconds` อัปเดตตอนกด Next: เวลา serve จริง = `completedAt − calledAt` ของคิวที่เพิ่ง done
  นำมาเฉลี่ยถ่วงแบบ rolling (เช่น EMA หรือเฉลี่ย N คิวล่าสุด)
- ETA ที่โชว์บนหน้า status = `จำนวน waiting ที่อยู่ข้างหน้า × avgServiceSeconds`
- **Cold start:** ถ้า `avgServiceSeconds` ยัง null (คิวแรกๆ / หลัง reset) ใช้ seed default (เช่น 600 วิ/คิว — กำหนดเป็น constant ปรับได้)

## 8. Permissions (RBAC)

เพิ่ม permission ใหม่ใน `lib/rbac.ts` ตาม pattern เดิม:
- `QUEUE_MANAGE` (สร้าง/ลบ/แก้ counter, reset) — super_admin_owner/manager
- `QUEUE_OPERATE` (next/skip/แทรก/เพิ่มคิว/เปิด-ปิด) — รวม sponsor_staff (คล้าย CHECKIN_CREATE)

## 9. Migration

เพิ่ม `db/schema/queue.ts` → `pnpm db:generate` สร้าง SQL ใหม่ใน `db/migrations/`
(partial unique index อาจต้องเขียน raw ใน migration ถ้า drizzle generate ไม่ออกให้ ตรวจตอน implement)

## 10. Out of scope (บันทึกไว้ ทำภายหลัง)

- Push เตือนเมื่อใกล้ถึงคิว (~3 คิว) เพิ่มจาก polling
- จอ public display (จอใหญ่หน้างาน) แสดงเลขคิวที่กำลังเรียก
- เสียง/ภาพแจ้งเตือนบนกระดานเมื่อมีคิวใหม่ (อาจทำ minimal ในรอบนี้ได้ถ้าง่าย แต่ไม่บังคับ)

## 11. สรุปไฟล์ที่จะแตะ/สร้าง (ประเมิน)

สร้างใหม่:
- `db/schema/queue.ts`
- `db/queries/queue.ts`
- `lib/queue-core.ts` (enqueue/next/skip/requeue/reset + ETA logic)
- `app/(dashboard)/dashboard/events/[id]/queue/` (page, actions, components)
- `app/(dashboard)/dashboard/events/[id]/queue/[counterId]/board/` (กระดาน)
- `app/(liff)/queue/[token]/` (LIFF ขอคิว)
- `app/(queue-status)/q/[statusToken]/` (หน้า status — public route group ใหม่ ไม่บังคับ auth/LIFF ตาม pattern `(self-checkin)`)
- API route handler สำหรับ poll status

แก้ไข:
- `lib/rbac.ts` (permission ใหม่)
- `lib/line-messages.ts` (flex เลขคิว)
- `db/schema/index` (export ตารางใหม่ ถ้ามี barrel)
- เมนู/nav ของ event detail (ลิงก์เข้า queue)
