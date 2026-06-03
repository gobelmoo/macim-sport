'use client'

import { useState, useTransition } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import type { VariantProps } from 'class-variance-authority'

type ButtonVariant = VariantProps<typeof buttonVariants>['variant']
type ButtonSize = VariantProps<typeof buttonVariants>['size']
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface Props {
  triggerLabel: string
  pendingLabel: string
  title: string
  description: React.ReactNode
  actionLabel: string
  onConfirm: () => void | Promise<void | { message?: string }>
  triggerVariant?: ButtonVariant
  size?: ButtonSize
}

export function ConfirmActionButton({
  triggerLabel,
  pendingLabel,
  title,
  description,
  actionLabel,
  onConfirm,
  triggerVariant = 'outline',
  size = 'sm',
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await onConfirm()
      if (result && typeof result === 'object' && result.message) {
        setError(result.message)
      }
    })
  }

  return (
    <>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant={triggerVariant} size={size} disabled={isPending}>
            {isPending ? pendingLabel : triggerLabel}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>{actionLabel}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
