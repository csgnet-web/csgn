import { createPublicKey, verify as verifySignature } from 'node:crypto'
import bs58 from 'bs58'
import { getDoc, writeDoc } from './_shared/firebaseAdmin'
import { badRequest, unauthorized } from './_shared/errors'
import { createProofToken, verifyProofToken } from './_shared/proofTokens'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { normalizeWalletAddress, requireString } from './_shared/validators'

type ChallengeProof = { type: string; challengeId: string; walletAddress: string; exp: number; iat: number; jti: string }
type ChallengeDoc = { walletAddress?: string; message?: string; used?: boolean; expiresAt?: string }
type Body = { walletAddress?: string; signature?: string; challengeToken?: string }

function verifyEd25519(message: string, signatureB58: string, publicKeyB58: string): boolean {
  const rawKey = bs58.decode(publicKeyB58)
  const signature = bs58.decode(signatureB58)
  const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(rawKey)])
  const key = createPublicKey({ key: spki, format: 'der', type: 'spki' })
  return verifySignature(null, Buffer.from(message), key, signature)
}

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  const body = parseJson<Body>(event)
  const walletAddress = normalizeWalletAddress(requireString(body.walletAddress, 'walletAddress'))
  const challenge = verifyProofToken<ChallengeProof>(requireString(body.challengeToken, 'challengeToken'), 'phantom_challenge')
  if (challenge.walletAddress !== walletAddress) throw unauthorized('Challenge does not match wallet')
  const doc = await getDoc<ChallengeDoc>(`phantomChallenges/${challenge.challengeId}`)
  if (!doc || doc.used) throw unauthorized('Challenge is no longer valid')
  if (!doc.expiresAt || new Date(doc.expiresAt).getTime() <= Date.now()) throw unauthorized('Challenge expired')
  if (doc.walletAddress !== walletAddress || !doc.message) throw unauthorized('Challenge does not match wallet')
  if (!verifyEd25519(doc.message, requireString(body.signature, 'signature'), walletAddress)) throw badRequest('Invalid Phantom signature', 'invalid_signature')
  await writeDoc(`phantomChallenges/${challenge.challengeId}`, { used: true, usedAt: new Date() }, { merge: true })
  const proofToken = createProofToken('phantom_wallet', { walletAddress }, 15 * 60)
  return json(200, { proofToken, walletAddress })
})
