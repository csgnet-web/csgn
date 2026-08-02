import { useEffect, useState } from 'react'
import { Twitch, Users } from 'lucide-react'
import { api, type PublicProfile } from '@/lib/api'
import { formatTokens } from '@/lib/games/profile'

/**
 * Recommended members.
 *
 * A network you can't browse is a list of strangers. This is the smallest
 * honest version of discovery: who else is here, who can actually go live, and
 * a direct link to watch them.
 *
 * The ordering comes from the server (`rankProfiles`) and puts **members with a
 * linked Twitch first**, because the point of discovery here is finding someone
 * to watch — not ranking people by how much they hold. A leaderboard by bag size
 * would have been easier and would have made the network worse.
 *
 * Everything rendered here comes from a server-side projection that never
 * includes an email or a wallet address. See `netlify/functions/publicProfiles.ts`.
 */
export default function RecommendedProfiles({ excludeUsername }: { excludeUsername?: string }) {
  const [profiles, setProfiles] = useState<PublicProfile[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.publicProfiles({ limit: 6, exclude: excludeUsername })
      .then((r) => { if (!cancelled) setProfiles(r.profiles ?? []) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [excludeUsername])

  // A failed or empty discovery rail renders nothing at all. An empty "Members"
  // card with a spinner in it is worse than no card — it tells a new user the
  // network is empty, which on day one is both true and unhelpful to say.
  if (failed || (profiles && profiles.length === 0)) return null

  return (
    <section className="rounded-xl border border-white/[0.08] bg-white/[0.02]">
      <header className="flex items-center gap-2 px-5 py-3.5 border-b border-white/[0.06]">
        <Users className="w-4 h-4 text-gray-400" />
        <h2 className="text-sm font-semibold text-white">Members to watch</h2>
      </header>

      <div className="p-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {profiles === null
          ? Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-[68px] rounded-lg border border-white/[0.06] bg-white/[0.015] animate-pulse" />
            ))
          : profiles.map((p) => <ProfileCard key={p.username} profile={p} />)}
      </div>
    </section>
  )
}

function ProfileCard({ profile }: { profile: PublicProfile }) {
  const initial = (profile.displayName || profile.username).trim().charAt(0).toUpperCase() || '?'
  const href = profile.twitch ? `https://twitch.tv/${profile.twitch}` : undefined

  const inner = (
    <>
      {profile.avatarUrl ? (
        <img src={profile.avatarUrl} alt="" className="w-10 h-10 rounded-lg object-cover bg-white/[0.04] border border-white/[0.08] shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-sm font-semibold text-gray-400 shrink-0">
          {initial}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white truncate leading-tight">{profile.displayName}</p>
        <p className="text-[11px] text-gray-500 truncate mt-0.5">@{profile.username}</p>
        <p className="text-[11px] text-gray-600 truncate mt-0.5">
          {profile.slots > 0 ? `${profile.slots} slot${profile.slots === 1 ? '' : 's'}` : 'New member'}
          {profile.winnings > 0 && ` · ${formatTokens(profile.winnings)} won`}
        </p>
      </div>
      {profile.twitch && <Twitch className="w-4 h-4 shrink-0 text-gray-500" />}
    </>
  )

  const className = 'flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.015] px-3 py-2.5 min-w-0'

  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`${className} hover:bg-white/[0.04] hover:border-white/[0.12] transition-colors`}>
      {inner}
    </a>
  ) : (
    <div className={className}>{inner}</div>
  )
}
