# UX/UI Redesign — หน้าจัดการผู้ใช้งาน

**วันที่:** 2026-06-03  
**Scope:** `/dashboard/users` (list, create, edit)  
**Stack:** Next.js App Router, shadcn/ui, Tailwind CSS, Lucide icons

---

## ภาพรวม

ปรับ UX/UI หน้าจัดการผู้ใช้งานทั้งหมดให้สวยงาม มืออาชีพ เข้าใจง่าย และ consistent กัน โดยครอบคลุมทั้ง visual polish และ workflow improvement ได้แก่:

- หน้า list: search + filter + pagination + visual badge พร้อม icon
- หน้า create: card layout แบ่ง section ชัดเจน
- หน้า edit: profile header card + toast feedback + enable/disable สมมาตร

---

## Section 1 — หน้า List (`/dashboard/users`)

### Page Header

- Icon: `Users` (lucide)
- Title: `จัดการผู้ใช้` (text-2xl font-semibold)
- Subtitle: contextual ตาม role
  - super admin: "รายชื่อผู้ใช้ทั้งหมดในระบบ"
  - sponsor_admin: "รายชื่อผู้ใช้ใน Sponsor ของท่าน"
- ปุ่ม "สร้างผู้ใช้": icon `UserPlus`, แสดงเฉพาะ `canCreate === true`

### Search + Filter Bar

แสดงเหนือตาราง เรียงซ้ายไปขวา:

| Element | รายละเอียด |
|---|---|
| Search input | icon `Search` นำหน้า, placeholder "ค้นหา email...", filter client-side บน email |
| Role dropdown | `Select` — ตัวเลือก: ทั้งหมด, Owner, Manager, Viewer, Sponsor Admin, Sponsor Staff |
| Status dropdown | `Select` — ตัวเลือก: ทั้งหมด, ใช้งาน, ปิดใช้งาน |
| ล้างตัวกรอง | ปุ่ม `Button variant="ghost"` icon `X` — แสดงเฉพาะเมื่อมี filter active |

> Search, filter และ pagination ทั้งหมดทำงาน client-side บน data ที่ load มาแล้ว (ไม่ต้อง server round-trip) — เหมาะกับ dataset ขนาด user management ที่ไม่เกินหลักร้อย

### Table Columns

| Column | รายละเอียด |
|---|---|
| (Avatar) | `Avatar` แสดง initials, background สีตาม role group |
| อีเมล | font-medium |
| บทบาท | `Badge` + icon ตาม role (ดูตาราง Role Badge ด้านล่าง) |
| Sponsor | text-muted-foreground, แสดง `—` ถ้าไม่มี |
| สถานะ | `Badge` + icon (ดูตาราง Status Badge ด้านล่าง) |
| วันที่สร้าง | format `dd/MM/yyyy` |
| (Actions) | ปุ่ม icon `Pencil` size="sm" variant="ghost" → link ไปหน้า edit |

#### Role Badge

| Role | Icon | Variant |
|---|---|---|
| Owner | `Crown` | `default` |
| Manager | `ShieldCheck` | `default` |
| Viewer | `Eye` | `secondary` |
| Sponsor Admin | `Building2` | `secondary` |
| Sponsor Staff | `User` | `outline` |

#### Status Badge

| Status | Icon | Variant |
|---|---|---|
| ใช้งาน | `CheckCircle2` | `secondary` + className `bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200` |
| ปิดใช้งาน | `XCircle` | `destructive` |

### Empty State

แสดงเมื่อไม่มีผู้ใช้ในระบบ หรือ filter ไม่พบผลลัพธ์:

```
[Users icon — size-12 text-muted-foreground]
ยังไม่มีผู้ใช้
กด "สร้างผู้ใช้" เพื่อเพิ่มผู้ใช้คนแรก   ← แสดงเฉพาะ empty จริง (ไม่ใช่ filtered empty)
```

กรณี filter ไม่พบ: "ไม่พบผู้ใช้ที่ตรงกับเงื่อนไข"

### Pagination

- แสดงด้านล่างตาราง
- Page size: **20 rows ต่อหน้า** (default)
- Component: shadcn/ui `Pagination` (Previous / หมายเลขหน้า / Next)
- ทำงาน client-side ร่วมกับ search/filter — เมื่อ filter เปลี่ยน reset กลับหน้า 1 อัตโนมัติ
- แสดง label "แสดง X–Y จาก Z รายการ" ทางซ้าย
- ถ้า filtered result มีน้อยกว่า 20 รายการ ซ่อน pagination

---

## Section 2 — หน้า Create (`/dashboard/users/new`)

### Page Header

```
← ผู้ใช้งาน

[UserPlus icon] สร้างผู้ใช้ใหม่
กรอกข้อมูลเพื่อเพิ่มผู้ใช้เข้าสู่ระบบ
```

- ปุ่มกลับ: `Button variant="ghost"` icon `ChevronLeft` → `/dashboard/users`

### Layout

Form อยู่ใน `max-w-lg` แบ่งเป็น 3 Card:

#### Card 1 — ข้อมูลบัญชี (icon: `KeyRound`)

| Field | Type | Validation |
|---|---|---|
| อีเมล * | `Input type="email"` + icon `Mail` | required, format email |
| รหัสผ่าน * | `Input type="password"` + icon `Lock` + toggle show/hide (`Eye`/`EyeOff`) | required, min 8 chars |

#### Card 2 — ข้อมูลติดต่อ (icon: `Phone`)

| Field | Type | Validation |
|---|---|---|
| เบอร์โทรศัพท์ | `Input type="text"` + icon `Phone` | optional |

#### Card 3 — สิทธิ์การใช้งาน (icon: `ShieldCheck`)

| Field | Type | หมายเหตุ |
|---|---|---|
| บทบาท * | `Select` หรือ `Input disabled` | ถ้า creatorRole === sponsor_admin แสดง "Sponsor Staff" disabled |
| Sponsor | `Select` | แสดงเฉพาะเมื่อ selectedRole ∈ [sponsor_admin, sponsor_staff] และ creatorRole ไม่ใช่ sponsor_admin |

#### Footer Actions

```
[UserPlus icon] สร้างผู้ใช้    [ยกเลิก — variant="outline"]
```

---

## Section 3 — หน้า Edit (`/dashboard/users/[id]`)

### Page Header

```
← ผู้ใช้งาน

[Pencil icon] แก้ไขผู้ใช้
```

### Profile Header Card

Card แสดง identity ของ user ที่กำลังแก้ไข:

```
[Avatar lg — initials]
user@example.com  (font-semibold)
[Badge Role + icon]  [Badge Status + icon]  [Badge Sponsor — outline, แสดงถ้ามี]
```

> ไม่มี input ใน card นี้ — read-only เพื่อยืนยัน context

### Card 1 — แก้ไขข้อมูล (icon: `Pencil`)

| Field | Type |
|---|---|
| อีเมล * | `Input type="email"` + icon `Mail` |
| เบอร์โทรศัพท์ | `Input type="text"` + icon `Phone` |

**Actions:** `[Save icon] บันทึก` + `ยกเลิก (variant="outline")`

**Feedback:** เปลี่ยนจาก inline text → `toast` (sonner) แสดง "บันทึกสำเร็จ" / error message

### Card 2 — สถานะบัญชี (icon: `ShieldAlert`)

แสดง 1 ใน 2 state:

**Active → ปิดใช้งาน:**
```
[XCircle icon]  ปิดใช้งานบัญชี
ผู้ใช้จะไม่สามารถเข้าสู่ระบบได้

                [ปิดใช้งาน — variant="destructive"]
```

**Inactive → เปิดใช้งาน:**
```
[CheckCircle2 icon]  เปิดใช้งานบัญชี
ผู้ใช้จะสามารถเข้าสู่ระบบได้อีกครั้ง

                [เปิดใช้งาน — variant="default"]
```

> เพิ่ม **enable กลับ** (ปัจจุบัน logic มีแค่ disable) — ต้องเพิ่ม server action `enableUserAction` และ `EnableUserButton` component

---

## สิ่งที่ต้องเพิ่ม/เปลี่ยนใน codebase

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `app/(dashboard)/dashboard/users/page.tsx` | เพิ่ม search, filter, pagination; ปรับ Badge + Avatar + icon |
| `app/(dashboard)/dashboard/users/new/page.tsx` | ปรับ layout header + back button |
| `app/(dashboard)/dashboard/users/new/new-user-form.tsx` | แบ่ง Card 3 section, เพิ่ม input icon, password toggle |
| `app/(dashboard)/dashboard/users/[id]/page.tsx` | เพิ่ม Profile Header Card, ปรับ layout |
| `app/(dashboard)/dashboard/users/[id]/edit-user-form.tsx` | เปลี่ยน inline feedback → toast |
| `app/(dashboard)/dashboard/users/[id]/disable-user-button.tsx` | เปลี่ยนเป็น `ToggleUserStatusButton` รองรับทั้ง enable/disable |
| `app/(dashboard)/dashboard/users/actions.ts` | เพิ่ม `enableUserAction` |

---

## สิ่งที่ไม่เปลี่ยน

- Logic RBAC และ permission guard ทุกหน้า
- Route structure และ URL pattern
- Server action validation (Zod schema)
- หน้า edit ยังคงเป็นหน้าแยก (ไม่เป็น Sheet/Dialog)
