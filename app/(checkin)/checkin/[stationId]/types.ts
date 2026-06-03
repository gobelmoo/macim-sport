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
