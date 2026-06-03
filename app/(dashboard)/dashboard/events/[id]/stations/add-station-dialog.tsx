'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StationForm } from './station-form'
import type { ActionState } from '../actions'

type Props = {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>
}

export function AddStationDialog({ action }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        เพิ่ม Station
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>เพิ่ม Station ใหม่</DialogTitle>
          </DialogHeader>
          <StationForm action={action} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  )
}
