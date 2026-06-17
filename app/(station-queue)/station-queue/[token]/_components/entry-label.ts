import type { EntryView } from '@/db/queries/queue'

export function entryLabel(e: EntryView): string {
  if (e.isNonMember) return `${e.displayLabel ?? 'ไม่ระบุ'} (ไม่ใช่สมาชิก)`
  const name = e.athleteName ?? ''
  const bib = e.bibNumber ? `#${e.bibNumber}` : ''
  return [name, bib].filter(Boolean).join(' ') || 'ไม่ทราบชื่อ'
}
