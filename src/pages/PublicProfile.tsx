import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Radio, Trophy, Twitch } from 'lucide-react'
import { api, type PublicProfile as Profile } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { formatTokens } from '@/lib/games/profile'
import RecommendedProfiles from '@/components/account/RecommendedProfiles'

/**
 * A member's public profile — /u/:username.
 *
 * Everything here comes from the server-side projection in
 * `netlify/functions/publicProfiles.ts`, which never returns an email, a wallet
 * address, or anything else private. That's the whole safety story: this page
 * cannot leak a field the projection doesn't include, because it never sees one.
 *
 * The layout deliberately mirrors /account so a member recognises their own
 * page in someone else's — same header shape, same stat strip, minus the
 * private panels.
 */
export default function PublicProfile() {
  const { username = '' } = useParams()
  // The fetched profile is stored WITH the username it belongs to, and the
  // rendered state is derived by matching the two. That keeps the effect
  // write-only, and means navigating between profiles shows the skeleton rather
  // than briefly rendering the previous member under the new handle.
  const [fetched, setFetched] = useState<{ username: string; profile: Profile | null } | null>(null)

  useEffect(() => {
    if (!username) return
    let cancelled = false
    api.publicProfile(username)
      .then((r) => { if (!cancelled) setFetched({ username, profile: r.profile }) })
      .catch(() => { if (!cancelled) setFetched({ username, profile: null }) })
    return () => { cancelled = true }
  }, [username])

  const settled = fetched?.username === username ? fetched : null
  const profile = settled?.profile ?? null
  const state: 'loading' | 'ready' | 'missing' = !settled ? 'loading' : profile ? 'ready' : 'missing'

  if (state === 'loading') {
    return (
      <div className="min-h-screen pt-24 lg:pt-32 pb-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="h-40 rounded-xl border border-white/[0.08] bg-white/[0.02] animate-pulse" />
        </div>
      </div>
    )
  }

  if (state === 'missing' || !profile) {
    return (
      <div className="min-h-screen pt-24 lg:pt-32 pb-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-xl font-semibold text-white">No member here</h1>
          <p className="text-sm text-gray-500 mt-2">
            There's no CSGN member with the handle @{username}.
          </p>
          <Link to="/schedule" className="inline-block mt-5">
            <Button variant="secondary" size="sm">See the schedule</Button>
          </Link>
        </div>
      </div>
    )
  }

  const initial = (profile.displayName || profile.username).trim().charAt(0).toUpperCase() || '?'
  const stats: Array<[string, string]> = [
    ['Slots streamed', String(profile.slots)],
    ['$CSGN won', formatTokens(profile.winnings)],
    ['Role', profile.role],
  ]

  return (
    <div className="min-h-screen pt-24 lg:pt-32 pb-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-6">
        <Link to="/account" className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Link>

        <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-5">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover bg-white/[0.04] border border-white/[0.08] shrink-0" />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-2xl sm:text-3xl font-semibold text-gray-300 shrink-0">
                {initial}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-semibold text-white leading-tight break-words">{profile.displayName}</h1>
              <p className="text-sm text-gray-500 mt-0.5 break-all">@{profile.username}</p>
              {profile.bio && <p className="text-sm text-gray-400 mt-2 leading-relaxed break-words">{profile.bio}</p>}
            </div>

            {profile.twitch && (
              <a
                href={`https://twitch.tv/${profile.twitch}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 sm:pt-1"
              >
                <Button variant="secondary" size="sm">
                  <Twitch className="w-3.5 h-3.5" /> Watch on Twitch
                </Button>
              </a>
            )}
          </div>

          <dl className="mt-6 grid grid-cols-3 gap-px rounded-lg overflow-hidden bg-white/[0.06]">
            {stats.map(([k, v]) => (
              <div key={k} className="bg-[#0a0a11] px-4 py-3">
                <dd className="text-lg font-semibold font-mono tabular-nums text-white leading-none truncate">{v}</dd>
                <dt className="mt-1.5 text-[11px] uppercase tracking-[0.12em] text-gray-500 leading-snug">{k}</dt>
              </div>
            ))}
          </dl>
        </section>

        {profile.slots === 0 && (
          <p className="flex items-center gap-2 text-xs text-gray-600">
            <Radio className="w-3.5 h-3.5 shrink-0" />
            {profile.displayName} hasn't streamed a slot yet.
          </p>
        )}
        {profile.winnings > 0 && (
          <p className="flex items-center gap-2 text-xs text-gray-500">
            <Trophy className="w-3.5 h-3.5 shrink-0 text-amber-400/70" />
            {formatTokens(profile.winnings)} $CSGN won across Squares and Starting 5.
          </p>
        )}

        <RecommendedProfiles excludeUsername={profile.username} />
      </div>
    </div>
  )
}
