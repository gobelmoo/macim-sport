import { describe, expect, it } from 'vitest'
import {
  askBibMessage,
  errorMessage,
  liffLinkMessage,
  successMessage,
} from '@/lib/line-messages'

describe('errorMessage', () => {
  it.each(['bib_format', 'bib_taken', 'no_events', 'consent_declined'] as const)(
    'returns text message for %s',
    (type) => {
      const msg = errorMessage(type)
      expect(msg.type).toBe('text')
      expect((msg as { text: string }).text.length).toBeGreaterThan(0)
    },
  )
})

describe('askBibMessage', () => {
  it('includes event name', () => {
    const msg = askBibMessage('วิ่งปัตตานี') as { type: string; text: string }
    expect(msg.type).toBe('text')
    expect(msg.text).toContain('วิ่งปัตตานี')
  })
})

describe('successMessage', () => {
  it('includes firstName, bib, eventName', () => {
    const msg = successMessage('สมชาย', 'A-1', 'งานวิ่ง') as { type: string; text: string }
    expect(msg.text).toContain('สมชาย')
    expect(msg.text).toContain('A-1')
    expect(msg.text).toContain('งานวิ่ง')
  })
})

describe('liffLinkMessage', () => {
  it('includes the URL', () => {
    const url = 'https://liff.line.me/2010313814-yt06X2oB/event123'
    const msg = liffLinkMessage(url) as { type: string; text: string }
    expect(msg.text).toContain(url)
  })
})
