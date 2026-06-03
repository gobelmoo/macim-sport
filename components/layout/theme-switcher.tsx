'use client'

import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'

const CYCLE = ['light', 'dark', 'system'] as const
type Mode = (typeof CYCLE)[number]

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label="โหมดสี"
        disabled
        suppressHydrationWarning
      >
        <Sun className="size-4 opacity-50" />
      </Button>
    )
  }

  const current: Mode = (CYCLE as readonly string[]).includes(theme ?? '')
    ? (theme as Mode)
    : 'system'

  const Icon =
    current === 'system' ? Monitor : current === 'dark' ? Moon : Sun

  const cycle = () => {
    const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length]
    setTheme(next)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycle}
      aria-label={`โหมด: ${current} — คลิกเพื่อสลับ`}
    >
      <Icon className="size-4" />
    </Button>
  )
}
