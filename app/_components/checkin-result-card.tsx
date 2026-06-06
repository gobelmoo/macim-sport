import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import type { CheckinResult } from '@/app/(checkin)/checkin/[stationId]/types'

interface Props {
  result: CheckinResult
  bib: string
  onReset: () => void
}

export function CheckinResultCard({ result, bib, onReset }: Props) {
  if (!result.found) {
    return (
      <div className="rounded-2xl border-2 border-muted-foreground/20 bg-muted/40 p-8 text-center">
        <p className="text-3xl font-bold">เข้าใช้บริการได้เลย</p>
        <p className="mt-2 text-lg text-muted-foreground">BIB: {bib}</p>
        <div className="mt-5 rounded-xl border border-[#06C755]/40 bg-[#06C755]/10 px-5 py-4">
          <p className="text-base font-semibold text-[#06C755]">รับสิทธิ์ประโยชน์ภายหลัง</p>
          <p className="mt-1 text-sm text-muted-foreground">
            เพิ่มเพื่อนใน LINE เพื่อลงทะเบียนย้อนหลัง
          </p>
        </div>
        <ResetButton onReset={onReset} />
      </div>
    )
  }

  const { athlete, isDuplicate } = result
  const initials = `${athlete.firstName[0] ?? ''}${athlete.lastName[0] ?? ''}`.toUpperCase()

  if (isDuplicate) {
    return (
      <div className="rounded-2xl border-2 border-amber-500 bg-amber-500/10 p-8">
        <AthleteHeader firstName={athlete.firstName} lastName={athlete.lastName} profileImageUrl={athlete.profileImageUrl} initials={initials} bib={bib} />
        <div className="mt-6 rounded-xl bg-amber-500/20 px-6 py-4">
          <p className="text-2xl font-semibold text-amber-700 dark:text-amber-400">เคยใช้บริการแล้ว</p>
          <p className="mt-1 text-xl text-amber-600 dark:text-amber-300">เข้าได้ปกติ — ไม่ได้รับ Stamp เพิ่ม</p>
        </div>
        <ResetButton onReset={onReset} />
      </div>
    )
  }

  return (
    <div className="rounded-2xl border-2 border-green-500 bg-green-500/10 p-8">
      <AthleteHeader firstName={athlete.firstName} lastName={athlete.lastName} profileImageUrl={athlete.profileImageUrl} initials={initials} bib={bib} />
      <div className="mt-6 rounded-xl bg-green-500/20 px-6 py-4">
        <p className="text-2xl font-semibold text-green-700 dark:text-green-400">เช็คอินสำเร็จ ✓</p>
        <p className="mt-1 text-xl text-green-600 dark:text-green-300">ได้รับ Stamp เรียบร้อยแล้ว</p>
      </div>
      <ResetButton onReset={onReset} />
    </div>
  )
}

function AthleteHeader({ firstName, lastName, profileImageUrl, initials, bib }: {
  firstName: string; lastName: string; profileImageUrl: string | null; initials: string; bib: string
}) {
  return (
    <div className="flex items-center gap-6">
      <Avatar className="h-24 w-24 shrink-0 text-2xl">
        {profileImageUrl && <AvatarImage src={profileImageUrl} alt="athlete photo" />}
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 overflow-hidden">
        <p className="truncate text-4xl font-bold">{firstName} {lastName}</p>
        <p className="mt-1 font-mono text-2xl text-muted-foreground">BIB: {bib}</p>
      </div>
    </div>
  )
}

function ResetButton({ onReset }: { onReset: () => void }) {
  return (
    <Button size="lg" variant="outline" className="mt-6 h-16 w-full text-xl" onClick={onReset}>
      เช็คอินใหม่
    </Button>
  )
}
