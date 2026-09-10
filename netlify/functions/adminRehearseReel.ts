/**
 * REHEARSE THE REEL — put your own links through the real pipeline, with no
 * member, no TikTok connection, no wallet and no approval queue.
 *
 * ── The question this answers ──────────────────────────────────────────────
 *
 * `/player?rehearse=clip` proves the LOOK: the ident, the board, the hand-over,
 * the credit card, all on fixed demo footage. What it cannot tell an operator is
 * whether THEIR links work — whether that TikTok short link resolves, whether
 * that Instagram reel is embeddable, whether the duration comes back measured or
 * guessed, whether the crop lands where they think it does.
 *
 * That is a different question and it needs the real code: the real parser
 * (`_shared/clipEmbed.ts`), the real short-link resolution and metadata lookup
 * (`_shared/clipMeta.ts`), the real trim, and the real playlist builder
 * (`_shared/airtime.ts`). All of which run here.
 *
 * ── The one step that is NOT real, and why ─────────────────────────────────
 *
 * Allocation. A member's seconds come from the day lock — one balance read per
 * holder at the 2 AM cutover, written once and never rewritten, because it is
 * the record the whole airtime promise is settled against. A rehearsal has no
 * business anywhere near it, and a demo member holding no $CSGN would be
 * allocated nothing anyway, which would make this endpoint useless.
 *
 * So the operator says how many seconds each clip gets and the scheduler lays
 * them out from that. The arithmetic that step skips is the most thoroughly
 * proven thing in the codebase — `npm run verify:airtime` re-derives it
 * independently and `airtimeRatio.test.ts` pins eleven cases of it.
 *
 * ── What it will not touch ─────────────────────────────────────────────────
 *
 * Nothing this writes can reach the broadcast by accident. It writes ONE
 * document, `public/airtimeScheduleRehearsal`, which /player reads only when it
 * is explicitly asked to (`?rehearse=live`). It creates no clip rows, no member,
 * no day lock, and it never touches `public/airtimeSchedule` — so the live reel
 * carries on exactly as it was while the operator is rehearsing over the top
 * of it.
 */
import { requireAdminUser } from './_shared/auth'
import { auditLog } from './_shared/audit'
import { badRequest } from './_shared/errors'
import { writeDoc } from './_shared/firebaseAdmin'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { checkRateLimit, clientIp } from './_shared/rateLimit'
import { resolveClipUrl } from './_shared/clipIntake'
import { applyTrim, clampClipSeconds } from './_shared/clipEmbed'
import { fetchClipMeta } from './_shared/clipMeta'
import { buildAirtimeSchedule, type AirtimeClip } from './_shared/airtime'

export const REHEARSAL_SCHEDULE_PATH = 'public/airtimeScheduleRehearsal'

/** A rehearsal is a handful of links an operator is checking, not a channel. */
const MAX_URLS = 12
/** How far ahead the rehearsal playlist is laid down. Long enough to leave it
 *  running while OBS is set up, short enough that a forgotten rehearsal doc
 *  stops being a plausible playlist rather than sitting there for a week. */
const HORIZON_MS = 6 * 60 * 60 * 1000

type Body = {
  action?: unknown
  urls?: unknown
  seconds?: unknown
  username?: unknown
  look?: unknown
  style?: unknown
  motion?: unknown
  avatarUrl?: unknown
  trimStartSeconds?: unknown
  trimEndSeconds?: unknown
}

interface UrlOutcome {
  url: string
  ok: boolean
  /** Why it will not air, in the words the member would be shown. */
  error?: string
  platform?: string
  canonicalUrl?: string
  /** True when the platform told us the real runtime rather than us guessing —
   *  the single most useful thing this endpoint reports back. */
  measured?: boolean
  sourceSeconds?: number | null
}

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  const admin = await requireAdminUser(event)
  await checkRateLimit(clientIp(event), 'adminRehearseReel', 20)

  const body = parseJson<Body>(event)
  const action = String(body.action ?? 'seed')

  if (action === 'clear') {
    await writeDoc(REHEARSAL_SCHEDULE_PATH, {
      items: [], clearedAt: new Date().toISOString(), builtAt: new Date().toISOString(),
    })
    await auditLog('adminRehearseReel', admin.uid, { action: 'clear' })
    return json(200, { ok: true, cleared: true, items: 0, urls: [] })
  }
  if (action !== 'seed') throw badRequest("Action must be 'seed' or 'clear'.", 'bad_action')

  const rawUrls = Array.isArray(body.urls) ? body.urls : []
  const urls = rawUrls.map((u) => String(u ?? '').trim()).filter(Boolean).slice(0, MAX_URLS)
  if (urls.length === 0) throw badRequest('Paste at least one clip link to rehearse.', 'no_urls')

  // The operator's stand-in member. Everything the broadcast paints on a
  // segment is theirs, so a rehearsal can check a specific member's card by
  // passing their handle and look — which is how you answer "does the ticker
  // style collide with my lower third" before it does.
  const username = String(body.username ?? '').trim().slice(0, 40) || 'rehearsal'
  const look = String(body.look ?? 'signal')
  const style = String(body.style ?? 'bar')
  const motion = String(body.motion ?? 'cut')
  const avatarUrl = String(body.avatarUrl ?? '')
  const trim = {
    startSeconds: Math.max(0, Math.floor(Number(body.trimStartSeconds) || 0)),
    endSeconds: Math.max(0, Math.floor(Number(body.trimEndSeconds) || 0)),
  }
  // Seconds per segment. Zero (or absent) means "use whatever the platform says
  // the clip actually runs", which is the honest default and the one that shows
  // the operator which of their links came back measured.
  const requested = Math.floor(Number(body.seconds) || 0)

  const outcomes: UrlOutcome[] = []
  const clips: AirtimeClip[] = []

  for (const [i, url] of urls.entries()) {
    try {
      // The REAL parser, including the short-link round trip. A rehearsal that
      // accepted links the live intake rejects would be worse than no rehearsal.
      const parsed = await resolveClipUrl(url)
      // The REAL metadata lookup — best-effort, exactly as on the member path.
      const meta = await fetchClipMeta(parsed)
      const measured = meta.seconds != null
      const sourceSeconds = measured ? clampClipSeconds(meta.seconds) : null
      const seconds = requested > 0 ? clampClipSeconds(requested) : (sourceSeconds ?? clampClipSeconds(undefined))

      clips.push({
        clipId: `rehearsal-${i}`,
        uid: 'rehearsal',
        username,
        // The REAL crop, applied to the REAL embed URL.
        url: applyTrim(parsed, trim),
        platform: parsed.platform,
        sourceUrl: parsed.canonicalUrl,
        title: (meta.title || `Rehearsal clip ${i + 1}`).slice(0, 80),
        seconds,
        order: i,
        look,
        style,
        motion,
        avatarUrl,
      })
      outcomes.push({
        url,
        ok: true,
        platform: parsed.platform,
        canonicalUrl: parsed.canonicalUrl,
        measured,
        sourceSeconds,
      })
    } catch (err) {
      // One bad link does not fail the rehearsal — it is reported and the rest
      // go on air, because finding out which of eight links is the broken one
      // is most of what an operator is doing here.
      outcomes.push({ url, ok: false, error: err instanceof Error ? err.message : 'Could not use that link.' })
    }
  }

  if (clips.length === 0) {
    return json(200, { ok: false, items: 0, urls: outcomes, reason: 'No link could be used.' })
  }

  const nowMs = Date.now()
  // The REAL playlist builder, over one window starting now. Allocations are
  // the operator's stated seconds rather than a share of the token — the one
  // deliberate substitution, explained in the header.
  const totalSeconds = clips.reduce((sum, c) => sum + c.seconds, 0)
  const items = buildAirtimeSchedule(
    [{ uid: 'rehearsal', seconds: totalSeconds, supplyShare: 0, capped: false }],
    clips,
    [{ startMs: nowMs, endMs: nowMs + HORIZON_MS }],
  )

  await writeDoc(REHEARSAL_SCHEDULE_PATH, {
    items,
    rehearsal: true,
    builtBy: admin.uid,
    builtAt: new Date(nowMs).toISOString(),
    horizonEndsAt: new Date(nowMs + HORIZON_MS).toISOString(),
    inventorySeconds: totalSeconds,
  })

  await auditLog('adminRehearseReel', admin.uid, {
    action: 'seed',
    urls: urls.length,
    usable: clips.length,
    segments: items.length,
  })

  return json(200, {
    ok: true,
    items: items.length,
    totalSeconds,
    urls: outcomes,
    // The first few segments, so the admin panel can show exactly what will air
    // and when without re-reading the document.
    preview: items.slice(0, 6).map((i) => ({ startsAt: i.startsAt, seconds: i.seconds, title: i.title, platform: i.platform })),
  })
})
