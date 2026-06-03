import { redirect } from 'next/navigation'
import { auth } from '@/auth'

export default async function CheckinLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  return <div className="min-h-screen bg-background">{children}</div>
}
