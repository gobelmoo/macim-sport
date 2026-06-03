'use client'

import { useActionState } from 'react'
import { CheckCircle2, ShieldAlert, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toggleSponsorStatusAction } from '../actions'

interface Props {
  sponsorId: string
  currentStatus: string
}

export function ToggleSponsorStatusButton({ sponsorId, currentStatus }: Props) {
  const isActive = currentStatus === 'active'
  const newStatus = isActive ? 'inactive' : 'active'
  const actionLabel = isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'
  const pendingLabel = isActive ? 'กำลังปิด...' : 'กำลังเปิด...'
  const boundToggle = toggleSponsorStatusAction.bind(null, sponsorId, newStatus)
  const [state, formAction, isPending] = useActionState(boundToggle, undefined)

  const error = state && 'error' in state ? state.error : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="size-4" />
          สถานะ Sponsor
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <div>
            {isActive ? (
              <>
                <div className="flex items-center gap-2 font-medium">
                  <XCircle className="size-4 text-destructive" />
                  ปิดใช้งาน Sponsor
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sponsor จะไม่ปรากฏในระบบ
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="size-4 text-green-600" />
                  เปิดใช้งาน Sponsor
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sponsor จะปรากฏในระบบอีกครั้ง
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
              {isPending ? pendingLabel : actionLabel}
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
