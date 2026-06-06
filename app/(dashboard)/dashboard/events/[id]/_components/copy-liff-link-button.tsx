'use client'

import { useState } from 'react'
import { Link2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  eventId: string
}

export function CopyLiffLinkButton({ eventId }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID
    const url = `https://liff.line.me/${liffId}/${eventId}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
      {copied ? 'คัดลอกแล้ว!' : 'ลิงก์ลงทะเบียน'}
    </Button>
  )
}
