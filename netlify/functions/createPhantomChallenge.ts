import { randomBytes } from 'node:crypto'
import { createProofToken } from './_shared/proofTokens'
import { writeDoc } from './_shared/firebaseAdmin'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { normalizeWalletAddress, requireString } from './_shared/validators'

type Body = { walletAddress?: string }

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  const walletAddress = normalizeWalletAddress(requireString(parseJson<Body>(event).walletAddress, 'walletAddress'))
  const nonce = randomBytes(18).toString('base64url')
  const challengeId = randomBytes(16).toString('hex')
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
  const message = `CSGN wallet verification\n\nWallet: ${walletAddress}\nChallenge: ${nonce}\nExpires: ${expiresAt.toISOString()}`
  await writeDoc(`phantomChallenges/${challengeId}`, { walletAddress, nonce, message, used: false, expiresAt, createdAt: new Date() })
  const challengeToken = createProofToken('phantom_challenge', { challengeId, walletAddress }, 5 * 60)
  return json(200, { challengeToken, message, expiresAt: expiresAt.toISOString() })
})
