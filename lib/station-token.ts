import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

export interface StationTokenPayload extends JWTPayload {
  stationId: string
  eventId: string
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not set')
  return new TextEncoder().encode(secret)
}

export async function signStationToken(payload: StationTokenPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(getSecret())
}

export async function verifyStationToken(token: string): Promise<StationTokenPayload | null> {
  try {
    const { payload } = await jwtVerify<StationTokenPayload>(token, getSecret())
    if (!payload.stationId || !payload.eventId) return null
    return { stationId: payload.stationId, eventId: payload.eventId }
  } catch {
    return null
  }
}
