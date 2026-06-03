# MACIM SPORT — Tech Stack

> คัดลอกจาก `Widely-Backend` เป็นหลัก  
> ระบุเฉพาะจุดที่ต่างออกไป

---

## Stack Overview

| Layer | Technology | เหมือน Widely |
|-------|-----------|--------------|
| Framework | Next.js 16 (App Router) | ✓ |
| Language | TypeScript | ✓ |
| Database | Neon (serverless PostgreSQL) | ✓ |
| ORM | Drizzle ORM | ✓ |
| Auth | **Auth.js v5 — Credentials** (Email+Password) | ⚠ ต่าง (Widely ใช้ Magic Link) |
| UI Components | shadcn/ui (radix-nova style) | ✓ |
| CSS | Tailwind CSS v4 | ✓ |
| Font | Noto Sans Thai + Geist Mono | ✓ |
| Icons | Lucide React | ✓ |
| Forms | React Hook Form + Zod | ✓ |
| Toast | Sonner | ✓ |
| Theme | next-themes (light/dark) | ✓ |
| Package Manager | pnpm | ✓ |
| Hosting | Vercel | ✓ |

---

## จุดที่ต่างจาก Widely-Backend

### Auth Provider: Credentials แทน Magic Link

Widely ใช้ **Nodemailer (Magic Link)** — ผู้ใช้รับลิงก์ทางอีเมล  
MACIM ใช้ **Credentials (Email + Password)** — ตาม Requirement ที่กำหนด

```ts
// Widely (ลบออก)
import Nodemailer from 'next-auth/providers/nodemailer'

// MACIM (ใช้แทน)
import Credentials from 'next-auth/providers/credentials'
```

ต้องเพิ่ม:
- `bcryptjs` สำหรับ hash/verify password
- `password_hash` field ใน `users` table (ไม่ใช้ NextAuth users table แบบ Widely)
- Login form แบบ username + password (ไม่ใช่ Magic Link form)

### Role System: Fixed ENUM แทน Dynamic DB Roles

Widely: roles เก็บใน DB (`role`, `role_permission`, `user_role` tables) — เพิ่มได้ตลอด  
MACIM: roles เป็น ENUM คงที่ 5 ค่า ไม่มีการเพิ่ม role ใหม่

```ts
// MACIM roles (fixed ENUM — ไม่ต้องมี role/permission tables)
export const ROLES = {
  SUPER_ADMIN_OWNER:   'super_admin_owner',
  SUPER_ADMIN_MANAGER: 'super_admin_manager',
  SUPER_ADMIN_VIEWER:  'super_admin_viewer',
  SPONSOR_ADMIN:       'sponsor_admin',
  SPONSOR_STAFF:       'sponsor_staff',
} as const
```

เนื่องจาก roles คงที่ → ไม่ต้องมี `role`, `role_permission`, `user_role` tables  
→ เก็บ role ตรงใน `users.role` column พอ

### users Table: ใช้ Schema ของตัวเองแทน NextAuth schema

Widely: users table ตาม NextAuth Drizzle Adapter  
MACIM: users table กำหนดเองตาม Requirement

```ts
// MACIM users table (แทนที่ NextAuth users)
export const users = pgTable('users', {
  userId:      idColumn(),
  email:       text().unique().notNull(),
  passwordHash: text().notNull(),
  phoneNumber: text(),
  role:        roleEnum().notNull(),
  sponsorId:   text().references(() => sponsors.sponsorId, { onDelete: 'set null' }),
  lineUserId:  text(),
  status:      statusEnum().default('active').notNull(),
  createdAt:   createdAtColumn(),
  lastLoginAt: timestamp({ mode: 'date' }),
  ipAddress:   text(),
})
```

---

## สิ่งที่ copy จาก Widely ได้เลย (ไม่เปลี่ยน)

### 1. โครงสร้าง Project

```
app/
  (auth)/         ← หน้า sign-in (ปรับ UI เป็น email+password)
  (dashboard)/    ← layout + ทุก page
  api/
    auth/[...nextauth]/route.ts
db/
  schema/
    _common.ts    ← idColumn, createdAtColumn (copy ได้เลย)
    auth.ts       ← ปรับให้ตรง MACIM schema
    ...           ← เพิ่ม tables ของ MACIM
  queries/
    authz.ts      ← ปรับ query ให้ตรง role system ใหม่
  index.ts        ← copy pattern เดิม
  seed.ts
components/
  layout/
    app-sidebar.tsx   ← copy + เปลี่ยนเมนู
    nav-main.tsx      ← copy
    nav-user.tsx      ← copy
    theme-switcher.tsx ← copy ได้เลย
    theme-provider.tsx ← copy ได้เลย
  ui/             ← shadcn components ทั้งหมด
lib/
  rbac.ts         ← ปรับ ROLES/PERMISSIONS ให้ตรง MACIM
  utils.ts        ← copy ได้เลย
auth.config.ts    ← copy ได้เลย (ปรับ redirect paths)
drizzle.config.ts ← copy ได้เลย
components.json   ← copy ได้เลย
```

### 2. Dashboard Layout Pattern

```tsx
// copy จาก Widely (dashboard)/layout.tsx เกือบทั้งหมด
// เปลี่ยนแค่ authz logic ให้ตรง role แบบ MACIM
<SidebarProvider>
  <AppSidebar authz={authz} user={...} signOutAction={...} />
  <SidebarInset>
    <header>...</header>
    <div>{children}</div>
  </SidebarInset>
</SidebarProvider>
```

### 3. Font + Theme + Layout

```tsx
// app/layout.tsx — copy เกือบทั้งหมด เปลี่ยนแค่ title/description
Noto_Sans_Thai + Geist_Mono
ThemeProvider + TooltipProvider + Toaster
```

### 4. Drizzle + Neon Pattern

```ts
// db/index.ts — copy pattern เดิม 100%
const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle(sql, { schema: { ...allSchemas } })
```

### 5. `_common.ts` Helpers

```ts
// ใช้เหมือนเดิม
export const idColumn = () => text().primaryKey().$defaultFn(() => crypto.randomUUID())
export const createdAtColumn = () => timestamp({ mode: 'date' }).defaultNow().notNull()
```

---

## Environment Variables (.env.local)

```bash
# Database (Neon)
DATABASE_URL=

# Auth.js
AUTH_SECRET=          # openssl rand -base64 32
AUTH_URL=http://localhost:3000

# ไม่ต้องมี EMAIL_SERVER (ใช้ Credentials แทน Magic Link)
# ไม่ต้องมี R2 ใน MVP (ยังไม่มี file upload)
```

---

## RBAC ของ MACIM (เทียบกับ Widely)

### Widely
```
Role (DB) → RolePermission (DB) → Permission strings
```

### MACIM
```
Role (ENUM hardcoded) → Permission strings (hardcoded ใน rbac.ts)
```

```ts
// lib/rbac.ts สำหรับ MACIM
export const ROLE_PERMISSIONS = {
  super_admin_owner:   '*',
  super_admin_manager: ['event:create', 'event:edit', 'sponsor:create', ...],
  super_admin_viewer:  ['event:view', 'sponsor:view', 'report:view'],
  sponsor_admin:       ['event:view_own', 'athlete:view_own', 'report:view_own'],
  sponsor_staff:       ['checkin:create'],  // เข้าได้แค่หน้า Check-in
} as const
```

### Data Isolation สำหรับ Sponsor

Sponsor roles ต้องมี `sponsorId` ใน session เสมอ เพื่อ filter ข้อมูล:

```ts
// jwt callback — เพิ่มใน MACIM
token.sponsorId = user.sponsorId ?? null
```

---

## packages.json — ต่างจาก Widely

### เอาออก
```
@auth/drizzle-adapter   ← ไม่ต้องใช้ (ใช้ Credentials ไม่ใช้ Adapter)
nodemailer              ← ไม่ต้องใช้
@types/nodemailer
```

### เพิ่มเข้า
```
bcryptjs                ← hash/verify password
@types/bcryptjs
```

### คงไว้เหมือนเดิม
```
next, react, react-dom, drizzle-orm, @neondatabase/serverless
next-auth, next-themes, shadcn, tailwindcss
react-hook-form, @hookform/resolvers, zod
sonner, lucide-react, clsx, tailwind-merge
date-fns, drizzle-kit, tsx, typescript, vitest
```
