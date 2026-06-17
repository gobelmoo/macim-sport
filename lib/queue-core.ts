/** ค่า default เวลา serve ต่อคิว (วินาที) ใช้ตอนยังไม่มีประวัติจริง */
export const DEFAULT_SERVICE_SECONDS = 600

/** น้ำหนัก EMA ของ sample ใหม่ */
const ROLLING_ALPHA = 0.3

/** ขอบเขต sample ที่สมเหตุสมผล (วินาที) — กันค่าผิดปกติทำลายค่าเฉลี่ย */
const MIN_SAMPLE_SECONDS = 1
const MAX_SAMPLE_SECONDS = 60 * 60

export function effectiveServiceSeconds(avg: number | null): number {
  return avg ?? DEFAULT_SERVICE_SECONDS
}

export function estimateWaitSeconds(
  peopleAhead: number,
  avg: number | null,
): number {
  return peopleAhead * effectiveServiceSeconds(avg)
}

/**
 * อัปเดต rolling average แบบ EMA.
 * - ครั้งแรก (prev null) คืน sample
 * - sample ที่อยู่นอกช่วงสมเหตุสมผล → ทิ้ง คืน prev เดิม (default ถ้า prev null)
 */
export function nextRollingAverage(
  prev: number | null,
  sampleSeconds: number,
): number {
  if (
    !Number.isFinite(sampleSeconds) ||
    sampleSeconds < MIN_SAMPLE_SECONDS ||
    sampleSeconds > MAX_SAMPLE_SECONDS
  ) {
    return prev ?? DEFAULT_SERVICE_SECONDS
  }
  if (prev === null) return Math.round(sampleSeconds)
  return Math.round(ROLLING_ALPHA * sampleSeconds + (1 - ROLLING_ALPHA) * prev)
}

/**
 * คำนวณ sortSeq สำหรับ "แทรกคิวที่ข้ามไปแล้วกลับมาเป็นลำดับถัดไป".
 * ต้องการให้คิวที่แทรกถูกเรียกหลัง serving ปัจจุบัน แต่ก่อน waiting ตัวอื่นทั้งหมด.
 */
export function requeueSortSeq(
  servingSortSeq: number | null,
  minWaitingSortSeq: number | null,
): number {
  if (minWaitingSortSeq === null) {
    return (servingSortSeq ?? -1) + 1
  }
  if (servingSortSeq === null) {
    return minWaitingSortSeq - 1
  }
  return (servingSortSeq + minWaitingSortSeq) / 2
}
