'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StationForm } from './station-form'
import type { ActionState } from '../actions'
import type { StationRow } from '@/db/queries/stations'

type Props = {
  station: StationRow
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>
}

export function EditStationDialog({ station, action }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        แก้ไข
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>แก้ไข Station</DialogTitle>
          </DialogHeader>
          <StationForm
            action={action}
            defaultValues={{
              stationType: station.stationType,
              stationName: station.stationName,
              stampOnAddFriend: station.stampOnAddFriend,
            }}
            submitLabel="บันทึก"
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
