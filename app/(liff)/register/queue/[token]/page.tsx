// LIFF endpoint URL ของ LIFF ID ตั้งไว้ที่หน้า /register → เมื่อสแกน QR แบบ
// path (liff.line.me/{id}/queue/{token}) LINE จะต่อ path เป็น
// /register/queue/{token} จึงต้องมี route ตรงนี้ (mirror ของ /queue/[token])
import { QueueRequest } from '@/app/(liff)/queue/[token]/_components/queue-request'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ token: string }>
}

export default async function RegisterQueueLiffPage({ params }: Props) {
  const { token } = await params
  return <QueueRequest token={token} />
}
