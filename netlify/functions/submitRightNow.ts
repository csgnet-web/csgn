// Holder-submitted "Right Now" rail item. Gated by:
//   • proven wallet ownership (phantom_wallet proof token)
//   • ≥ 5,000,000 CSGN held (checked on-chain, server-side)
//   • one submission per wallet per ET day
//   • a courtesy profanity/slur filter
// On success it appends to config/ticker.rightNow (FIFO, capped) which the OBS
// ticker overlay picks up on its next poll.
import { verifyProofToken } from './_shared/proofTokens'
import { getDoc, writeDoc } from './_shared/firebaseAdmin'
import { badRequest, conflict, forbidden } from './_shared/errors'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { requireString } from './_shared/validators'
import { checkRateLimit, clientIp } from './_shared/rateLimit'
import { getCsgnBalance } from './_shared/solana'
import { containsProfanity } from './_shared/profanity'

const MIN_CSGN = 5_000_000
const MAX_LEN = 90
const MIN_LEN = 3
const MAX_ITEMS = 8

type WalletProof = { type: string; walletAddress: string; exp: number; iat: number; jti: string }
type Body = { proofToken?: string; text?: string }
type RailItem = { tag: string; text: string }

const etDay = (d = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  await checkRateLimit(clientIp(event), 'submitRightNow', 8)

  const body = parseJson<Body>(event)
  const proof = verifyProofToken<WalletProof>(requireString(body.proofToken, 'proofToken'), 'phantom_wallet')
  const wallet = proof.walletAddress

  let text = requireString(body.text, 'text').replace(/\s+/g, ' ').trim()
  if (text.length < MIN_LEN) throw badRequest('Your message is too short.', 'too_short')
  if (text.length > MAX_LEN) text = text.slice(0, MAX_LEN)
  if (containsProfanity(text)) throw badRequest('That message contains language not allowed on air.', 'profanity')

  // On-chain balance gate — cannot be spoofed (wallet was signature-proven).
  const balance = await getCsgnBalance(wallet)
  if (balance < MIN_CSGN) {
    throw forbidden(
      `You need at least ${MIN_CSGN.toLocaleString('en-US')} $CSGN to post to the Right Now rail — you hold ${Math.floor(balance).toLocaleString('en-US')}.`,
    )
  }

  // One post per wallet per ET day.
  const day = etDay()
  const limit = await getDoc<{ day?: string }>(`holderActions/${wallet}`)
  if (limit?.day === day) throw conflict('You have already posted to the rail today — one per day.', 'daily_limit')

  // Append to the rail (FIFO, capped). Admin can still curate/clear it.
  const ticker = await getDoc<{ rightNow?: RailItem[] }>('config/ticker')
  const rail = Array.isArray(ticker?.rightNow)
    ? ticker!.rightNow.filter((i): i is RailItem => !!i && typeof i.text === 'string' && i.text.trim().length > 0)
    : []
  const item: RailItem = { tag: 'HOLDER', text }
  const next = [...rail, item].slice(-MAX_ITEMS)

  await writeDoc('config/ticker', { rightNow: next, updatedAt: new Date().toISOString() }, { merge: true })
  await writeDoc(
    `holderActions/${wallet}`,
    { day, lastText: text, lastAt: new Date(), expiresAt: new Date(Date.now() + 3 * 86_400_000) },
    { merge: true },
  )

  return json(200, { ok: true, text, item, railSize: next.length })
})
