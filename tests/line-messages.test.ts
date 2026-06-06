import { describe, expect, it } from 'vitest'
import {
  errorMessage,
  successMessage,
} from '@/lib/line-messages'

describe('errorMessage', () => {
  it.each(['no_events'] as const)(
    'returns text message for %s',
    (type) => {
      const msg = errorMessage(type)
      expect(msg.type).toBe('text')
      expect((msg as { text: string }).text.length).toBeGreaterThan(0)
    },
  )
})

describe('successMessage', () => {
  it('includes firstName, bib, eventName', () => {
    const msg = successMessage('สมชาย', 'A-1', 'งานวิ่ง') as { type: string; text: string }
    expect(msg.text).toContain('สมชาย')
    expect(msg.text).toContain('A-1')
    expect(msg.text).toContain('งานวิ่ง')
  })
})
