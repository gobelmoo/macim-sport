import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

export interface QueueTokenPayload extends JWTPayload {
  counterId: string
  eventId: string
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not set')
  return new TextEncoder().encode(secret)
}

export async function signQueueToken(
  payload: QueueTokenPayload,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(getSecret())
}

export async function verifyQueueToken(
  token: string,
): Promise<QueueTokenPayload | null> {
  try {
    const { payload } = await jwtVerify<QueueTokenPayload>(token, getSecret())
    if (!payload.counterId || !payload.eventId) return null
    return payload
  } catch {
    return null
  }
}
