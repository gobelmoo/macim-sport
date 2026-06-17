import { describe, expect, it } from 'vitest'
import { isValidBib, resolveFallbackText, shouldAutoReply } from '@/lib/line-state'

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

describe('resolveFallbackText', () => {
  it('คืนข้อความเมื่อเปิดและมีข้อความ', () => {
    expect(resolveFallbackText({ fallbackEnabled: true, fallbackMessage: 'hi' })).toBe('hi')
  })
  it('คืน null เมื่อปิด', () => {
    expect(resolveFallbackText({ fallbackEnabled: false, fallbackMessage: 'hi' })).toBeNull()
  })
  it('คืน null เมื่อข้อความว่าง/มีแต่ช่องว่าง', () => {
    expect(resolveFallbackText({ fallbackEnabled: true, fallbackMessage: '   ' })).toBeNull()
  })
  it('trim ช่องว่างหัวท้าย', () => {
    expect(resolveFallbackText({ fallbackEnabled: true, fallbackMessage: ' hi ' })).toBe('hi')
  })
})

describe('shouldAutoReply', () => {
  it('คืน true เมื่อเปิด', () => {
    expect(shouldAutoReply({ autoReplyEnabled: true })).toBe(true)
  })
  it('คืน false เมื่อปิด', () => {
    expect(shouldAutoReply({ autoReplyEnabled: false })).toBe(false)
  })
})
