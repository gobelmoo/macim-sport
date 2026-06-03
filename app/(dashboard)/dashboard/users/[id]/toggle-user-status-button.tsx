'use client'

import { useActionState } from 'react'
import { CheckCircle2, ShieldAlert, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { disableUserAction, enableUserAction } from '../actions'

interface Props {
  userId: string
  currentStatus: 'active' | 'hidden' | 'inactive'
}

export function ToggleUserStatusButton({ userId, currentStatus }: Props) {
  const isActive = currentStatus === 'active'

  const boundDisable = disableUserAction.bind(null, userId)
  const boundEnable = enableUserAction.bind(null, userId)

  const [disableState, disableAction, isDisablePending] = useActionState(
    boundDisable,
    undefined,
  )
  const [enableState, enableAction, isEnablePending] = useActionState(
    boundEnable,
    undefined,
  )

  const error =
    (disableState && 'error' in disableState && disableState.error) ||
    (enableState && 'error' in enableState && enableState.error)

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
          {isActive ? (
            <form action={disableAction}>
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                disabled={isDisablePending}
              >
                {isDisablePending ? 'กำลังปิด...' : 'ปิดใช้งาน'}
              </Button>
            </form>
          ) : (
            <form action={enableAction}>
              <Button
                type="submit"
                variant="default"
                size="sm"
                disabled={isEnablePending}
              >
                {isEnablePending ? 'กำลังเปิด...' : 'เปิดใช้งาน'}
              </Button>
            </form>
          )}
        </div>
        {error && (
          <p className="mt-3 text-sm text-destructive">{error}</p>
        )}
      </CardContent>
    </Card>
  )
}
