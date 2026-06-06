# Event Media Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่ม event logo, description, long description (Tiptap rich text), และ gallery ภาพพร้อม caption ให้ admin จัดการใน dashboard และนักกีฬาเห็นใน LIFF

**Architecture:** เพิ่ม 3 columns ใน `events` table + ตาราง `event_gallery_images` แยก (sortOrder + caption) เพื่อ CRUD ทีละรูปได้ ไฟล์รูปเก็บใน Cloudflare R2 ผ่าน API route `/api/upload` ที่ใช้ `@aws-sdk/client-s3` รูปถูก upload ก่อน แล้วเก็บแค่ URL ใน DB

**Tech Stack:** Drizzle ORM, Neon PostgreSQL, Cloudflare R2 (`@aws-sdk/client-s3`), Tiptap (`@tiptap/react` + `@tiptap/starter-kit` + `@tiptap/extension-link`), Next.js Server Actions, React `useTransition`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `db/schema/events.ts` | Modify | เพิ่ม 3 columns: eventLogoUrl, description, longDescription |
| `db/schema/event_gallery_images.ts` | Create | ตาราง gallery ใหม่ |
| `db/queries/events.ts` | Modify | เพิ่ม EventRow fields + getEventDetail() |
| `db/queries/event_gallery_images.ts` | Create | CRUD queries สำหรับ gallery |
| `lib/r2.ts` | Create | R2 S3Client instance |
| `app/api/upload/route.ts` | Create | API route upload รูปไป R2 |
| `components/tiptap-editor.tsx` | Create | Tiptap rich text editor component |
| `components/image-upload.tsx` | Create | Image picker + R2 upload component |
| `app/(dashboard)/dashboard/events/actions.ts` | Modify | เพิ่ม media fields ใน createEventSchema |
| `app/(dashboard)/dashboard/events/[id]/actions.ts` | Modify | เพิ่ม media fields ใน updateEventSchema + gallery actions |
| `app/(dashboard)/dashboard/events/new/event-form.tsx` | Modify | เพิ่ม logo + description + longDescription fields |
| `app/(dashboard)/dashboard/events/[id]/event-edit-form.tsx` | Modify | เพิ่ม logo + description + longDescription fields |
| `app/(dashboard)/dashboard/events/[id]/_components/gallery-section.tsx` | Create | Client component จัดการ gallery (add/delete/caption/reorder) |
| `app/(dashboard)/dashboard/events/[id]/edit/page.tsx` | Modify | fetch gallery images + pass ให้ GallerySection |
| `app/(liff)/event/[eventId]/page.tsx` | Create | LIFF event detail page (server component) |

---

## Task 1: Install dependencies

**Files:** `package.json`

- [ ] **Step 1: Install packages**

```bash
pnpm add @aws-sdk/client-s3 @tiptap/react @tiptap/starter-kit @tiptap/extension-link
```

- [ ] **Step 2: Verify packages installed**

```bash
grep -E "@aws-sdk|@tiptap" package.json
```

Expected: เห็น 4 packages ใหม่ใน dependencies

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add @aws-sdk/client-s3 and tiptap packages"
```

---

## Task 2: DB Schema — events columns + gallery table

**Files:**
- Modify: `db/schema/events.ts`
- Create: `db/schema/event_gallery_images.ts`

- [ ] **Step 1: เพิ่ม 3 columns ใน events schema**

แก้ `db/schema/events.ts` — เพิ่ม 3 fields ก่อน `createdAt`:

```ts
import { boolean, date, index, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { createdAtColumn, idColumn, statusEnum } from './_common'
import { sponsors } from './sponsors'

export const eventTypeEnum = pgEnum('event_type', [
  'run',
  'triathlon',
  'other',
])

export const eventStatusEnum = pgEnum('event_status', [
  'draft',
  'published',
  'active',
  'closed',
  'archived',
])

export const events = pgTable('events', {
  eventId: idColumn(),
  sponsorId: text()
    .notNull()
    .references(() => sponsors.sponsorId, { onDelete: 'restrict' }),
  eventName: text().notNull(),
  eventLocation: text().notNull(),
  eventCity: text().notNull(),
  eventType: eventTypeEnum().default('run').notNull(),
  organizerName: text().notNull(),
  startDate: date().notNull(),
  endDate: date().notNull(),
  isPublic: boolean().default(false).notNull(),
  hasParticipantImport: boolean().default(false).notNull(),
  status: eventStatusEnum().default('draft').notNull(),
  eventLogoUrl: text(),
  description: text(),
  longDescription: text(),
  createdAt: createdAtColumn(),
}, (t) => [
  index('events_sponsor_id_idx').on(t.sponsorId),
])
```

- [ ] **Step 2: สร้าง gallery schema**

สร้างไฟล์ใหม่ `db/schema/event_gallery_images.ts`:

```ts
import { index, integer, pgTable, text } from 'drizzle-orm/pg-core'
import { createdAtColumn, idColumn } from './_common'
import { events } from './events'

export const eventGalleryImages = pgTable('event_gallery_images', {
  imageId: idColumn(),
  eventId: text()
    .notNull()
    .references(() => events.eventId, { onDelete: 'cascade' }),
  imageUrl: text().notNull(),
  caption: text(),
  sortOrder: integer().default(0).notNull(),
  createdAt: createdAtColumn(),
}, (t) => [
  index('gallery_images_event_id_idx').on(t.eventId),
])
```

- [ ] **Step 3: Generate migration**

```bash
pnpm db:generate
```

Expected: สร้างไฟล์ใหม่ใน `db/migrations/` (เช่น `0005_event_media_fields.sql`)

- [ ] **Step 4: Apply migration**

```bash
pnpm db:push
```

Expected: `All migrations applied successfully` หรือไม่มี error

- [ ] **Step 5: Commit**

```bash
git add db/schema/events.ts db/schema/event_gallery_images.ts db/migrations/
git commit -m "feat: add event media columns and gallery table"
```

---

## Task 3: DB Queries

**Files:**
- Modify: `db/queries/events.ts`
- Create: `db/queries/event_gallery_images.ts`

- [ ] **Step 1: อัปเดต EventRow type และ getEvent/listEvents queries**

แก้ `db/queries/events.ts` — เพิ่ม fields ใหม่ใน `EventRow`, `UpdateEventData`, `getEvent`, `listEvents`, และเพิ่ม `getEventDetail`:

```ts
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { events } from '@/db/schema/events'
import { sponsors } from '@/db/schema/sponsors'
import type { eventStatusEnum, eventTypeEnum } from '@/db/schema/events'

export type EventRow = {
  eventId: string
  sponsorId: string
  eventName: string
  eventLocation: string
  eventCity: string
  eventType: (typeof eventTypeEnum.enumValues)[number]
  organizerName: string
  startDate: string
  endDate: string
  isPublic: boolean
  hasParticipantImport: boolean
  status: (typeof eventStatusEnum.enumValues)[number]
  createdAt: Date
  sponsorName: string
  eventLogoUrl: string | null
  description: string | null
  longDescription: string | null
}

export type CreateEventData = {
  sponsorId: string
  eventName: string
  eventLocation: string
  eventCity: string
  eventType: (typeof eventTypeEnum.enumValues)[number]
  organizerName: string
  startDate: string
  endDate: string
  eventLogoUrl?: string | null
  description?: string | null
  longDescription?: string | null
}

export type UpdateEventData = Partial<CreateEventData>

export type EventDetailRow = {
  eventId: string
  eventName: string
  eventLocation: string
  eventCity: string
  eventType: (typeof eventTypeEnum.enumValues)[number]
  organizerName: string
  startDate: string
  endDate: string
  status: (typeof eventStatusEnum.enumValues)[number]
  eventLogoUrl: string | null
  description: string | null
  longDescription: string | null
}

const EVENT_SELECT_FIELDS = {
  eventId: events.eventId,
  sponsorId: events.sponsorId,
  eventName: events.eventName,
  eventLocation: events.eventLocation,
  eventCity: events.eventCity,
  eventType: events.eventType,
  organizerName: events.organizerName,
  startDate: events.startDate,
  endDate: events.endDate,
  isPublic: events.isPublic,
  hasParticipantImport: events.hasParticipantImport,
  status: events.status,
  createdAt: events.createdAt,
  sponsorName: sponsors.sponsorName,
  eventLogoUrl: events.eventLogoUrl,
  description: events.description,
  longDescription: events.longDescription,
}

export async function listEvents(sponsorId?: string): Promise<EventRow[]> {
  return db
    .select(EVENT_SELECT_FIELDS)
    .from(events)
    .innerJoin(sponsors, eq(events.sponsorId, sponsors.sponsorId))
    .where(sponsorId ? eq(events.sponsorId, sponsorId) : undefined)
    .orderBy(desc(events.startDate))
}

export async function getEvent(eventId: string): Promise<EventRow | undefined> {
  const [row] = await db
    .select(EVENT_SELECT_FIELDS)
    .from(events)
    .innerJoin(sponsors, eq(events.sponsorId, sponsors.sponsorId))
    .where(eq(events.eventId, eventId))
    .limit(1)

  return row
}

export async function getEventDetail(eventId: string): Promise<EventDetailRow | undefined> {
  const [row] = await db
    .select({
      eventId: events.eventId,
      eventName: events.eventName,
      eventLocation: events.eventLocation,
      eventCity: events.eventCity,
      eventType: events.eventType,
      organizerName: events.organizerName,
      startDate: events.startDate,
      endDate: events.endDate,
      status: events.status,
      eventLogoUrl: events.eventLogoUrl,
      description: events.description,
      longDescription: events.longDescription,
    })
    .from(events)
    .where(eq(events.eventId, eventId))
    .limit(1)

  return row
}

export async function createEvent(data: CreateEventData): Promise<{ eventId: string }> {
  const [row] = await db
    .insert(events)
    .values(data)
    .returning({ eventId: events.eventId })

  return row
}

export async function updateEvent(
  eventId: string,
  data: UpdateEventData,
): Promise<{ eventId: string }> {
  const [row] = await db
    .update(events)
    .set(data)
    .where(eq(events.eventId, eventId))
    .returning({ eventId: events.eventId })

  return row
}

export async function updateEventStatus(
  eventId: string,
  status: (typeof eventStatusEnum.enumValues)[number],
): Promise<{ eventId: string }> {
  const [row] = await db
    .update(events)
    .set({ status })
    .where(eq(events.eventId, eventId))
    .returning({ eventId: events.eventId })

  return row
}

export async function deleteDraftEvent(eventId: string): Promise<boolean> {
  const [row] = await db
    .delete(events)
    .where(and(eq(events.eventId, eventId), eq(events.status, 'draft')))
    .returning({ eventId: events.eventId })

  return !!row
}
```

- [ ] **Step 2: สร้าง gallery queries**

สร้าง `db/queries/event_gallery_images.ts`:

```ts
import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { eventGalleryImages } from '@/db/schema/event_gallery_images'

export type GalleryImageRow = {
  imageId: string
  eventId: string
  imageUrl: string
  caption: string | null
  sortOrder: number
}

export async function listGalleryImages(eventId: string): Promise<GalleryImageRow[]> {
  return db
    .select({
      imageId: eventGalleryImages.imageId,
      eventId: eventGalleryImages.eventId,
      imageUrl: eventGalleryImages.imageUrl,
      caption: eventGalleryImages.caption,
      sortOrder: eventGalleryImages.sortOrder,
    })
    .from(eventGalleryImages)
    .where(eq(eventGalleryImages.eventId, eventId))
    .orderBy(asc(eventGalleryImages.sortOrder))
}

export async function addGalleryImage(data: {
  eventId: string
  imageUrl: string
  caption?: string
}): Promise<{ imageId: string }> {
  const existing = await listGalleryImages(data.eventId)
  const sortOrder = existing.length > 0
    ? Math.max(...existing.map((i) => i.sortOrder)) + 1
    : 0

  const [row] = await db
    .insert(eventGalleryImages)
    .values({ ...data, sortOrder })
    .returning({ imageId: eventGalleryImages.imageId })

  return row
}

export async function deleteGalleryImage(imageId: string): Promise<boolean> {
  const [row] = await db
    .delete(eventGalleryImages)
    .where(eq(eventGalleryImages.imageId, imageId))
    .returning({ imageId: eventGalleryImages.imageId })

  return !!row
}

export async function updateGalleryCaption(
  imageId: string,
  caption: string | null,
): Promise<void> {
  await db
    .update(eventGalleryImages)
    .set({ caption })
    .where(eq(eventGalleryImages.imageId, imageId))
}

export async function reorderGalleryImages(orderedImageIds: string[]): Promise<void> {
  await Promise.all(
    orderedImageIds.map((imageId, index) =>
      db
        .update(eventGalleryImages)
        .set({ sortOrder: index })
        .where(eq(eventGalleryImages.imageId, imageId)),
    ),
  )
}
```

- [ ] **Step 3: ตรวจ TypeScript ไม่มี error**

```bash
pnpm typecheck 2>&1 | head -20
```

Expected: ไม่มี error ที่ไฟล์ events.ts หรือ event_gallery_images.ts

- [ ] **Step 4: Commit**

```bash
git add db/queries/events.ts db/queries/event_gallery_images.ts
git commit -m "feat: add gallery queries and extend event queries with media fields"
```

---

## Task 4: R2 Client + Upload API Route

**Files:**
- Create: `lib/r2.ts`
- Create: `app/api/upload/route.ts`

- [ ] **Step 1: เพิ่ม env vars ใน .env.local**

เปิด `.env.local` แล้วเพิ่ม:

```
CLOUDFLARE_R2_ACCOUNT_ID=<your-account-id>
CLOUDFLARE_R2_ACCESS_KEY_ID=<your-access-key>
CLOUDFLARE_R2_SECRET_ACCESS_KEY=<your-secret-key>
CLOUDFLARE_R2_BUCKET_NAME=<your-bucket-name>
CLOUDFLARE_R2_PUBLIC_URL=https://<your-public-domain>
```

- [ ] **Step 2: สร้าง R2 client**

สร้าง `lib/r2.ts`:

```ts
import { S3Client } from '@aws-sdk/client-s3'

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

export const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME!
export const R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL!
```

- [ ] **Step 3: สร้าง upload API route**

สร้าง `app/api/upload/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { auth } from '@/auth'
import { ROLES } from '@/lib/rbac'
import { r2, R2_BUCKET, R2_PUBLIC_URL } from '@/lib/r2'

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

export async function POST(req: NextRequest) {
  const session = await auth()
  const role = session?.user?.role
  if (role !== ROLES.SUPER_ADMIN_OWNER && role !== ROLES.SUPER_ADMIN_MANAGER) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })
  }

  const ext = file.type.split('/')[1]
  const key = `events/${crypto.randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    }),
  )

  return NextResponse.json({ url: `${R2_PUBLIC_URL}/${key}` })
}
```

- [ ] **Step 4: TypeScript check**

```bash
pnpm typecheck 2>&1 | grep -E "lib/r2|api/upload"
```

Expected: ไม่มี error

- [ ] **Step 5: Commit**

```bash
git add lib/r2.ts app/api/upload/route.ts
git commit -m "feat: add Cloudflare R2 client and upload API route"
```

---

## Task 5: Tiptap Editor Component

**Files:**
- Create: `components/tiptap-editor.tsx`

- [ ] **Step 1: สร้าง TiptapEditor component**

สร้าง `components/tiptap-editor.tsx`:

```tsx
'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link2,
  Heading2,
  Heading3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type TiptapEditorProps = {
  name: string
  defaultValue?: string | null
}

export function TiptapEditor({ name, defaultValue }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
    ],
    content: defaultValue ?? '',
    immediatelyRender: false,
  })

  if (!editor) return null

  function handleLinkToggle() {
    if (editor!.isActive('link')) {
      editor!.chain().focus().unsetLink().run()
    } else {
      const url = window.prompt('URL:')
      if (url) editor!.chain().focus().setLink({ href: url }).run()
    }
  }

  return (
    <div className="rounded-md border">
      <div className="flex flex-wrap gap-1 border-b p-2">
        <Button
          type="button" variant="ghost" size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'bg-muted' : ''}
        >
          <Bold className="size-4" />
        </Button>
        <Button
          type="button" variant="ghost" size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'bg-muted' : ''}
        >
          <Italic className="size-4" />
        </Button>
        <Button
          type="button" variant="ghost" size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={editor.isActive('heading', { level: 2 }) ? 'bg-muted' : ''}
        >
          <Heading2 className="size-4" />
        </Button>
        <Button
          type="button" variant="ghost" size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={editor.isActive('heading', { level: 3 }) ? 'bg-muted' : ''}
        >
          <Heading3 className="size-4" />
        </Button>
        <Button
          type="button" variant="ghost" size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'bg-muted' : ''}
        >
          <List className="size-4" />
        </Button>
        <Button
          type="button" variant="ghost" size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? 'bg-muted' : ''}
        >
          <ListOrdered className="size-4" />
        </Button>
        <Button
          type="button" variant="ghost" size="sm"
          onClick={handleLinkToggle}
          className={editor.isActive('link') ? 'bg-muted' : ''}
        >
          <Link2 className="size-4" />
        </Button>
      </div>

      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none min-h-[140px] p-3 focus-within:outline-none"
      />

      <input type="hidden" name={name} value={editor.getHTML()} />
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
pnpm typecheck 2>&1 | grep "tiptap-editor"
```

Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add components/tiptap-editor.tsx
git commit -m "feat: add TiptapEditor component (bold/italic/heading/list/link)"
```

---

## Task 6: Image Upload Component

**Files:**
- Create: `components/image-upload.tsx`

- [ ] **Step 1: สร้าง ImageUpload component**

สร้าง `components/image-upload.tsx`:

```tsx
'use client'

import { useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ImageUploadProps = {
  /** ชื่อ hidden input สำหรับ form submit */
  name?: string
  defaultValue?: string | null
  label?: string
  /** callback เมื่อ upload สำเร็จ (ใช้แทน hidden input สำหรับ gallery) */
  onUpload?: (url: string) => void
}

export function ImageUpload({
  name,
  defaultValue,
  label = 'อัปโหลดรูป',
  onUpload,
}: ImageUploadProps) {
  const [url, setUrl] = useState(defaultValue ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setLoading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      if (onUpload) {
        onUpload(data.url)
      } else {
        setUrl(data.url)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const showPreview = !onUpload && url

  return (
    <div className="space-y-2">
      {name && <input type="hidden" name={name} value={url} />}

      {showPreview ? (
        <div className="relative inline-block">
          <img
            src={url}
            alt="preview"
            className="h-32 w-auto rounded-md border object-cover"
          />
          <button
            type="button"
            onClick={() => setUrl('')}
            className="absolute -right-2 -top-2 flex items-center justify-center rounded-full bg-destructive p-1 text-white"
          >
            <X className="size-3" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mr-2 size-4" />
          {loading ? 'กำลังอัปโหลด...' : label}
        </Button>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
pnpm typecheck 2>&1 | grep "image-upload"
```

Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add components/image-upload.tsx
git commit -m "feat: add ImageUpload component with R2 upload support"
```

---

## Task 7: Server Actions — media fields + gallery actions

**Files:**
- Modify: `app/(dashboard)/dashboard/events/actions.ts`
- Modify: `app/(dashboard)/dashboard/events/[id]/actions.ts`

- [ ] **Step 1: เพิ่ม media fields ใน createEventSchema (events/actions.ts)**

แก้ `app/(dashboard)/dashboard/events/actions.ts` — เพิ่ม 3 fields ใน schema และ raw object:

```ts
'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { auth } from '@/auth'
import { ROLES } from '@/lib/rbac'
import { createEvent, updateEvent, updateEventStatus } from '@/db/queries/events'
import type { eventStatusEnum } from '@/db/schema/events'

export type ActionState = {
  error?: string
  fieldErrors?: Record<string, string[]>
}

const createEventSchema = z.object({
  sponsorId: z.string().min(1, 'กรุณาเลือก Sponsor'),
  eventName: z.string().min(1, 'กรุณาระบุชื่องาน'),
  eventLocation: z.string().min(1, 'กรุณาระบุสถานที่'),
  eventCity: z.string().min(1, 'กรุณาระบุเมือง'),
  eventType: z.enum(['run', 'triathlon', 'other']),
  organizerName: z.string().min(1, 'กรุณาระบุชื่อผู้จัด'),
  startDate: z.string().min(1, 'กรุณาระบุวันที่เริ่ม'),
  endDate: z.string().min(1, 'กรุณาระบุวันที่สิ้นสุด'),
  eventLogoUrl: z.string().url().optional().or(z.literal('')),
  description: z.string().max(300).optional(),
  longDescription: z.string().optional(),
})

const updateEventSchema = createEventSchema.partial()

async function assertOwnerOrManager() {
  const session = await auth()
  const role = session?.user?.role
  if (role !== ROLES.SUPER_ADMIN_OWNER && role !== ROLES.SUPER_ADMIN_MANAGER) {
    throw new Error('ไม่มีสิทธิ์ดำเนินการนี้')
  }
  return session!
}

export async function createEventAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertOwnerOrManager()

  const raw = {
    sponsorId: formData.get('sponsorId'),
    eventName: formData.get('eventName'),
    eventLocation: formData.get('eventLocation'),
    eventCity: formData.get('eventCity'),
    eventType: formData.get('eventType'),
    organizerName: formData.get('organizerName'),
    startDate: formData.get('startDate'),
    endDate: formData.get('endDate'),
    eventLogoUrl: formData.get('eventLogoUrl') || undefined,
    description: formData.get('description') || undefined,
    longDescription: formData.get('longDescription') || undefined,
  }

  const parsed = createEventSchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const { eventId } = await createEvent(parsed.data)
  redirect(`/dashboard/events/${eventId}`)
}

export async function updateEventAction(
  eventId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertOwnerOrManager()

  const raw = {
    sponsorId: formData.get('sponsorId') ?? undefined,
    eventName: formData.get('eventName') ?? undefined,
    eventLocation: formData.get('eventLocation') ?? undefined,
    eventCity: formData.get('eventCity') ?? undefined,
    eventType: formData.get('eventType') ?? undefined,
    organizerName: formData.get('organizerName') ?? undefined,
    startDate: formData.get('startDate') ?? undefined,
    endDate: formData.get('endDate') ?? undefined,
    eventLogoUrl: formData.get('eventLogoUrl') || undefined,
    description: formData.get('description') || undefined,
    longDescription: formData.get('longDescription') || undefined,
  }

  const parsed = updateEventSchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  await updateEvent(eventId, parsed.data)
  redirect(`/dashboard/events/${eventId}`)
}

export async function updateEventStatusAction(
  eventId: string,
  newStatus: (typeof eventStatusEnum.enumValues)[number],
): Promise<ActionState> {
  await assertOwnerOrManager()
  await updateEventStatus(eventId, newStatus)
  return {}
}
```

- [ ] **Step 2: อัปเดต [id]/actions.ts — updateEventSchema + gallery actions**

`edit/page.tsx` import จาก `[id]/actions.ts` ซึ่งมี `updateEventAction` และ `updateEventSchema` ของตัวเอง ต้องเพิ่ม fields ใหม่ที่นี่ด้วย

แทนที่ทั้งไฟล์ `app/(dashboard)/dashboard/events/[id]/actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { auth } from '@/auth'
import { ROLES } from '@/lib/rbac'
import {
  deleteDraftEvent,
  getEvent,
  updateEvent,
  updateEventStatus,
} from '@/db/queries/events'
import {
  createStation,
  deleteStation,
  toggleStationStatus,
  updateStation,
} from '@/db/queries/stations'
import {
  addGalleryImage,
  deleteGalleryImage,
  updateGalleryCaption,
  reorderGalleryImages,
} from '@/db/queries/event_gallery_images'
import type { eventStatusEnum } from '@/db/schema/events'

export type ActionState = {
  success?: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

const updateEventSchema = z.object({
  sponsorId: z.string().min(1, 'กรุณาเลือก Sponsor').optional(),
  eventName: z.string().min(1, 'กรุณาระบุชื่องาน').optional(),
  eventLocation: z.string().min(1, 'กรุณาระบุสถานที่').optional(),
  eventCity: z.string().min(1, 'กรุณาระบุเมือง').optional(),
  eventType: z.enum(['run', 'triathlon', 'other']).optional(),
  organizerName: z.string().min(1, 'กรุณาระบุชื่อผู้จัด').optional(),
  startDate: z.string().min(1, 'กรุณาระบุวันที่เริ่ม').optional(),
  endDate: z.string().min(1, 'กรุณาระบุวันที่สิ้นสุด').optional(),
  eventLogoUrl: z.string().url().optional().or(z.literal('')),
  description: z.string().max(300).optional(),
  longDescription: z.string().optional(),
})

const stationSchema = z.object({
  stationType: z.enum(['air_recovery', 'ice_bath', 'other']),
  stationName: z.string().min(1, 'กรุณาระบุชื่อ Station'),
  stampOnAddFriend: z.boolean(),
})

async function assertOwnerOrManager() {
  const session = await auth()
  const role = session?.user?.role
  if (role !== ROLES.SUPER_ADMIN_OWNER && role !== ROLES.SUPER_ADMIN_MANAGER) {
    throw new Error('ไม่มีสิทธิ์ดำเนินการนี้')
  }
}

export async function updateEventAction(
  eventId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertOwnerOrManager()

  const raw = {
    sponsorId: formData.get('sponsorId') ?? undefined,
    eventName: formData.get('eventName') ?? undefined,
    eventLocation: formData.get('eventLocation') ?? undefined,
    eventCity: formData.get('eventCity') ?? undefined,
    eventType: formData.get('eventType') ?? undefined,
    organizerName: formData.get('organizerName') ?? undefined,
    startDate: formData.get('startDate') ?? undefined,
    endDate: formData.get('endDate') ?? undefined,
    eventLogoUrl: formData.get('eventLogoUrl') || undefined,
    description: formData.get('description') || undefined,
    longDescription: formData.get('longDescription') || undefined,
  }

  const parsed = updateEventSchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  await updateEvent(eventId, parsed.data)
  revalidatePath(`/dashboard/events/${eventId}`)
  return {}
}

export async function updateEventStatusAction(
  eventId: string,
  newStatus: (typeof eventStatusEnum.enumValues)[number],
): Promise<void> {
  await assertOwnerOrManager()
  await updateEventStatus(eventId, newStatus)
  revalidatePath(`/dashboard/events/${eventId}`)
}

export async function createStationAction(
  eventId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertOwnerOrManager()

  const raw = {
    stationType: formData.get('stationType'),
    stationName: formData.get('stationName'),
    stampOnAddFriend: formData.get('stampOnAddFriend') === 'on',
  }

  const parsed = stationSchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  await createStation({ eventId, ...parsed.data })
  revalidatePath(`/dashboard/events/${eventId}/stations`)
  redirect(`/dashboard/events/${eventId}/stations`)
}

export async function updateStationAction(
  stationId: string,
  eventId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertOwnerOrManager()

  const raw = {
    stationType: formData.get('stationType'),
    stationName: formData.get('stationName'),
    stampOnAddFriend: formData.get('stampOnAddFriend') === 'on',
  }

  const parsed = stationSchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  await updateStation(stationId, parsed.data)
  revalidatePath(`/dashboard/events/${eventId}/stations`)
  return { success: true }
}

export async function toggleStationStatusAction(
  stationId: string,
  eventId: string,
): Promise<void> {
  await assertOwnerOrManager()
  await toggleStationStatus(stationId)
  revalidatePath(`/dashboard/events/${eventId}/stations`)
}

export async function deleteStationAction(
  stationId: string,
  eventId: string,
): Promise<void> {
  await assertOwnerOrManager()
  const event = await getEvent(eventId)
  if (!event || event.status === 'active') throw new Error('ลบ station ไม่ได้เมื่อ event กำลังจัดงาน')
  await deleteStation(stationId)
  revalidatePath(`/dashboard/events/${eventId}/stations`)
}

export async function deleteEventAction(eventId: string): Promise<void> {
  await assertOwnerOrManager()
  const deleted = await deleteDraftEvent(eventId)
  if (!deleted) throw new Error('ลบไม่ได้ — event ไม่ใช่ draft หรือไม่พบ')
  revalidatePath('/dashboard/events')
  redirect('/dashboard/events')
}
```

จากนั้นเพิ่ม 4 gallery functions ท้ายไฟล์ (หลัง deleteEventAction):

```ts
export async function addGalleryImageAction(
  eventId: string,
  imageUrl: string,
  caption: string | null | undefined,
): Promise<{ imageId: string } | { error: string }> {
  await assertOwnerOrManager()
  try {
    const { imageId } = await addGalleryImage({
      eventId,
      imageUrl,
      caption: caption ?? undefined,
    })
    revalidatePath(`/dashboard/events/${eventId}/edit`)
    return { imageId }
  } catch {
    return { error: 'เพิ่มรูปไม่สำเร็จ' }
  }
}

export async function deleteGalleryImageAction(
  imageId: string,
  eventId: string,
): Promise<void> {
  await assertOwnerOrManager()
  await deleteGalleryImage(imageId)
  revalidatePath(`/dashboard/events/${eventId}/edit`)
}

export async function updateGalleryCaptionAction(
  imageId: string,
  eventId: string,
  caption: string | null,
): Promise<void> {
  await assertOwnerOrManager()
  await updateGalleryCaption(imageId, caption)
  revalidatePath(`/dashboard/events/${eventId}/edit`)
}

export async function reorderGalleryAction(
  eventId: string,
  orderedImageIds: string[],
): Promise<void> {
  await assertOwnerOrManager()
  await reorderGalleryImages(orderedImageIds)
  revalidatePath(`/dashboard/events/${eventId}/edit`)
}
```

- [ ] **Step 3: TypeScript check**

```bash
pnpm typecheck 2>&1 | grep -E "events/actions|events/\[id\]/actions"
```

Expected: ไม่มี error

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/dashboard/events/actions.ts" "app/(dashboard)/dashboard/events/[id]/actions.ts"
git commit -m "feat: add media fields to event actions and gallery server actions"
```

---

## Task 8: Update Create Event Form

**Files:**
- Modify: `app/(dashboard)/dashboard/events/new/event-form.tsx`

- [ ] **Step 1: เพิ่ม logo, description, longDescription ใน EventForm**

แก้ `app/(dashboard)/dashboard/events/new/event-form.tsx` — เพิ่ม import และ fields ใหม่:

```tsx
'use client'

import { useActionState } from 'react'
import { Tag, User, MapPin, Building2, ImageIcon, AlignLeft, FileText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ImageUpload } from '@/components/image-upload'
import { TiptapEditor } from '@/components/tiptap-editor'
import type { ActionState } from '../actions'

type Sponsor = { sponsorId: string; sponsorName: string }

type EventFormProps = {
  sponsors: Sponsor[]
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>
  defaultValues?: {
    sponsorId?: string
    eventName?: string
    eventLocation?: string
    eventCity?: string
    eventType?: string
    organizerName?: string
    startDate?: string
    endDate?: string
    eventLogoUrl?: string
    description?: string
    longDescription?: string
  }
}

function IconField({
  icon: Icon, label, id, name, type, defaultValue, placeholder, error,
}: {
  icon: LucideIcon; label: string; id: string; name: string
  type?: string; defaultValue?: string; placeholder?: string; error?: string[]
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id} name={name} type={type} className="pl-9"
          defaultValue={defaultValue ?? ''} placeholder={placeholder}
          aria-invalid={!!error}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error[0]}</p>}
    </div>
  )
}

export function EventForm({ sponsors, action, defaultValues }: EventFormProps) {
  const [state, formAction, isPending] = useActionState(action, {})

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <p className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      {/* Sponsor */}
      <div className="space-y-1.5">
        <Label htmlFor="sponsorId">Sponsor</Label>
        <Select name="sponsorId" defaultValue={defaultValues?.sponsorId ?? ''}>
          <SelectTrigger id="sponsorId" className="w-full">
            <SelectValue placeholder="เลือก Sponsor" />
          </SelectTrigger>
          <SelectContent>
            {sponsors.map((s) => (
              <SelectItem key={s.sponsorId} value={s.sponsorId}>
                {s.sponsorName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.fieldErrors?.sponsorId && (
          <p className="text-xs text-destructive">{state.fieldErrors.sponsorId[0]}</p>
        )}
      </div>

      <IconField
        icon={Tag} label="ชื่องาน" id="eventName" name="eventName"
        defaultValue={defaultValues?.eventName} placeholder="เช่น MACIM Run 2025"
        error={state.fieldErrors?.eventName}
      />

      <IconField
        icon={User} label="ชื่อผู้จัด" id="organizerName" name="organizerName"
        defaultValue={defaultValues?.organizerName} placeholder="เช่น MACIM SPORT Co., Ltd."
        error={state.fieldErrors?.organizerName}
      />

      {/* Event Type */}
      <div className="space-y-1.5">
        <Label htmlFor="eventType">ประเภทกีฬา</Label>
        <Select name="eventType" defaultValue={defaultValues?.eventType ?? 'run'}>
          <SelectTrigger id="eventType" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="run">วิ่ง (Run)</SelectItem>
            <SelectItem value="triathlon">ไตรกีฬา (Triathlon)</SelectItem>
            <SelectItem value="other">อื่นๆ (Other)</SelectItem>
          </SelectContent>
        </Select>
        {state.fieldErrors?.eventType && (
          <p className="text-xs text-destructive">{state.fieldErrors.eventType[0]}</p>
        )}
      </div>

      <IconField
        icon={MapPin} label="สถานที่จัดงาน" id="eventLocation" name="eventLocation"
        defaultValue={defaultValues?.eventLocation} placeholder="เช่น สนามกีฬาแห่งชาติ"
        error={state.fieldErrors?.eventLocation}
      />

      <IconField
        icon={Building2} label="เมือง / จังหวัด" id="eventCity" name="eventCity"
        defaultValue={defaultValues?.eventCity} placeholder="เช่น กรุงเทพมหานคร"
        error={state.fieldErrors?.eventCity}
      />

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="startDate">วันที่เริ่ม</Label>
          <Input id="startDate" name="startDate" type="date"
            defaultValue={defaultValues?.startDate} required />
          {state.fieldErrors?.startDate && (
            <p className="text-xs text-destructive">{state.fieldErrors.startDate[0]}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endDate">วันที่สิ้นสุด</Label>
          <Input id="endDate" name="endDate" type="date"
            defaultValue={defaultValues?.endDate} required />
          {state.fieldErrors?.endDate && (
            <p className="text-xs text-destructive">{state.fieldErrors.endDate[0]}</p>
          )}
        </div>
      </div>

      {/* Event Logo */}
      <div className="space-y-1.5">
        <Label className="flex items-center gap-2">
          <ImageIcon className="size-4 text-muted-foreground" />
          Logo งาน
        </Label>
        <ImageUpload
          name="eventLogoUrl"
          defaultValue={defaultValues?.eventLogoUrl}
          label="อัปโหลด Logo"
        />
      </div>

      {/* Short Description */}
      <div className="space-y-1.5">
        <Label htmlFor="description" className="flex items-center gap-2">
          <AlignLeft className="size-4 text-muted-foreground" />
          คำอธิบายสั้น
        </Label>
        <Textarea
          id="description"
          name="description"
          placeholder="คำอธิบายงานสั้นๆ (ไม่เกิน 300 ตัวอักษร)"
          maxLength={300}
          defaultValue={defaultValues?.description ?? ''}
          className="resize-none"
          rows={3}
        />
      </div>

      {/* Long Description */}
      <div className="space-y-1.5">
        <Label className="flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" />
          รายละเอียดงาน
        </Label>
        <TiptapEditor name="longDescription" defaultValue={defaultValues?.longDescription} />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'กำลังบันทึก...' : 'สร้าง Event'}
        </Button>
        <Button variant="outline" asChild>
          <a href="/dashboard/events">ยกเลิก</a>
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
pnpm typecheck 2>&1 | grep "event-form"
```

Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/dashboard/events/new/event-form.tsx"
git commit -m "feat: add logo, description, and long description to create event form"
```

---

## Task 9: Edit Form, Gallery Section, Edit Page

**Files:**
- Modify: `app/(dashboard)/dashboard/events/[id]/event-edit-form.tsx`
- Create: `app/(dashboard)/dashboard/events/[id]/_components/gallery-section.tsx`
- Modify: `app/(dashboard)/dashboard/events/[id]/edit/page.tsx`

- [ ] **Step 1: เพิ่ม media fields ใน EventEditForm**

แก้ `app/(dashboard)/dashboard/events/[id]/event-edit-form.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { Tag, User, MapPin, Building2, ImageIcon, AlignLeft, FileText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ImageUpload } from '@/components/image-upload'
import { TiptapEditor } from '@/components/tiptap-editor'
import type { ActionState } from './actions'

type Sponsor = { sponsorId: string; sponsorName: string }

type EventEditFormProps = {
  sponsors: Sponsor[]
  defaultValues: {
    sponsorId: string
    eventName: string
    eventLocation: string
    eventCity: string
    eventType: string
    organizerName: string
    startDate: string
    endDate: string
    eventLogoUrl?: string | null
    description?: string | null
    longDescription?: string | null
  }
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>
}

function IconField({
  icon: Icon, label, id, name, type, defaultValue, placeholder, error,
}: {
  icon: LucideIcon; label: string; id: string; name: string
  type?: string; defaultValue?: string; placeholder?: string; error?: string[]
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id} name={name} type={type} className="pl-9"
          defaultValue={defaultValue ?? ''} placeholder={placeholder}
          aria-invalid={!!error}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error[0]}</p>}
    </div>
  )
}

export function EventEditForm({ sponsors, defaultValues, action }: EventEditFormProps) {
  const [state, formAction, isPending] = useActionState(action, {})

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <p className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      {/* Sponsor */}
      <div className="space-y-1.5">
        <Label htmlFor="sponsorId">Sponsor</Label>
        <Select name="sponsorId" defaultValue={defaultValues.sponsorId}>
          <SelectTrigger id="sponsorId" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sponsors.map((s) => (
              <SelectItem key={s.sponsorId} value={s.sponsorId}>
                {s.sponsorName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.fieldErrors?.sponsorId && (
          <p className="text-xs text-destructive">{state.fieldErrors.sponsorId[0]}</p>
        )}
      </div>

      <IconField
        icon={Tag} label="ชื่องาน" id="eventName" name="eventName"
        defaultValue={defaultValues.eventName} error={state.fieldErrors?.eventName}
      />
      <IconField
        icon={User} label="ชื่อผู้จัด" id="organizerName" name="organizerName"
        defaultValue={defaultValues.organizerName} error={state.fieldErrors?.organizerName}
      />

      {/* Event Type */}
      <div className="space-y-1.5">
        <Label htmlFor="eventType">ประเภทกีฬา</Label>
        <Select name="eventType" defaultValue={defaultValues.eventType}>
          <SelectTrigger id="eventType" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="run">วิ่ง (Run)</SelectItem>
            <SelectItem value="triathlon">ไตรกีฬา (Triathlon)</SelectItem>
            <SelectItem value="other">อื่นๆ (Other)</SelectItem>
          </SelectContent>
        </Select>
        {state.fieldErrors?.eventType && (
          <p className="text-xs text-destructive">{state.fieldErrors.eventType[0]}</p>
        )}
      </div>

      <IconField
        icon={MapPin} label="สถานที่จัดงาน" id="eventLocation" name="eventLocation"
        defaultValue={defaultValues.eventLocation} error={state.fieldErrors?.eventLocation}
      />
      <IconField
        icon={Building2} label="เมือง / จังหวัด" id="eventCity" name="eventCity"
        defaultValue={defaultValues.eventCity} error={state.fieldErrors?.eventCity}
      />

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="startDate">วันที่เริ่ม</Label>
          <Input id="startDate" name="startDate" type="date"
            defaultValue={defaultValues.startDate} required />
          {state.fieldErrors?.startDate && (
            <p className="text-xs text-destructive">{state.fieldErrors.startDate[0]}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endDate">วันที่สิ้นสุด</Label>
          <Input id="endDate" name="endDate" type="date"
            defaultValue={defaultValues.endDate} required />
          {state.fieldErrors?.endDate && (
            <p className="text-xs text-destructive">{state.fieldErrors.endDate[0]}</p>
          )}
        </div>
      </div>

      {/* Event Logo */}
      <div className="space-y-1.5">
        <Label className="flex items-center gap-2">
          <ImageIcon className="size-4 text-muted-foreground" />
          Logo งาน
        </Label>
        <ImageUpload
          name="eventLogoUrl"
          defaultValue={defaultValues.eventLogoUrl}
          label="อัปโหลด Logo"
        />
      </div>

      {/* Short Description */}
      <div className="space-y-1.5">
        <Label htmlFor="description" className="flex items-center gap-2">
          <AlignLeft className="size-4 text-muted-foreground" />
          คำอธิบายสั้น
        </Label>
        <Textarea
          id="description"
          name="description"
          placeholder="คำอธิบายงานสั้นๆ (ไม่เกิน 300 ตัวอักษร)"
          maxLength={300}
          defaultValue={defaultValues.description ?? ''}
          className="resize-none"
          rows={3}
        />
      </div>

      {/* Long Description */}
      <div className="space-y-1.5">
        <Label className="flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" />
          รายละเอียดงาน
        </Label>
        <TiptapEditor name="longDescription" defaultValue={defaultValues.longDescription} />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
        </Button>
        <Button variant="outline" asChild>
          <a href="..">ยกเลิก</a>
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: สร้าง GallerySection client component**

สร้าง `app/(dashboard)/dashboard/events/[id]/_components/gallery-section.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { X, GripVertical } from 'lucide-react'
import { ImageUpload } from '@/components/image-upload'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  addGalleryImageAction,
  deleteGalleryImageAction,
  updateGalleryCaptionAction,
  reorderGalleryAction,
} from '../actions'
import type { GalleryImageRow } from '@/db/queries/event_gallery_images'

type GallerySectionProps = {
  eventId: string
  initialImages: GalleryImageRow[]
}

export function GallerySection({ eventId, initialImages }: GallerySectionProps) {
  const [images, setImages] = useState<GalleryImageRow[]>(initialImages)
  const [isPending, startTransition] = useTransition()
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  async function handleAddImage(url: string) {
    const result = await addGalleryImageAction(eventId, url, null)
    if ('imageId' in result) {
      setImages((prev) => [
        ...prev,
        {
          imageId: result.imageId,
          eventId,
          imageUrl: url,
          caption: null,
          sortOrder: prev.length,
        },
      ])
    }
  }

  function handleDelete(imageId: string) {
    startTransition(async () => {
      await deleteGalleryImageAction(imageId, eventId)
      setImages((prev) => prev.filter((i) => i.imageId !== imageId))
    })
  }

  function handleCaptionBlur(imageId: string, caption: string) {
    const value = caption.trim() || null
    startTransition(async () => {
      await updateGalleryCaptionAction(imageId, eventId, value)
    })
    setImages((prev) =>
      prev.map((i) => (i.imageId === imageId ? { ...i, caption: value } : i)),
    )
  }

  function handleDragStart(index: number) {
    setDragIndex(index)
  }

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) return
    const reordered = [...images]
    const [moved] = reordered.splice(dragIndex, 1)
    reordered.splice(targetIndex, 0, moved)
    setImages(reordered)
    setDragIndex(null)
    startTransition(async () => {
      await reorderGalleryAction(eventId, reordered.map((i) => i.imageId))
    })
  }

  return (
    <div className="space-y-4">
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {images.map((image, index) => (
            <div
              key={image.imageId}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(index)}
              className="group relative space-y-2 rounded-lg border p-2"
            >
              <div className="relative">
                <img
                  src={image.imageUrl}
                  alt=""
                  className="h-32 w-full rounded object-cover"
                />
                <div className="absolute left-2 top-2 cursor-grab text-white opacity-0 group-hover:opacity-100">
                  <GripVertical className="size-4 drop-shadow" />
                </div>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleDelete(image.imageId)}
                  className="absolute right-2 top-2 hidden rounded-full bg-destructive p-1 text-white group-hover:flex"
                >
                  <X className="size-3" />
                </button>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Caption</Label>
                <Input
                  type="text"
                  defaultValue={image.caption ?? ''}
                  placeholder="Caption (optional)"
                  className="h-7 text-xs"
                  onBlur={(e) => handleCaptionBlur(image.imageId, e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <ImageUpload
          label="เพิ่มรูป Gallery"
          onUpload={handleAddImage}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: อัปเดต edit/page.tsx ให้ fetch gallery + ส่ง defaultValues ใหม่**

แก้ `app/(dashboard)/dashboard/events/[id]/edit/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Pencil, Images } from 'lucide-react'
import { auth } from '@/auth'
import { ROLES } from '@/lib/rbac'
import { getEvent } from '@/db/queries/events'
import { listSponsors } from '@/db/queries/sponsors'
import { listGalleryImages } from '@/db/queries/event_gallery_images'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { updateEventAction } from '../actions'
import { EventEditForm } from '../event-edit-form'
import { GallerySection } from '../_components/gallery-section'

type Props = { params: Promise<{ id: string }> }

export default async function EditEventPage({ params }: Props) {
  const { id } = await params

  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const { role } = session.user
  if (role !== ROLES.SUPER_ADMIN_OWNER && role !== ROLES.SUPER_ADMIN_MANAGER) {
    redirect(`/dashboard/events/${id}`)
  }

  const [event, sponsorList, galleryImages] = await Promise.all([
    getEvent(id),
    listSponsors(),
    listGalleryImages(id),
  ])
  if (!event) notFound()

  const boundUpdateAction = updateEventAction.bind(null, id)

  return (
    <main className="p-6 lg:p-8">
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
        <Link href={`/dashboard/events/${id}`}>
          <ChevronLeft className="size-4" />
          {event.eventName}
        </Link>
      </Button>

      <div className="mb-6 flex items-center gap-2">
        <Pencil className="size-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">แก้ไข Event</h1>
      </div>

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Pencil className="size-4" />
              แก้ไขข้อมูล
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EventEditForm
              sponsors={sponsorList}
              defaultValues={{
                sponsorId:       event.sponsorId,
                eventName:       event.eventName,
                eventLocation:   event.eventLocation,
                eventCity:       event.eventCity,
                eventType:       event.eventType,
                organizerName:   event.organizerName,
                startDate:       event.startDate,
                endDate:         event.endDate,
                eventLogoUrl:    event.eventLogoUrl,
                description:     event.description,
                longDescription: event.longDescription,
              }}
              action={boundUpdateAction}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Images className="size-4" />
              Gallery ภาพ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GallerySection eventId={id} initialImages={galleryImages} />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: TypeScript check**

```bash
pnpm typecheck 2>&1 | grep -E "event-edit-form|gallery-section|edit/page"
```

Expected: ไม่มี error

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/dashboard/events/[id]/event-edit-form.tsx" \
        "app/(dashboard)/dashboard/events/[id]/_components/gallery-section.tsx" \
        "app/(dashboard)/dashboard/events/[id]/edit/page.tsx"
git commit -m "feat: add media fields and gallery section to event edit page"
```

---

## Task 10: LIFF Event Detail Page

**Files:**
- Create: `app/(liff)/event/[eventId]/page.tsx`

- [ ] **Step 1: สร้าง LIFF event detail page**

สร้าง directory ก่อน:
```bash
mkdir -p "app/(liff)/event/[eventId]"
```

สร้าง `app/(liff)/event/[eventId]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { MapPin, Calendar, User } from 'lucide-react'
import { getEventDetail } from '@/db/queries/events'
import { listGalleryImages } from '@/db/queries/event_gallery_images'

type Props = { params: Promise<{ eventId: string }> }

export default async function LiffEventDetailPage({ params }: Props) {
  const { eventId } = await params

  const [event, gallery] = await Promise.all([
    getEventDetail(eventId),
    listGalleryImages(eventId),
  ])

  if (!event || event.status === 'draft' || event.status === 'archived') {
    notFound()
  }

  const liffRegisterUrl = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}?eventId=${eventId}`

  return (
    <div className="min-h-screen bg-background">
      {/* Logo */}
      {event.eventLogoUrl ? (
        <img
          src={event.eventLogoUrl}
          alt={event.eventName}
          className="h-48 w-full object-cover"
        />
      ) : (
        <div className="flex h-32 w-full items-center justify-center bg-muted">
          <Calendar className="size-12 text-muted-foreground" />
        </div>
      )}

      <div className="space-y-6 p-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">{event.eventName}</h1>

          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 shrink-0" />
              <span>{event.startDate} – {event.endDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="size-4 shrink-0" />
              <span>{event.eventLocation}, {event.eventCity}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="size-4 shrink-0" />
              <span>{event.organizerName}</span>
            </div>
          </div>

          {event.description && (
            <p className="mt-3 text-sm leading-relaxed">{event.description}</p>
          )}
        </div>

        {/* Long Description */}
        {event.longDescription && (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: event.longDescription }}
          />
        )}

        {/* Gallery */}
        {gallery.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold">Gallery</h2>
            <div className="grid grid-cols-2 gap-2">
              {gallery.map((img) => (
                <div key={img.imageId} className="space-y-1">
                  <img
                    src={img.imageUrl}
                    alt={img.caption ?? ''}
                    className="w-full rounded-lg object-cover aspect-square"
                  />
                  {img.caption && (
                    <p className="text-xs text-muted-foreground text-center">{img.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="pt-4">
          <a
            href={liffRegisterUrl}
            className="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-base font-semibold text-primary-foreground"
          >
            ลงทะเบียน
          </a>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
pnpm typecheck 2>&1 | grep "liff/event"
```

Expected: ไม่มี error

- [ ] **Step 3: Full typecheck**

```bash
pnpm typecheck 2>&1 | tail -5
```

Expected: ไม่มี error เลย

- [ ] **Step 4: Commit**

```bash
git add "app/(liff)/event/"
git commit -m "feat: add LIFF event detail page with logo, description, and gallery"
```

---

## Task 11: Final verification

- [ ] **Step 1: Build check**

```bash
pnpm build 2>&1 | tail -20
```

Expected: Build สำเร็จ ไม่มี error

- [ ] **Step 2: Run tests**

```bash
pnpm test
```

Expected: All tests pass (existing tests ผ่านเหมือนเดิม)

- [ ] **Step 3: ทดสอบ manual ใน dev server**

```bash
pnpm dev
```

ตรวจสอบ:
- [ ] หน้า Create Event — logo upload, description, long description แสดงครบ
- [ ] หน้า Edit Event — logo/description/long description load ค่าเดิมได้ถูกต้อง
- [ ] Gallery section — upload รูปได้ → แสดงใน grid → caption แก้ได้ → ลบได้ → drag reorder ได้
- [ ] หน้า `/liff/event/[eventId]` — แสดง logo, description, gallery ถูกต้อง
- [ ] ปุ่ม Upload ใน `/api/upload` — ไม่ใช่ admin → 401

- [ ] **Step 4: Commit สุดท้าย (ถ้ามีการแก้ไขระหว่าง verify)**

```bash
git add -A
git commit -m "fix: address issues found during final verification"
```
