import { clsx } from 'clsx'
import type { ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function initials(name?: string | null, email?: string | null): string {
  return (name ?? email ?? '?').slice(0, 2).toUpperCase()
}

export function formatThaiDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export type RawSearchParam = string | string[] | undefined

export function oneParam(v: RawSearchParam): string | undefined {
  if (Array.isArray(v)) return v[0]
  return v ?? undefined
}
