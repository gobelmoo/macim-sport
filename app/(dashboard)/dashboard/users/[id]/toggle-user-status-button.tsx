'use client'

import { useActionState } from 'react'
import { CheckCircle2, ShieldAlert, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toggleUserStatusAction } from '../actions'

interface Props {
  userId: string
  currentStatus: 'active' | 'hidden' | 'inactive'
}

export function ToggleUserStatusButton({ userId, currentStatus }: Props) {
  const isActive = currentStatus === 'active'
  const newStatus = isActive ? 'inactive' : 'active'
  const boundToggle = toggleUserStatusAction.bind(null, userId, newStatus)
  const [state, formAction, isPending] = useActionState(boundToggle, undefined)

  const error = state && 'error' in state ? state.error : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="size-4" />
          สถานะบัญชี
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <div>
            {isActive ? (
              <>
                <div className="flex items-center gap-2 font-medium">
                  <XCircle className="size-4 text-destructive" />
                  ปิดใช้งานบัญชี
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  ผู้ใช้จะไม่สามารถเข้าสู่ระบบได้
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="size-4 text-green-600" />
                  เปิดใช้งานบัญชี
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  ผู้ใช้จะสามารถเข้าสู่ระบบได้อีกครั้ง
                </p>
              </>
            )}
          </div>
          <form action={formAction}>
            <Button
              type="submit"
              variant={isActive ? 'destructive' : 'default'}
              size="sm"
              disabled={isPending}
            >
              {isPending
                ? isActive ? 'กำลังปิด...' : 'กำลังเปิด...'
                : isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
            </Button>
          </form>
        </div>
        {error && (
          <p className="mt-3 text-sm text-destructive">{error}</p>
        )}
      </CardContent>
    </Card>
  )
}
