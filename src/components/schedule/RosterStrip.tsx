import { useEffect, useState } from 'react'
import { Eye, ExternalLink, Radio } from 'lucide-react'
import { api } from '@/lib/api'

/**
 * WHO IS ON THE NETWORK RIGHT NOW.
 *
 * The schedule page used to open with a grid of bookable blocks, which framed
 * CSGN as a booking sheet — and an empty booking sheet is the least persuasive
 * thing a network can show a visitor. It also stopped being TRUE once streamers
 * went hands-off: most people on this channel never book anything. They connect
 * once and we pick them up.
 *
 * So the page opens with the roster instead. This is the honest headline —
 * these are real channels, live right now, that agreed to be carried — and the
 * grid below it becomes what it actually is: a record of what aired and a way
 * to reserve a specific hour if you want one.
 *
 * Nobody live is not a failure state and is not hidden. It says the reel is
 * carrying the channel, which is true, and is the whole point of the reel.
 */

interface LiveMember {
  username: string
  displayName: string
  twitchUsername: string
  profileImageUrl: string
  viewerCount: number
  title: string
  gameName: string
  startedAt: string
}

export function RosterStrip() {
  const [live, setLive] = useState<LiveMember[]>([])
  const [memberCount, setMemberCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await api.roster()
        if (!cancelled) { setLive(res.live); setMemberCount(res.memberCount) }
      } catch {
        // A roster we cannot read renders as "nobody live", which is the safe
        // direction: claiming somebody is on air when we do not know is worse.
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    // The server samples once a minute; polling faster re-reads the same doc.
    const t = setInterval(() => void load(), 60_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  if (loading) return null

  return (
    <section className="mb-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-gray-400 flex items-center gap-2">
          <Radio className="w-4 h-4 text-live" /> On the network
        </h2>
        {memberCount > 0 && (
          <span className="text-[11px] text-gray-600">
            {memberCount} {memberCount === 1 ? 'channel' : 'channels'} connected
          </span>
        )}
      </div>

      {live.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-6 text-center">
          <p className="text-sm text-gray-300 font-medium">Nobody is live right now</p>
          <p className="mt-1 text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
            The clip reel is carrying the channel — that is what it is for. Connected streamers get
            picked up automatically whenever they go live, with nothing to book.
          </p>
        </div>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {live.map((m) => (
            <a
              key={m.twitchUsername || m.username}
              href={`https://www.twitch.tv/${m.twitchUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.14] transition-colors p-3"
            >
              <span className="relative shrink-0">
                {m.profileImageUrl
                  ? <img src={m.profileImageUrl} alt="" className="w-11 h-11 rounded-full object-cover bg-white/5" />
                  : <span className="w-11 h-11 rounded-full bg-white/[0.06] block" />}
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-live ring-2 ring-[#08080d]" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-white truncate">{m.displayName}</span>
                <span className="block text-[11px] text-gray-500 truncate">{m.title || m.gameName || 'Live now'}</span>
              </span>

              <span className="shrink-0 text-right">
                <span className="flex items-center gap-1 text-[11px] font-mono text-gray-400 tabular-nums">
                  <Eye className="w-3 h-3" />{m.viewerCount.toLocaleString('en-US')}
                </span>
                <ExternalLink className="w-3 h-3 text-gray-700 group-hover:text-gray-400 ml-auto mt-1 transition-colors" />
              </span>
            </a>
          ))}
        </div>
      )}
    </section>
  )
}

export default RosterStrip
