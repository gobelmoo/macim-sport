# Standalone Queue Operator Board (no-login) — Plan Addendum

ต่อยอด: หน้าคุมคิวแบบ standalone ให้ staff เปิดที่ station บน iPad/มือถือ **ไม่ต้อง login** (โมเดลเดียวกับ `/self-checkin/[token]`)

**ไม่มี migration** — เปลี่ยนเฉพาะโค้ด (deploy = push)

## โมเดล security (สำคัญ)
token ของ queue ใช้ 2 scope แยกกัน เพื่อกันนักกีฬาที่สแกน QR เอา token ไปคุมคิว:
- `request` — token ใน QR นักกีฬา (LIFF ขอคิว) ทำได้แค่ขอคิว
- `operate` — token ในลิงก์หน้าคุมคิว staff ทำ next/skip/requeue/reset/add/open-close ได้
admin เห็นลิงก์ operate ได้จาก dashboard board (ต้อง login) แล้วเอาไปเปิดบนอุปกรณ์ staff

## 1. `lib/queue-token.ts`
```ts
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

export type QueueTokenScope = 'request' | 'operate'

export interface QueueTokenPayload extends JWTPayload {
  counterId: string
  eventId: string
  scope: QueueTokenScope
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not set')
  return new TextEncoder().encode(secret)
}

export async function signQueueToken(payload: QueueTokenPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(getSecret())
}

export async function verifyQueueToken(
  token: string,
  expectedScope?: QueueTokenScope,
): Promise<QueueTokenPayload | null> {
  try {
    const { payload } = await jwtVerify<QueueTokenPayload>(token, getSecret())
    if (!payload.counterId || !payload.eventId) return null
    if (expectedScope && payload.scope !== expectedScope) return null
    return payload
  } catch {
    return null
  }
}
```
> `scope` เป็น required → TS จะ error ทุก call site ของ `signQueueToken` ที่ยังไม่ใส่ scope ให้แก้ให้ครบ

## 2. LIFF actions ต้อง verify scope 'request'
`app/(liff)/queue/[token]/actions.ts` — `getQueueContext` และ `requestQueue`: เปลี่ยน `verifyQueueToken(token)` → `verifyQueueToken(token, 'request')` (ทั้ง 2 ฟังก์ชัน)

## 3. board actions รองรับ token (operate) หรือ session
`app/(dashboard)/dashboard/events/[id]/queue/[counterId]/board/actions.ts`:
- เพิ่ม import `verifyQueueToken` จาก `@/lib/queue-token`
- เปลี่ยน `authorize()`:
```ts
async function authorize(
  eventId: string,
  counterId: string,
  token?: string,
): Promise<boolean> {
  if (token) {
    const p = await verifyQueueToken(token, 'operate')
    return !!p && p.counterId === counterId && p.eventId === eventId
  }
  const session = await auth()
  return !!session?.user && canAccess(PERMISSIONS.QUEUE_OPERATE, session.user)
}
```
- เพิ่มพารามิเตอร์ `token?: string` ต่อท้ายทุก action และส่งเข้า `authorize(eventId, counterId, token)`:
  `toggleOpenAction(eventId, counterId, isOpen, token?)`,
  `resetCounterAction(eventId, counterId, token?)`,
  `nextQueueAction(eventId, counterId, token?)`,
  `skipEntryAction(eventId, counterId, entryId, token?)`,
  `requeueEntryAction(eventId, counterId, entryId, token?)`,
  `addByBibAction(eventId, counterId, rawBib, token?)`,
  `addNonMemberAction(eventId, counterId, rawLabel, token?)`
- revalidate: เพิ่ม revalidate path ของ standalone เมื่อมี token:
```ts
function revalidateBoard(eventId: string, counterId: string, token?: string) {
  if (token) revalidatePath(`/station-queue/${token}`)
  else revalidatePath(`/dashboard/events/${eventId}/queue/${counterId}/board`)
}
```
ทุก action ส่ง token เข้า revalidateBoard ด้วย

## 4. QueueBoard รองรับ 2 โหมด
`.../board/_components/queue-board.tsx`:
- เพิ่ม props: `token?: string` (operate token; undefined = dashboard/session), `operatorUrl?: string` (ลิงก์หน้า staff; โชว์เฉพาะ dashboard)
- ส่ง `token` เป็น arg สุดท้ายของทุก action call เช่น:
  `toggleOpenAction(eventId, counterId, !board.counter.isOpen, token)`,
  `resetCounterAction(eventId, counterId, token)`,
  `nextQueueAction(eventId, counterId, token)`,
  `skipEntryAction(eventId, counterId, e.entryId, token)`,
  `requeueEntryAction(eventId, counterId, e.entryId, token)`,
  `addByBibAction(eventId, counterId, bib, token)`,
  `addNonMemberAction(eventId, counterId, guest, token)`
- ใน header ถ้า `operatorUrl` มีค่า: แสดงปุ่ม QR เพิ่ม (ใช้ `QueueQrButton`) สำหรับลิงก์ staff
  → generalize `QueueQrButton` ให้รับ prop `triggerLabel?` และ `description?` (default เดิม "QR Code" / "นักกีฬาสแกน QR เพื่อรับคิว"); ปุ่ม staff ใช้ triggerLabel="หน้าจอ Staff" description="เปิดหน้าคุมคิวบนอุปกรณ์ staff (ไม่ต้องล็อกอิน)"

## 5. `QueueQrButton` — generalize
`.../queue/_components/queue-qr-button.tsx`: เพิ่ม optional props `triggerLabel = 'QR Code'`, `description = 'นักกีฬาสแกน QR เพื่อรับคิว'`, ใช้แทนค่าคงที่เดิม (ไม่กระทบ call site เดิมเพราะมี default)

## 6. dashboard board page — gen operator link
`.../board/page.tsx`:
- เพิ่ม `APP_BASE` (pattern เดียวกับ `lib/line-state.ts`: `AUTH_URL ?? VERCEL_URL ?? localhost` + ตัด trailing slash)
- liffUrl token → `scope: 'request'`
- เพิ่ม operatorUrl:
```ts
const operatorUrl = `${APP_BASE}/station-queue/${await signQueueToken({ counterId, eventId, scope: 'operate' })}`
```
- `<QueueBoard eventId={eventId} board={board} liffUrl={liffUrl} operatorUrl={operatorUrl} />` (ไม่ส่ง token → session mode)

## 7. route ใหม่: standalone operator board (no login)
`app/(station-queue)/station-queue/[token]/page.tsx`:
```tsx
import { notFound } from 'next/navigation'
import { getBoard } from '@/db/queries/queue'
import { signQueueToken, verifyQueueToken } from '@/lib/queue-token'
import { QueueBoard } from '@/app/(dashboard)/dashboard/events/[id]/queue/[counterId]/board/_components/queue-board'

const LIFF_BASE = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}`

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ token: string }>
}

export default async function StationQueuePage({ params }: Props) {
  const { token } = await params
  const payload = await verifyQueueToken(token, 'operate')
  if (!payload) notFound()

  const board = await getBoard(payload.counterId)
  if (!board || board.counter.eventId !== payload.eventId) notFound()

  // QR ให้นักกีฬา (scope request) แสดงบนหน้า staff ด้วย
  const liffUrl = `${LIFF_BASE}/queue/${await signQueueToken({
    counterId: payload.counterId,
    eventId: payload.eventId,
    scope: 'request',
  })}`

  return (
    <main className="mx-auto max-w-3xl">
      <QueueBoard
        eventId={payload.eventId}
        board={board}
        liffUrl={liffUrl}
        token={token}
      />
    </main>
  )
}
```
> import QueueBoard ข้าม route group ได้ (เป็น client component ปกติ). ถ้า path ยาวเกินอ่านยาก ใช้ alias `@/app/(dashboard)/...`. route group `(station-queue)` ไม่ต้องมี layout (root layout ครอบ html/body อยู่แล้ว เหมือน `(self-checkin)`)

## 8. ตรวจ
- `pnpm typecheck` ผ่าน (scope required จะบังคับแก้ทุก call site signQueueToken: board page, station-queue page, liff ไม่ได้ sign — เฉพาะ verify)
- `pnpm build` ผ่าน — มี route `/station-queue/[token]`
- `pnpm test` 39/39
- ตรวจ logic: athlete token (request) เปิด `/station-queue/[token]` ต้อง `notFound` (scope ไม่ตรง); operate token เปิด LIFF ต้องถูก reject เช่นกัน (getQueueContext verify 'request')
