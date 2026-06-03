# Event Detail + Tabs Design

**Date:** 2026-06-03
**Status:** Approved

## Summary

Refactor the event detail page to separate the view from the edit form, and embed Stations and Athletes as tabs instead of separate navigation links.

## Route Structure

| Route | Purpose |
|-------|---------|
| `/dashboard/events/[id]` | Detail view with 3 tabs |
| `/dashboard/events/[id]/edit` | Edit form (new — owner/manager only) |
| `/dashboard/events/[id]/stations` | Kept as-is for backward compatibility (QR links) |
| `/dashboard/events/[id]/import` | Kept as-is (POST-MVP placeholder) |

## Detail Page (`[id]/page.tsx`)

### Header

- Event name + status badge + type badge
- Buttons (right-aligned):
  - **แก้ไข** → `/edit` (visible only when `canEdit`)
  - **StatusButtons** (publish / active / close)
  - **DeleteEventButton** (visible only when `canEdit` and `status === 'draft'`)

### Tabs

Tab state stored in URL searchParams (`?tab=stations`, `?tab=athletes`). Default tab is `ข้อมูล`.

#### Tab: ข้อมูล (default)

Read-only info grid (`<dl>`) — always shown to all roles:

- ชื่องาน, Sponsor, สถานที่, เมือง, ผู้จัด, ช่วงเวลา, ประเภท

#### Tab: Stations

Embed the full Stations management UI directly in the tab:

- Station table (ชื่อ, ประเภท, Stamp on Add Friend, สถานะ, Self Check-in QR, actions)
- Add Station form (shown when `canFullEdit`)
- Toggle / Edit / Delete station buttons (same permission rules as current `/stations/page.tsx`)
- Station token/QR generation logic stays the same

The `/stations/page.tsx` route is kept unchanged for backward compatibility with existing QR links.

#### Tab: นักกีฬา

List of athletes registered to this event:

- Columns: ชื่อ-นามสกุล, รหัสนักกีฬา (bibNumber), สถานะ, จำนวน Stamp
- Data source: new `listAthletesByEvent(eventId)` query
- Read-only for all roles (no inline edit)
- Empty state: "ยังไม่มีนักกีฬา — ใช้ปุ่มนำเข้าข้อมูลเพื่อเพิ่ม"
- Import button link → `/import` (shown when `canEdit`)

## Edit Page (`[id]/edit/page.tsx`)

- Accessible only to `SUPER_ADMIN_OWNER` and `SUPER_ADMIN_MANAGER`
- Header: "แก้ไข: [event name]" + "ยกเลิก" button → back to detail
- Body: `EventEditForm` component (same as today, no changes to the form itself)
- On save: redirect to `/dashboard/events/[id]`

## New DB Query

**`listAthletesByEvent(eventId: string)`** in `db/queries/athletes.ts`

```ts
// Returns athletes registered to a specific event with their stamp count
// Joins: athlete_event_registrations → athletes → stamps (count)
// Returns: athleteId, firstName, lastName, bibNumber, status, stampCount
```

## Files to Change

| File | Change |
|------|--------|
| `app/(dashboard)/dashboard/events/[id]/page.tsx` | Refactor: remove inline edit form, add Tabs, embed stations + athletes |
| `app/(dashboard)/dashboard/events/[id]/edit/page.tsx` | **New** — edit form page |
| `db/queries/athletes.ts` | Add `listAthletesByEvent(eventId)` |
| `app/(dashboard)/dashboard/events/[id]/stations/page.tsx` | Keep unchanged |

## Out of Scope

- CSV import implementation (POST-MVP)
- Pagination on athletes tab (add later if needed)
- Athletes tab edit/delete (read-only for now)
