import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto'
import { badRequest, unauthorized } from './errors'

type ProofPayload = Record<string, unknown> & { type: string; exp: number; iat: number; jti: string }

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

function secret(): string {
  const value = process.env.CSGN_PROOF_SIGNING_SECRET
  if (!value || value.length < 16) throw new Error('CSGN_PROOF_SIGNING_SECRET is not configured')
  return value
}

function sign(data: string): string {
  return createHmac('sha256', secret()).update(data).digest('base64url')
}

export function createProofToken(type: string, claims: Record<string, unknown>, ttlSeconds = 10 * 60): string {
  const now = Math.floor(Date.now() / 1000)
  const payload: ProofPayload = {
    ...claims,
    type,
    iat: now,
    exp: now + ttlSeconds,
    jti: randomBytes(16).toString('hex'),
  }
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'CSGNProof' }))
  const body = base64url(JSON.stringify(payload))
  return `${header}.${body}.${sign(`${header}.${body}`)}`
}

export function verifyProofToken<T extends ProofPayload = ProofPayload>(token: string, expectedType: string): T {
  const parts = String(token || '').split('.')
  if (parts.length !== 3) throw unauthorized('Invalid proof token')
  const [header, body, signature] = parts as [string, string, string]
  const expected = sign(`${header}.${body}`)
  const actualBuf = Buffer.from(signature)
  const expectedBuf = Buffer.from(expected)
  if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) throw unauthorized('Invalid proof token')

  let payload: T
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T
  } catch {
    throw unauthorized('Invalid proof token')
  }
  if (payload.type !== expectedType) throw badRequest('Wrong proof token type', 'wrong_proof_type')
  if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) throw unauthorized('Proof token expired')
  return payload
}
