import {
  createCheckin,
  createStamp,
  getStationSponsorId,
  hasCheckinForEvent,
  lookupByBib,
} from '@/db/queries/checkins'

export type CheckinResult =
  | { found: false; error?: string }
  | {
      found: true
      isDuplicate: boolean
      athlete: {
        firstName: string
        lastName: string
        profileImageUrl: string | null
      }
    }

export async function executeCheckin(input: {
  bibNumber: string
  stationId: string
  eventId: string
}): Promise<CheckinResult> {
  const { bibNumber, stationId, eventId } = input

  const registration = await lookupByBib(bibNumber.trim(), eventId)
  if (!registration) return { found: false }

  const { athleteId, firstName, lastName, profileImageUrl } = registration

  // Fetch duplicate status and sponsor in parallel — both are independent reads
  const [isDuplicate, sponsorId] = await Promise.all([
    hasCheckinForEvent(athleteId, eventId),
    getStationSponsorId(stationId),
  ])

  await createCheckin({ athleteId, stationId, eventId, bibNumber: registration.bibNumber, isNewAthlete: false, isDuplicate })

  if (!isDuplicate && sponsorId) {
    await createStamp({ athleteId, eventId, stationId, sponsorId, stampSource: 'check_in' })
  }

  return { found: true, isDuplicate, athlete: { firstName, lastName, profileImageUrl } }
}
