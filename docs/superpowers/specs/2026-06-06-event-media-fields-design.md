# Event Media Fields — Design Spec

**Date:** 2026-06-06
**Status:** Approved

## Overview

เพิ่ม field ข้อมูล media และ content ให้ event ได้แก่ event logo, short description, long description (rich text), และ gallery ภาพพร้อม caption เพื่อให้นักกีฬาเห็นรายละเอียดงานใน LIFF app และ admin จัดการได้ใน dashboard

---

## 1. Database Schema

### เพิ่ม columns ใน `events` table

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `eventLogoUrl` | text | yes | URL รูป logo หลัง upload ไป Cloudflare R2 |
| `description` | text | yes | Short description (plain text, ≤ 300 ตัวอักษร) |
| `longDescription` | text | yes | Long description เก็บเป็น Tiptap HTML |

### ตารางใหม่ `event_gallery_images`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `imageId` | text PK | no | cuid |
| `eventId` | text FK | no | → events (onDelete: cascade) |
| `imageUrl` | text | no | URL จาก Cloudflare R2 |
| `caption` | text | yes | optional caption |
| `sortOrder` | integer | no | default 0, ใช้ reorder |
| `createdAt` | timestamp | no | |

Migration: สร้าง SQL file ใหม่ผ่าน `drizzle-kit generate`

---

## 2. Cloudflare R2 Upload

### API Route: `POST /api/upload`

**Flow:**
1. Client ส่ง `multipart/form-data` พร้อมไฟล์
2. Route ตรวจ session (ต้องเป็น admin)
3. Validate ประเภท (`image/*`) และขนาด (≤ 5MB)
4. Upload ไป R2 ด้วย `@aws-sdk/client-s3`
5. Return `{ url: string }` — public URL ของไฟล์

**Environment Variables:**
```
CLOUDFLARE_R2_ACCOUNT_ID
CLOUDFLARE_R2_ACCESS_KEY_ID
CLOUDFLARE_R2_SECRET_ACCESS_KEY
CLOUDFLARE_R2_BUCKET_NAME
CLOUDFLARE_R2_PUBLIC_URL
```

**Package:** `@aws-sdk/client-s3` (R2 ใช้ S3-compatible endpoint)

---

## 3. Admin Dashboard UI

### หน้า Create (`/dashboard/events/new`) และ Edit (`/dashboard/events/[id]`)

เพิ่ม fields ในฟอร์ม:

**Logo Upload**
- แสดง preview รูปปัจจุบัน (ถ้ามี)
- ปุ่ม "อัปโหลด Logo" → file picker → upload `/api/upload` → เก็บ URL ใน hidden input `eventLogoUrl`

**Short Description**
- `<Textarea>` optional, max 300 ตัวอักษร
- แสดง character count

**Long Description**
- Tiptap editor พร้อม toolbar: Bold, Italic, Heading (H2/H3), Bullet list, Number list, Link
- Render preview ด้วย `@tailwindcss/typography` (`prose` class)
- เก็บค่าเป็น HTML string

### Gallery Section (เฉพาะหน้า Edit — ต้องมี eventId ก่อน)

- Grid 3 คอลัมน์แสดงรูปที่มีอยู่
- แต่ละ card มี: thumbnail + caption input + ปุ่มลบ
- ปุ่ม "เพิ่มรูป" → upload R2 → Server Action เพิ่มเข้า DB ทันที (optimistic update)
- Drag-to-reorder ด้วย HTML5 Drag and Drop API (ไม่ต้องติดตั้ง library เพิ่ม)
- Caption บันทึกอัตโนมัติเมื่อ blur (debounce)

---

## 4. LIFF Event Detail Page

### Route: `/liff/event/[eventId]`

**Layout (บนลงล่าง):**
1. Event Logo — full-width image หรือ placeholder
2. ชื่องาน + วันที่ + สถานที่ — ข้อมูลพื้นฐาน
3. Short Description — text ใต้ชื่องาน
4. Long Description — render Tiptap HTML ด้วย `prose` class
5. Gallery — 2-column grid, caption ใต้แต่ละรูป (ถ้ามี)
6. CTA Button — "ลงทะเบียน" → `/liff/register/[eventId]`

**Access:** Public (ไม่ต้อง LINE auth) — ใครมี URL เปิดได้
ปุ่มลงทะเบียนต้องผ่าน LIFF login ตามปกติ

**เปิดจาก:** Flex message ใน LINE chat มีปุ่ม "ดูรายละเอียด" → LIFF URL นี้

---

## 5. Server Actions & Queries

### Gallery Server Actions (`/app/(dashboard)/dashboard/events/[id]/actions.ts`)

```ts
addGalleryImageAction(eventId, imageUrl, caption?)
deleteGalleryImageAction(imageId, eventId)        // ลบจาก DB + R2
updateGalleryCaptionAction(imageId, eventId, caption)
reorderGalleryAction(eventId, orderedImageIds[])
```

### Event Update Schema (ขยาย schema เดิม)

```ts
eventLogoUrl:     z.string().url().optional()
description:      z.string().max(300).optional()
longDescription:  z.string().optional()
```

### DB Queries (`/db/queries/events.ts`)

```ts
getEventWithGallery(eventId)  // join gallery images, sort by sortOrder — admin use
getEventDetail(eventId)       // public — สำหรับ LIFF page
```

---

## 6. New Packages Required

| Package | Purpose |
|---------|---------|
| `@aws-sdk/client-s3` | Upload ไปยัง Cloudflare R2 |
| `@tiptap/react` | Rich text editor |
| `@tiptap/starter-kit` | Tiptap extensions พื้นฐาน |
| `@tiptap/extension-link` | Link extension สำหรับ Tiptap |

---

## 7. Files Affected

| File | Change |
|------|--------|
| `db/schema/events.ts` | เพิ่ม 3 columns ใหม่ |
| `db/schema/event_gallery_images.ts` | ตารางใหม่ |
| `db/schema/index.ts` | export ตารางใหม่ |
| `db/migrations/000X_event_media_fields.sql` | migration ใหม่ |
| `db/queries/events.ts` | เพิ่ม getEventWithGallery, getEventDetail |
| `db/queries/event_gallery_images.ts` | CRUD queries สำหรับ gallery |
| `app/api/upload/route.ts` | API upload R2 (ไฟล์ใหม่) |
| `app/(dashboard)/dashboard/events/new/event-form.tsx` | เพิ่ม logo + description fields |
| `app/(dashboard)/dashboard/events/[id]/event-edit-form.tsx` | เพิ่มทุก fields + gallery section |
| `app/(dashboard)/dashboard/events/[id]/actions.ts` | เพิ่ม gallery actions |
| `app/(liff)/event/[eventId]/page.tsx` | หน้าใหม่ event detail |
| `components/tiptap-editor.tsx` | Tiptap editor component ใหม่ |
| `.env.local` | เพิ่ม R2 env vars |
