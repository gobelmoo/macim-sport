# MACIM SPORT — Project Setup TODO

---

## Phase 1: Init Project ✅

- [x] `pnpm create next-app@latest macim-sport --typescript --app --no-tailwind --no-eslint --no-src-dir`
- [x] copy `pnpm-workspace.yaml` จาก Widely-Backend
- [x] copy `.gitignore` จาก Widely-Backend
- [x] copy `tsconfig.json` จาก Widely-Backend
- [x] copy `next.config.ts` จาก Widely-Backend
- [x] copy `postcss.config.mjs` จาก Widely-Backend
- [x] copy `eslint.config.mjs` จาก Widely-Backend
- [x] copy `vitest.config.ts` จาก Widely-Backend
- [x] update `package.json` scripts (db:*, test, lint, typecheck)

---

## Phase 2: Install Dependencies ✅

- [x] ติดตั้ง core deps (drizzle-orm, neon, next-auth, bcryptjs, zod, rhf, shadcn utils, etc.)
- [x] ติดตั้ง devDeps (drizzle-kit, tailwindcss, eslint-config-next, tsx, vitest, dotenv)

---

## Phase 3: UI Foundation ✅

- [x] ติดตั้ง shadcn/ui + `shadcn` runtime + `tw-animate-css`
- [x] ตั้งค่า `components.json` (style: radix-nova, baseColor: neutral)
- [x] ติดตั้ง shadcn components (sidebar, button, card, input, label, dropdown-menu, avatar, badge, separator, table, dialog, alert-dialog, form, select, sonner, tooltip, sheet, skeleton, tabs)
- [x] สร้าง `app/globals.css` — theme สี oklch จาก Widely-Backend
- [x] สร้าง `app/layout.tsx` (Noto Sans Thai + Geist Mono + ThemeProvider + TooltipProvider + Toaster, lang="th")
- [x] สร้าง `components/layout/theme-provider.tsx`
- [x] สร้าง `components/layout/theme-switcher.tsx`

---

## Phase 4: Database Schema ✅

- [x] สร้าง `drizzle.config.ts`
- [x] สร้าง `db/schema/_common.ts` (idColumn, createdAtColumn, statusEnum)
- [x] สร้าง `db/schema/sponsors.ts`
- [x] สร้าง `db/schema/users.ts` (userRoleEnum 5 ค่า)
- [x] สร้าง `db/schema/events.ts`
- [x] สร้าง `db/schema/stations.ts`
- [x] สร้าง `db/schema/athletes.ts` (POST-MVP fields nullable ไว้)
- [x] สร้าง `db/schema/athlete_event_registrations.ts` (unique: bibNumber+eventId)
- [x] สร้าง `db/schema/checkins.ts`
- [x] สร้าง `db/schema/stamps.ts`
- [x] สร้าง `db/schema/post-mvp.ts` (Tables 9–24 stubs)
- [x] สร้าง `db/index.ts`
- [x] สร้าง `db/seed.ts` (owner account + MACIM internal sponsor)
- [x] สร้าง `.env.example`
- [x] ตั้งค่า `.env.local` (DATABASE_URL, AUTH_SECRET, SEED_OWNER_EMAIL/PASSWORD)
- [x] `pnpm db:generate` + apply migration → Neon (24 tables, 8 ENUMs)
- [x] `pnpm db:seed` → MACIM internal sponsor + super_admin_owner

---

## Phase 5: Auth (Credentials — Email + Password) ✅

- [x] สร้าง `lib/rbac.ts` (ROLES, PERMISSIONS, ROLE_PERMISSIONS, canAccess, getPermissionsForRole)
- [x] สร้าง `db/queries/authz.ts` (loadSessionAuthz — single round-trip)
- [x] สร้าง `auth.config.ts` (authorized callback, sign-in page)
- [x] สร้าง `auth.ts` (Credentials provider, JWT TTL 5 นาที, session callbacks)
- [x] สร้าง `app/api/auth/[...nextauth]/route.ts`
- [x] สร้าง `middleware.ts`
- [x] สร้าง `app/(auth)/sign-in/page.tsx` (email + password form + error state)
- [x] สร้าง `app/(auth)/sign-in/actions.ts` (signInAction server action)
- [x] สร้าง `scripts/grant-admin.ts`

---

## Phase 6: RBAC

- [ ] สร้าง `lib/rbac.ts`
  - `ROLES`: 5 ค่า fixed ENUM
  - `PERMISSIONS`: ทุก permission ที่ระบบต้องการ
  - `ROLE_PERMISSIONS`: map แต่ละ Role → permissions (owner/manager = `'*'`)
  - `canAccess()` helper
  - Data isolation: sponsor roles ต้องมี `sponsorId` ใน session
- [ ] extend `next-auth` types ใน `auth.ts`
  - `session.user`: เพิ่ม `role`, `sponsorId`, `permissions`
  - `JWT`: เพิ่ม `role`, `sponsorId`, `permissions`, `userValidatedAt`
- [ ] สร้าง `db/queries/authz.ts`
  - `loadSessionAuthz(userId)`: ดึง role + sponsorId + permissions ใน round trip เดียว

---

## Phase 7: Dashboard Layout ✅

- [x] สร้าง `lib/utils.ts` (cn, initials, oneParam)
- [x] สร้าง `lib/nav.ts` (NAV items + filterNav ด้วย anyOf permission)
- [x] สร้าง `app/(dashboard)/actions.ts` (signOutAction)
- [x] สร้าง `app/(dashboard)/layout.tsx` (session guard, sponsor_staff → /checkin redirect)
- [x] สร้าง `components/layout/app-sidebar.tsx` (MACIM SPORT branding)
- [x] สร้าง `components/layout/nav-main.tsx`
- [x] สร้าง `components/layout/nav-user.tsx` (role labels ภาษาไทย)
- [x] สร้าง `app/(dashboard)/dashboard/page.tsx`
- [x] เปลี่ยน `middleware.ts` → `proxy.ts` (Next.js 16 convention)
- [x] `pnpm build` — ผ่านสะอาด

---

## Phase 8: Core Pages (MVP) ✅

### Sponsor Management (owner + manager)
- [x] `/dashboard/sponsors` — รายการ Sponsor
- [x] `/dashboard/sponsors/new` — สร้าง Sponsor ใหม่
- [x] `/dashboard/sponsors/[id]` — แก้ไข Sponsor

### Event Management (owner + manager)
- [x] `/dashboard/events` — รายการ Event
- [x] `/dashboard/events/new` — สร้าง Event ใหม่
- [x] `/dashboard/events/[id]` — แก้ไข Event + เปลี่ยน status
- [x] `/dashboard/events/[id]/stations` — จัดการ Station ในงาน
- [x] `/dashboard/events/[id]/import` — Import ไฟล์รายชื่อนักกีฬา

### User Management
- [x] `/dashboard/users` — รายการ User (MACIM admin เห็นทุก Role / sponsor_admin เห็นแค่ staff ตัวเอง)
- [x] `/dashboard/users/new` — สร้าง User (Role ที่เลือกได้ขึ้นกับ Role ของ creator)
- [x] `/dashboard/users/[id]` — แก้ไข / disable User

### Reports (ดูตาม scope ของ Role)
- [x] `/dashboard/reports` — Check-in stats, นักกีฬา, Stamp summary

### Check-in (Tablet — sponsor_staff)
- [x] `/checkin` — เลือก Event + Station
- [x] `/checkin/[stationId]` — หน้า Check-in หลัก
  - กรอก BIB Number
  - แสดงชื่อ + รูป
  - บันทึก checkin + stamp
  - response ≤ 3 วินาที

---

## Phase 8.5: Self Check-in via QR + OCR ✅

นักกีฬา scan QR จากบูธ → เปิดหน้าใน browser → OCR สแกน BIB เอง → check-in

- [x] `lib/station-token.ts` — sign/verify JWT (HS256 + AUTH_SECRET) แบบ stateless
- [x] `app/(dashboard)/dashboard/events/[id]/stations/` — เพิ่มปุ่ม QR Code ต่อ station
- [x] `app/(dashboard)/dashboard/events/[id]/stations/_components/station-qr-button.tsx` — modal แสดง QR + copy URL
- [x] `app/(self-checkin)/self-checkin/[token]/page.tsx` — public route, verify token + เช็ค event/station active
- [x] `app/(self-checkin)/self-checkin/[token]/_components/ocr-terminal.tsx` — Tesseract.js OCR, scan BIB จากกล้อง
- [x] `app/(self-checkin)/self-checkin/[token]/actions.ts` — performSelfCheckin (verify token → executeCheckin)
- [x] `lib/checkin-core.ts` — executeCheckin shared logic (ใช้ทั้ง station + self check-in)
- [x] `app/_components/checkin-result-card.tsx` — shared result card
- [x] `auth.config.ts` — whitelist `/self-checkin/*` เป็น public route
- [x] deploy + verify production

---

## Phase 9: Environment + Deploy ✅

- [x] สร้าง `.env.example`
- [x] สร้าง `.env.local` จาก `.env.example`
- [x] `git init` + initial commit (main branch, 122 files)
- [x] ตั้งค่า Vercel project + link → `widelynexts-projects/macim-sport`
- [x] ตั้งค่า env vars ใน Vercel (DATABASE_URL, AUTH_SECRET — production)
- [x] deploy production build → https://macim-sport.vercel.app

---

## Phase 10: Verify

- [x] login ด้วย owner account ได้
- [x] owner สร้าง manager ได้
- [x] manager สร้าง sponsor_admin ได้
- [x] sponsor_admin สร้าง sponsor_staff ได้
- [x] sponsor_staff เข้าได้แค่หน้า `/checkin` เท่านั้น
- [x] viewer เข้า `/dashboard/reports` ได้ แต่เข้า `/dashboard/sponsors` ไม่ได้
- [x] Check-in flow ครบ 3 กรณี (พบ / ไม่พบ / ลงทะเบียนทันที)

---

## Phase 11: LINE Self-Registration (Hybrid Webhook + LIFF)

นักกีฬาลงทะเบียนเองผ่าน LINE OA — รองรับ 3 flows: new member, existing member, imported member

### Setup (ทำก่อน)
- [ ] สร้าง LINE Messaging API Channel + เปิด webhook URL `/api/line/webhook`
- [ ] สร้าง LINE Login Channel + LIFF App (URL = `/register/[eventId]`)
- [ ] เพิ่ม env vars: `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `LIFF_ID`

### DB Migration
- [ ] `events` table: เพิ่ม `bibStart` (integer), `bibEnd` (integer)
- [ ] สร้าง `athlete_consents` table: `athleteId`, `consentVersion`, `pdpaAccepted`, `marketingAccepted`, `consentedAt`
- [ ] สร้าง `line_sessions` table: `lineUserId`, `state` (enum), `eventId`, `bibNumber`, `updatedAt`
- [ ] `pnpm db:generate` + apply migration

### Webhook
- [ ] สร้าง `POST /api/line/webhook` — verify signature + route events (follow / message / postback)
- [ ] `handleFollow` — เช็ค LINE ID ในระบบ → ส่ง welcome new หรือ welcome back
- [ ] `handleMessage` — state = awaiting_bib → validate BIB (pool / ซ้ำ / มี record ไม่มี LINE ID)
- [ ] `handlePostback` — consent:accept/decline, confirm_record:yes/no

### Flex Messages (`lib/line-messages.ts`)
- [ ] `welcomeNewFlex()` — ยินดีต้อนรับ + [ลงทะเบียน]
- [ ] `welcomeBackFlex(firstName, bib)` — welcome back + [ลงทะเบียนงานใหม่]
- [ ] `consentFlex()` — PDPA summary + [ยอมรับ] [ไม่ยอมรับ] postback
- [ ] `confirmRecordFlex(firstName, lastName, dob)` — [ใช่คือฉัน] [ไม่ใช่] postback
- [ ] `successFlex(firstName, bib, eventName)` — ลงทะเบียนสำเร็จ ✓
- [ ] `errorMessage(type)` — BIB ไม่พบ / ถูกใช้แล้ว / consent declined

### LIFF Page
- [ ] สร้าง route `(register)/register/[eventId]/page.tsx` — public, ไม่ต้อง auth
- [ ] `liff.init()` + `liff.getProfile()` → pre-fill ชื่อ
- [ ] Form: ชื่อ / นามสกุล / วันเกิด (date picker) / เพศ — pre-fill ถ้ามี record เดิม
- [ ] Server action `registerViaLine` — สร้าง athlete + registration + ผูก LINE ID
- [ ] Server action `linkLineId` — ผูก LINE ID กับ record ที่ import ไว้แล้ว
- [ ] Server action `recordConsent` — บันทึก consent version `"2025-v1"`

### Dashboard
- [ ] Event form: เพิ่ม field `bibStart` / `bibEnd`
- [ ] Event detail page: เพิ่มปุ่ม "คัดลอก Registration Link" (LINE LIFF URL)

### Test
- [ ] Flow 1: New member — Add OA → BIB → consent → LIFF form → success
- [ ] Flow 2: Existing member — Add OA → welcome back → BIB ใหม่ → skip consent → pre-filled LIFF → success
- [ ] Flow 3: Imported member — BIB → confirm record → ผูก LINE ID → success
- [ ] Edge cases: BIB นอก pool, BIB ถูกใช้แล้ว, กด consent decline
