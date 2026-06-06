# LINE Self-Registration Design

**Date:** 2026-06-06  
**Feature:** นักกีฬาลงทะเบียนเองผ่าน LINE OA (Hybrid Webhook + LIFF)  
**Status:** Approved

---

## Overview

นักกีฬาสามารถลงทะเบียนเข้างานผ่าน LINE OA โดยไม่ต้องให้ admin import ล่วงหน้า รองรับ 3 flows และรองรับ multi-event ที่ active พร้อมกัน

---

## Credentials

| Key | Value |
|-----|-------|
| LINE Channel ID | 2010313786 |
| LINE Channel Secret | `LINE_CHANNEL_SECRET` (env) |
| LINE Channel Access Token | `LINE_CHANNEL_ACCESS_TOKEN` (env) |
| LIFF ID | `2010313814-yt06X2oB` (`NEXT_PUBLIC_LIFF_ID`) |

**Webhook URL:** `https://macim-sport.vercel.app/api/line/webhook`  
**LIFF Endpoint URL:** `https://macim-sport.vercel.app/register`

---

## 3 User Flows

### Flow 1: New Member
นักกีฬาที่ยังไม่เคยอยู่ในระบบ
```
Add/Message OA → welcome → เลือก event (ถ้า >1) → พิมพ์ BIB
→ PDPA consent Flex → ยอมรับ → LIFF link
→ LIFF form (กรอกชื่อ/วันเกิด/เพศ) → submit
→ สร้าง athlete + registration → success message
```

### Flow 2: Returning Member (มี lineUserId แล้ว)
นักกีฬาที่เคยลงทะเบียนงานก่อนหน้าแล้ว
```
Message OA → welcome back (ชื่อ) → เลือก event ใหม่ (ถ้า >1)
→ พิมพ์ BIB → ข้าม consent (มีแล้ว) → LIFF link (pre-filled)
→ submit → สร้าง registration → success message
```

### Flow 3: Imported Member (มี record แต่ยังไม่มี lineUserId)
นักกีฬาที่ถูก admin import ไว้แล้ว
```
Message OA → เลือก event → พิมพ์ BIB
→ BIB พบใน athlete_event_registrations → confirmRecord Flex
→ ผู้ใช้ยืนยัน "ใช่ คือฉัน" → ผูก lineUserId → success message (ไม่ต้องกรอก LIFF)
```

---

## State Machine

States: `idle` | `awaiting_event` | `awaiting_bib` | `awaiting_confirm` | `awaiting_consent` | `done`

### Transitions

```
[any message / follow event]
  ↓ startFlow(lineUserId)
  ├── athlete.lineUserId = me (returning)
  │     availableEvents = activeEvents - alreadyRegistered
  │     0 events → errorMessage('no_events')
  │     1 event  → state=awaiting_bib + eventId, send welcomeBack + askBib
  │     >1 events → state=awaiting_event, send welcomeBack + Quick Reply
  │
  └── ไม่มี athlete (new/imported)
        activeEvents = events WHERE status IN ('published','active')
        0 events → errorMessage('no_events')
        1 event  → state=awaiting_bib + eventId, send welcomeNew + askBib
        >1 events → state=awaiting_event, send welcomeNew + Quick Reply

[postback: select_event]
  → state=awaiting_bib + eventId, send askBib

[text message in awaiting_bib]
  → handleBib()
  1. format check: /^[A-Za-z0-9\-]{1,10}$/
     fail → errorMessage('bib_format'), ถาม BIB ใหม่
  2. ค้นใน athlete_event_registrations WHERE bibNumber=X AND eventId=session.eventId
     พบ + ไม่มี lineUserId → state=awaiting_confirm, send confirmRecordFlex
     พบ + มี lineUserId แล้ว → errorMessage('bib_taken')
     ไม่พบ
       returning member (มี lineUserId) → send LIFF link, state=done
       new member → state=awaiting_consent, send consentFlex

[postback: confirm_yes]
  → UPDATE athletes SET lineUserId=X WHERE athleteId=Y
  → send successMessage (ไม่ผ่าน LIFF)
  → state=done

[postback: confirm_no]
  → state=awaiting_bib, bibNumber=null
  → ถาม BIB ใหม่

[postback: consent_accept]
  → INSERT athlete_consents (pdpaAccepted=true, version='2025-v1')
  → send liffLinkMessage(liffUrl)
  → state=done

[postback: consent_decline]
  → errorMessage('consent_declined')
  → state=idle
```

---

## Database Schema

### ตารางใหม่ (migration: `0004_line_registration.sql`)

**`line_sessions`**
```sql
lineUserId    TEXT PRIMARY KEY
state         line_state_enum NOT NULL DEFAULT 'idle'
eventId       TEXT REFERENCES events(eventId) ON DELETE SET NULL
bibNumber     TEXT
updatedAt     TIMESTAMP DEFAULT NOW()
```

Enum `line_state_enum`: `idle`, `awaiting_event`, `awaiting_bib`, `awaiting_confirm`, `awaiting_consent`, `done`

**`athlete_consents`**
```sql
consentId         TEXT PRIMARY KEY (cuid)
athleteId         TEXT NOT NULL REFERENCES athletes(athleteId) ON DELETE CASCADE
consentVersion    TEXT NOT NULL  -- "2025-v1"
pdpaAccepted      BOOLEAN NOT NULL
marketingAccepted BOOLEAN NOT NULL DEFAULT false
consentedAt       TIMESTAMP DEFAULT NOW()
```

### ตารางที่แก้
- `events` — **ไม่เพิ่ม column ใด** (ตัด bibStart/bibEnd ออก)
- `athletes.lineUserId` — มีอยู่แล้ว ✓

---

## BIB Validation

Format: `/^[A-Za-z0-9\-]{1,10}$/`  
ตัวเลข + อักษรอังกฤษ + `-` สลับกันได้ ความยาวไม่เกิน 10 ตัวอักษร

ไม่มี range validation — organizer แจก BIB ให้นักกีฬา นักกีฬารู้ BIB ของตัวเอง

---

## Flex Messages (`lib/line-messages.ts`)

| ฟังก์ชัน | ใช้ตอน | ประเภท |
|---|---|---|
| `welcomeNewMessage(events[])` | user ใหม่/ไม่รู้จัก | Text + Quick Reply (>1 event) |
| `welcomeBackMessage(firstName, events[])` | returning member | Text + Quick Reply (>1 event) |
| `askBibMessage(eventName)` | หลังเลือก event | Text |
| `consentFlex()` | BIB ผ่าน (new member) | Flex + 2 postback buttons |
| `confirmRecordFlex(firstName, lastName, dob)` | BIB พบ imported record | Flex + 2 postback buttons |
| `liffLinkMessage(liffUrl)` | หลัง consent | Text + link |
| `successMessage(firstName, bib, eventName)` | หลัง LIFF submit | Text |
| `errorMessage(type)` | error ทุกกรณี | Text |

**Error types:** `bib_format` | `bib_taken` | `no_events` | `consent_declined`

**Quick Reply postback format:**
```json
{ "action": "select_event", "eventId": "xxx" }
{ "action": "confirm_yes" }
{ "action": "confirm_no" }
{ "action": "consent_accept" }
{ "action": "consent_decline" }
```

---

## API Endpoint

### `POST /api/line/webhook`
```
1. Verify X-Line-Signature (HMAC-SHA256 + LINE_CHANNEL_SECRET) → 401 ถ้าไม่ผ่าน
2. Parse body.events[]
3. for each event:
   type='follow'        → startFlow(lineUserId)
   type='message'+text  → handleText(lineUserId, text, session)
   type='postback'      → handlePostback(lineUserId, JSON.parse(data), session)
4. return 200 OK (ต้องตอบเร็ว < 5s)
```

---

## LIFF Page

**Route:** `app/(liff)/register/[eventId]/page.tsx`  
**Layout:** `app/(liff)/layout.tsx` — ไม่มี nav, ไม่ต้อง auth session  
**LIFF URL:** `https://liff.line.me/2010313814-yt06X2oB/{eventId}?bib=YYY`
(LIFF endpoint = `/register` → path `/{eventId}` ต่อท้ายได้ → Next.js รับเป็น `params.eventId`)

### Page Load Flow
```
1. liff.init({ liffId: NEXT_PUBLIC_LIFF_ID })
2. if !liff.isLoggedIn() → liff.login()
3. profile = liff.getProfile() → { userId, displayName }
4. อ่าน searchParams: bib
5. อ่าน params: eventId → fetch event (name, date)
6. แสดง form
```

### Form Fields
| Field | Default | Validation |
|---|---|---|
| BIB | จาก URL param | readonly |
| ชื่อจริง | pre-fill จาก LINE displayName (คำแรก) | required |
| นามสกุล | ว่าง | required |
| วันเกิด | ว่าง | required, date picker |
| เพศ | ว่าง | required, select |

### Server Action `registerViaLine(formData)`
```
1. รับ: liffIdToken (JWT จาก liff.getIDToken()), eventId, bib, firstName, lastName, dateOfBirth, gender
2. verify liffIdToken กับ LINE endpoint → ได้ lineUserId ที่เชื่อถือได้
3. athlete = SELECT WHERE lineUserId=X
   ไม่มี → INSERT athletes + INSERT athlete_event_registrations
   มีแล้ว → INSERT athlete_event_registrations (ON CONFLICT DO NOTHING)
4. push LINE message: successMessage(firstName, bib, eventName)
5. return { ok: true } → LIFF แสดงหน้า success
```

---

## Dashboard Changes

**`app/(dashboard)/dashboard/events/[id]/page.tsx`**  
เพิ่ม "คัดลอกลิงก์ลงทะเบียน" button ใน header card:
- แสดงเฉพาะ `status === 'published' || 'active'`
- URL: `https://liff.line.me/2010313814-yt06X2oB/{eventId}`
- ใช้ `navigator.clipboard.writeText()` (client component)

---

## Env Vars

```bash
# .env.local + Vercel environment
LINE_CHANNEL_SECRET=<server only>
LINE_CHANNEL_ACCESS_TOKEN=<server only>
NEXT_PUBLIC_LIFF_ID=2010313814-yt06X2oB
```

---

## Files Changed

### ใหม่
```
db/schema/line.ts
db/migrations/0004_line_registration.sql
db/queries/line.ts
app/api/line/webhook/route.ts
app/(liff)/layout.tsx
app/(liff)/register/[eventId]/page.tsx
lib/line-client.ts
lib/line-messages.ts
lib/line-state.ts
```

### แก้
```
app/(dashboard)/dashboard/events/[id]/page.tsx
.env.local
.env.example
```

---

## LINE Developer Console Setup

หลัง deploy:
1. Messaging API → Webhook URL → `https://macim-sport.vercel.app/api/line/webhook` → Verify
2. LIFF → Edit → Endpoint URL → `https://macim-sport.vercel.app/register`
3. Messaging API → เปิด "Use webhook" toggle
