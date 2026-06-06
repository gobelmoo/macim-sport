import { describe, expect, it } from 'vitest'
import { isValidBib } from '@/lib/line-state'

describe('isValidBib', () => {
  it.each([
    ['123', true],
    ['ABC', true],
    ['A-1', true],
    ['A1B2-CD3E', true],
    ['A1B2C3D4E5', true],
    ['', false],
    ['12345678901', false],
    ['A@1', false],
    ['A 1', false],
    ['ABC-123-XYZ', false],
  ])('isValidBib(%s) → %s', (bib, expected) => {
    expect(isValidBib(bib)).toBe(expected)
  })
})
