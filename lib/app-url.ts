// Base URLs สำหรับสร้างลิงก์ภายนอก (LINE/LIFF) — ใช้ฝั่ง server เท่านั้น
// (อ้าง AUTH_URL/VERCEL_URL ซึ่งไม่มีฝั่ง client)

export const LIFF_BASE = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}`

export const APP_BASE = (
  process.env.AUTH_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000')
).replace(/\/$/, '')
