/**
 * SERVE THE MEME 100 OVER HTTP.
 *
 * The board is published to `public/memeBoard`, and the page used to read that
 * document straight from the browser. Two things had to be true for that to
 * work — the scheduled poller had to have run, AND `firestore.rules` had to be
 * deployed with a public read on the doc — and when either was false the page
 * rendered the same "the board is building" panel it shows for an empty board.
 * A silent failure that is indistinguishable from a legitimate empty state is
 * how something stays broken for weeks.
 *
 * This endpoint removes both conditions:
 *
 *  • It reads through firebase-admin, which bypasses security rules entirely,
 *    so an undeployed rules file cannot hide the board. (Same reasoning as
 *    adminAuthEvents — see its header.)
 *  • If the stored board is missing or empty, it BUILDS ONE on the spot rather
 *    than waiting for the next scheduled run.
 *
 * Public and unauthenticated on purpose: the board is a recruiting surface, and
 * the whole argument for it leading the page is that a stranger can read it.
 *
 * Cheap by construction — the stored doc is served as-is whenever it is fresh,
 * so the expensive path (a dozen DexScreener calls) only runs on a genuine cold
 * start, and the rate limiter stops that being a lever anybody can pull.
 */
import { getDoc } from './_shared/firebaseAdmin'
import { json, requireMethod, withHttp } from './_shared/http'
import { checkRateLimit, clientIp } from './_shared/rateLimit'
import { refreshMemeBoard, type MemeBoardResult } from './_shared/memeBoard'

interface BoardDoc {
  coins?: unknown[]
  updatedAt?: string
  discovery?: { candidates?: number; qualified?: number }
}

export const handler = withHttp(async (event) => {
  requireMethod(event, 'GET')

  const stored = await getDoc<BoardDoc>('public/memeBoard')
  const coins = Array.isArray(stored?.coins) ? stored!.coins! : []
  if (coins.length > 0) {
    return json(200, {
      coins,
      updatedAt: stored?.updatedAt ?? null,
      discovery: stored?.discovery ?? null,
      built: false,
    })
  }

  // Cold start. Build one now — but rate-limited, because this is the only
  // path in the app where an anonymous GET can trigger a dozen outbound calls.
  let result: MemeBoardResult
  try {
    await checkRateLimit(clientIp(event), 'memeBoardBuild', 3)
    result = await refreshMemeBoard({ force: true })
  } catch {
    // Rate-limited. Not an error worth a 429 to the reader — they just get the
    // empty board and the honest reason, same as any other empty result.
    return json(200, { coins: [], updatedAt: null, built: false, reason: 'busy' })
  }

  const rebuilt = await getDoc<BoardDoc>('public/memeBoard')
  return json(200, {
    coins: Array.isArray(rebuilt?.coins) ? rebuilt!.coins! : [],
    updatedAt: rebuilt?.updatedAt ?? null,
    discovery: rebuilt?.discovery ?? null,
    built: true,
    // 'no_candidates' means DexScreener gave us nothing — upstream, not us.
    // 'none_qualified' means real coins were considered and none cleared the
    // on-chain thresholds. The page says something different for each.
    reason: result.reason,
  })
})
