import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SERVICE_SECONDS,
  effectiveServiceSeconds,
  estimateWaitSeconds,
  nextRollingAverage,
  requeueSortSeq,
} from '@/lib/queue-core'

describe('effectiveServiceSeconds', () => {
  it('คืน avg เมื่อมีค่า', () => {
    expect(effectiveServiceSeconds(300)).toBe(300)
  })
  it('คืน default เมื่อ null', () => {
    expect(effectiveServiceSeconds(null)).toBe(DEFAULT_SERVICE_SECONDS)
  })
})

describe('estimateWaitSeconds', () => {
  it('peopleAhead × service', () => {
    expect(estimateWaitSeconds(3, 120)).toBe(360)
  })
  it('คิวข้างหน้า 0 → 0', () => {
    expect(estimateWaitSeconds(0, 120)).toBe(0)
  })
  it('ใช้ default เมื่อ avg null', () => {
    expect(estimateWaitSeconds(2, null)).toBe(2 * DEFAULT_SERVICE_SECONDS)
  })
})

describe('nextRollingAverage', () => {
  it('ค่าแรก (prev null) = sample', () => {
    expect(nextRollingAverage(null, 200)).toBe(200)
  })
  it('EMA: 0.3*sample + 0.7*prev', () => {
    // 0.3*200 + 0.7*100 = 60 + 70 = 130
    expect(nextRollingAverage(100, 200)).toBe(130)
  })
  it('ปัดเป็นจำนวนเต็ม', () => {
    // 0.3*101 + 0.7*100 = 30.3 + 70 = 100.3 → 100
    expect(nextRollingAverage(100, 101)).toBe(100)
  })
  it('ตัด sample ที่ผิดปกติ (ติดลบ/ใหญ่เกิน) ทิ้ง คืน prev', () => {
    expect(nextRollingAverage(100, -5)).toBe(100)
    expect(nextRollingAverage(100, 999999)).toBe(100)
  })
})

describe('requeueSortSeq', () => {
  it('ไม่มี waiting อื่น → ถัดจาก serving', () => {
    expect(requeueSortSeq(5, null)).toBe(6)
  })
  it('ไม่มี serving และไม่มี waiting → 0', () => {
    expect(requeueSortSeq(null, null)).toBe(0)
  })
  it('แทรกระหว่าง serving กับ waiting ตัวแรก', () => {
    // serving=5, minWaiting=10 → 7.5
    expect(requeueSortSeq(5, 10)).toBe(7.5)
  })
  it('serving null → ก่อน waiting ตัวแรก', () => {
    // serving=null, minWaiting=10 → 9
    expect(requeueSortSeq(null, 10)).toBe(9)
  })
})
