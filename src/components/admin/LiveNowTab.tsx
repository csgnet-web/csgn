import { useCallback, useEffect, useState } from 'react'
import { Radio, RefreshCw, Eye, Users, Play, Square, ExternalLink } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'

/**
 * LIVE NOW — the operator's board.
 *
 * This is the control room for the model that replaced block-claiming. Members
 * connect Twitch once and grant permission to be forwarded; the poller samples
 * every one of them each minute; this screen shows who is on and puts them on
 * the channel in one click.
 *
 * Three things it deliberately shows that a simple "who is live" list would not:
 *
 *  • VIEWERS, sorted. The operator's decision is almost always "who has an
 *    audience right now", so the list is ordered to answer that before it is
 *    read.
 *  • WHAT THEY ARE PLAYING. Putting a stream on a crypto channel without
 *    knowing what is on it is how a network gets a copyright strike.
 *  • ON-AIR MINUTES vs LIVE MINUTES. These are different numbers and only the
 *    first one pays. Showing both stops "but I streamed all week" arguments
 *    that are really about which channel they streamed to.
 */

interface Entry {
  uid: string
  username: string
  twitchUsername: string
  displayName: string
  profileImageUrl: string
  live: boolean
  viewerCount: number
  title: string
  gameName: string
  startedAt: string
  liveMinutes: number
  onAirMinutes: number
  sampledAt: string
}

/** Minutes as something a person reads at a glance. */
const mins = (n: number): string => (n >= 60 ? `${Math.floor(n / 60)}h ${n % 60}m` : `${n}m`)

/** How long they have been live this session. */
function uptime(startedAt: string): string {
  const start = Date.parse(startedAt)
  if (!Number.isFinite(start)) return ''
  return mins(Math.max(0, Math.floor((Date.now() - start) / 60_000)))
}

export default function LiveNowTab() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [onAirUid, setOnAirUid] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyUid, setBusyUid] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await api.liveNow()
      setEntries(res.entries)
      setOnAirUid(res.onAirUid)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the roster.')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => { if (!cancelled) await load() })()
    // The roster is sampled once a minute server-side, so polling faster than
    // that just re-reads the same document.
    const t = setInterval(() => void load(), 60_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [load])

  const putOnAir = async (uid: string) => {
    setBusyUid(uid)
    setError('')
    try {
      await api.setOnAir({ uid, action: 'put_on_air' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not put them on air.')
    }
    setBusyUid(null)
  }

  const takeOffAir = async () => {
    setBusyUid('__off__')
    setError('')
    try {
      await api.setOnAir({ action: 'take_off_air' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not clear the block.')
    }
    setBusyUid(null)
  }

  const live = entries.filter((e) => e.live)
  const offline = entries.filter((e) => !e.live)

  if (loading) {
    return <Card hover={false} className="p-10 text-center"><div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" /></Card>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-400">
          <span className="text-live font-bold">{live.length}</span> of {entries.length} connected
          {entries.length === 1 ? ' channel' : ' channels'} live right now.
        </p>
        <div className="flex items-center gap-2">
          {onAirUid && (
            <Button size="sm" variant="secondary" isLoading={busyUid === '__off__'} onClick={() => void takeOffAir()} leftIcon={<Square className="w-3.5 h-3.5" />}>
              Take the block back
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => void load()} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>Refresh</Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      {entries.length === 0 ? (
        <Card hover={false} className="p-8 text-center">
          <p className="text-sm text-gray-300 font-medium">Nobody has connected a channel yet</p>
          <p className="mt-1 text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
            Members appear here once they link Twitch <em>and</em> tick the box giving CSGN
            permission to forward their streams. Linking alone is not enough — we do not sample a
            channel we have not been given permission to re-broadcast.
          </p>
        </Card>
      ) : (
        <>
          {live.length > 0 && (
            <div className="space-y-2">
              {live.map((e) => (
                <Card key={e.uid} hover={false} className={`p-4 ${onAirUid === e.uid ? 'border-live/40 bg-live/[0.05]' : ''}`}>
                  <div className="flex items-start gap-3">
                    {e.profileImageUrl
                      ? <img src={e.profileImageUrl} alt="" className="w-10 h-10 rounded-full shrink-0 object-cover bg-white/5" />
                      : <span className="w-10 h-10 rounded-full shrink-0 bg-white/[0.06]" />}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-white truncate">{e.displayName}</span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-live">
                          <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse" /> Live
                        </span>
                        {onAirUid === e.uid && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-white bg-primary-500 rounded px-1.5 py-0.5">
                            On CSGN
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-gray-400 truncate">{e.title || 'No title set'}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
                        <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" />{e.viewerCount.toLocaleString('en-US')}</span>
                        {e.gameName && <span>{e.gameName}</span>}
                        {e.startedAt && <span>up {uptime(e.startedAt)}</span>}
                        <span className="text-gray-600">on air {mins(e.onAirMinutes)} · live {mins(e.liveMinutes)}</span>
                        <a href={`https://www.twitch.tv/${e.twitchUsername}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300">
                          Watch <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {onAirUid === e.uid ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-live"><Radio className="w-3.5 h-3.5" /> On the channel</span>
                      ) : (
                        <Button size="sm" isLoading={busyUid === e.uid} onClick={() => void putOnAir(e.uid)} leftIcon={<Play className="w-3.5 h-3.5" />}>
                          Put on air
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {live.length === 0 && (
            <Card hover={false} className="p-8 text-center">
              <p className="text-sm text-gray-300 font-medium">Nobody is live right now</p>
              <p className="mt-1 text-xs text-gray-500">
                {entries.length} connected {entries.length === 1 ? 'channel' : 'channels'}, all offline. The clip reel is carrying the air.
              </p>
            </Card>
          )}

          {offline.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-300 select-none inline-flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                {offline.length} connected {offline.length === 1 ? 'channel' : 'channels'} offline
              </summary>
              <div className="mt-2 space-y-1">
                {offline.map((e) => (
                  <div key={e.uid} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02] text-xs">
                    <span className="text-gray-300 truncate flex-1">{e.displayName}</span>
                    <span className="text-gray-600 shrink-0">on air {mins(e.onAirMinutes)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  )
}
