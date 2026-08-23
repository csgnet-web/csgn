/**
 * WHO IS ON THE NETWORK — the public version of the operator's board.
 *
 * `adminLiveNow` is the control surface: it lists everybody, names who is
 * offline, and carries the buttons. This is the same roster with everything
 * operational stripped out, for /schedule — so a visitor can see that CSGN is a
 * network of real streamers rather than an empty booking sheet.
 *
 * ── What is deliberately NOT here ──────────────────────────────────────────
 *
 *  • uid. Nothing public needs it, and it is the join key for every private
 *    document a member owns.
 *  • Offline members. "Twelve channels connected, none live" is operator
 *    information; to a visitor it just reads as a dead network. Live only.
 *  • Minute counters. Those decide money and belong on the member's own page,
 *    not on a surface anybody can scrape.
 *
 * Unauthenticated and cheap: one document read, served from whatever the poller
 * last published. It never triggers a rebuild — an anonymous endpoint that can
 * cause a hundred Twitch API calls is a lever somebody will eventually pull.
 */
import { getDoc } from './_shared/firebaseAdmin'
import { cachedJson, requireMethod, withHttp } from './_shared/http'
import { ROSTER_STALE_MS, type RosterEntry } from './_shared/liveRoster'

interface RosterDoc { entries?: RosterEntry[]; updatedAt?: string }

export const handler = withHttp(async (event) => {
  requireMethod(event, 'GET')

  const stored = await getDoc<RosterDoc>('public/liveRoster')
  const updatedAt = stored?.updatedAt ?? null
  const ageMs = Date.now() - Date.parse(updatedAt || '')
  // A stale roster is not shown as fact. Better to say "nobody is live" than to
  // put a face on the page that went offline forty minutes ago.
  const fresh = Number.isFinite(ageMs) && ageMs < ROSTER_STALE_MS

  const live = fresh
    ? (stored?.entries ?? [])
      .filter((e) => e?.live)
      .sort((a, b) => (b.viewerCount || 0) - (a.viewerCount || 0))
      .slice(0, 24)
      .map((e) => ({
        username: String(e.username || ''),
        displayName: String(e.displayName || e.username || ''),
        twitchUsername: String(e.twitchUsername || ''),
        profileImageUrl: String(e.profileImageUrl || ''),
        viewerCount: Math.max(0, Number(e.viewerCount) || 0),
        title: String(e.title || ''),
        gameName: String(e.gameName || ''),
        startedAt: String(e.startedAt || ''),
      }))
    : []

  // SERVED FROM THE EDGE. Every open /schedule and /watch tab asks for this
  // once a minute; the underlying document is only rewritten by the poller,
  // which itself runs at most once a minute and less when the channel is cold.
  // Caching it for 45 seconds means one invocation serves every viewer in that
  // window instead of one invocation per viewer.
  return cachedJson({
    live,
    // The size of the network, which is a fact worth publishing even when
    // nobody happens to be on right now.
    memberCount: fresh ? (stored?.entries ?? []).length : 0,
    updatedAt,
    stale: !fresh,
  }, { browserSeconds: 20, edgeSeconds: 45, staleSeconds: 120 })
})
