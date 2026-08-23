import { useCallback, useEffect, useRef, useState } from 'react'
import { Radio, RefreshCw, Eye, Users, Play, Square, ExternalLink, AlertTriangle, Bell, BellOff, UserPlus, Film, Crown } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'

/**
 * MASTER CONTROL — the one screen that decides what is on the channel.
 *
 * Three sources feed CSGN and this board picks between them:
 *
 *   CLIP MODE    the member reel. The floor. Runs whenever nothing beats it,
 *                which is most of the day, and that is the job.
 *   STREAM MODE  the STREAM FACTORY roster — members who connected Twitch and
 *                granted forwarding. The poller samples them every minute; the
 *                Master of Programming decides which one goes on.
 *   MASTER MODE  the MYSELF FACTORY — the MP's own encoder. Pre-empts
 *                everything, because there is no appeal above the person
 *                running the channel.
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

interface Alert {
  kind: string
  severity: 'critical' | 'action' | 'info'
  message: string
  uid?: string
  username?: string
}

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
  const [onAirName, setOnAirName] = useState<string | null>(null)
  const [onAirIsGuest, setOnAirIsGuest] = useState(false)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [recommendation, setRecommendation] = useState<{ mode: 'streamer' | 'clips'; uid: string | null; why: string } | null>(null)
  const [viewerFloor, setViewerFloor] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busyUid, setBusyUid] = useState<string | null>(null)
  const [error, setError] = useState('')

  const [guestOpen, setGuestOpen] = useState(false)
  /** What the MP is credited as on screen in MASTER MODE. Blank means CSGN —
   *  most of the time the network's own name is the right answer, and asking
   *  for it every time would put a form in front of the one control that has
   *  to work instantly. */
  const [masterName, setMasterName] = useState('')
  const [guestUrl, setGuestUrl] = useState('')
  const [guestName, setGuestName] = useState('')

  // Desktop notifications, so the operator is TOLD rather than having to watch.
  // The whole point of the roster is that the channel runs without somebody
  // staring at this page; an alert nobody sees is the same as no alert.
  const [notifyOn, setNotifyOn] = useState(false)
  const notifiedRef = useRef<Set<string>>(new Set())

  const load = useCallback(async () => {
    try {
      const res = await api.liveNow()
      setEntries(res.entries)
      setOnAirUid(res.onAirUid)
      setOnAirName(res.onAirName)
      setOnAirIsGuest(res.onAirIsGuest)
      setAlerts(res.alerts)
      setRecommendation(res.recommendation)
      setViewerFloor(res.viewerFloor)
      setError('')

      // Raise each distinct alert ONCE. Re-firing the same notification every
      // sixty seconds is how somebody turns notifications off and then misses
      // the one that mattered.
      if (notifyOn && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        for (const a of res.alerts) {
          if (a.severity === 'info') continue
          const key = `${a.kind}:${a.uid ?? ''}:${a.message}`
          if (notifiedRef.current.has(key)) continue
          notifiedRef.current.add(key)
          new Notification(a.severity === 'critical' ? 'CSGN — dead air' : 'CSGN — action needed', {
            body: a.message,
            tag: a.kind,
          })
        }
        // Forget alerts that have cleared, so the same condition recurring
        // later notifies again.
        const live = new Set(res.alerts.map((a) => `${a.kind}:${a.uid ?? ''}:${a.message}`))
        for (const key of notifiedRef.current) if (!live.has(key)) notifiedRef.current.delete(key)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the roster.')
    }
    setLoading(false)
  }, [notifyOn])

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

  /** MYSELF FACTORY. No eligibility check and no URL: the encoder is already
   *  pointed at the network, and the MP does not need their own permission. */
  const goMaster = async () => {
    setBusyUid('__master__')
    setError('')
    try {
      await api.setOnAir({ action: 'go_master', masterName: masterName.trim() })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not take the channel.')
    }
    setBusyUid('')
  }

  const putGuestOnAir = async () => {
    setBusyUid('__guest__')
    setError('')
    try {
      await api.setOnAir({ action: 'put_guest_on_air', guestUrl: guestUrl.trim(), guestName: guestName.trim() })
      setGuestOpen(false); setGuestUrl(''); setGuestName('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not put that guest on air.')
    }
    setBusyUid(null)
  }

  const enableNotifications = async () => {
    if (typeof Notification === 'undefined') { setError('This browser has no notification support.'); return }
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
    if (permission !== 'granted') { setError('Notifications were blocked in the browser.'); return }
    setNotifyOn(true)
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
      {/* ── WHAT NEEDS DOING. Above everything, because it is the only part of
             this page that is time-sensitive. Empty most of the time, on
             purpose — an alert bar that always has something on it is one
             nobody reads. */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div
              key={`${a.kind}-${i}`}
              className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 ${
                a.severity === 'critical' ? 'border-red-500/40 bg-red-500/[0.09]'
                  : a.severity === 'action' ? 'border-gold/35 bg-gold/[0.07]'
                  : 'border-white/[0.09] bg-white/[0.02]'
              }`}
            >
              <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${
                a.severity === 'critical' ? 'text-red-400' : a.severity === 'action' ? 'text-gold' : 'text-gray-500'
              }`} />
              <p className={`text-sm flex-1 ${a.severity === 'info' ? 'text-gray-400' : 'text-white'}`}>{a.message}</p>
              {a.uid && a.kind !== 'switch_to_clips' && (
                <Button size="sm" isLoading={busyUid === a.uid} onClick={() => void putOnAir(a.uid!)} leftIcon={<Play className="w-3.5 h-3.5" />}>
                  Put on
                </Button>
              )}
              {a.kind === 'switch_to_clips' && (
                <Button size="sm" variant="secondary" isLoading={busyUid === '__off__'} onClick={() => void takeOffAir()} leftIcon={<Film className="w-3.5 h-3.5" />}>
                  Clips
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── WHAT THE CHANNEL IS RUNNING, and what it should be. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">On the channel</p>
          <p className="mt-0.5 text-sm font-bold text-white truncate">
            {onAirUid || onAirName
              ? <>{onAirName ?? 'Someone'} {onAirIsGuest && <span className="ml-1 text-[10px] uppercase tracking-wider text-gold border border-gold/40 rounded px-1.5 py-0.5">Guest · added by you</span>}</>
              : <span className="text-gray-400">Clip reel — clip mode</span>}
          </p>
          {recommendation && <p className="mt-0.5 text-[11px] text-gray-500">{recommendation.why}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* MASTER MODE. First in the row because it is the one control that
              always works — no roster, no consent, no live streamer required.
              The name field sits beside it rather than behind a dialog: the
              common case is going on as CSGN and pressing one button. */}
          <input
            value={masterName}
            onChange={(e) => setMasterName(e.target.value.slice(0, 40))}
            placeholder="On screen as… (CSGN)"
            aria-label="Name on screen in master mode"
            className="w-40 rounded-lg bg-white/[0.04] border border-white/[0.1] focus:border-gold/60 outline-none px-2.5 py-1.5 text-xs"
          />
          <Button
            size="sm"
            isLoading={busyUid === '__master__'}
            onClick={() => void goMaster()}
            leftIcon={<Crown className="w-3.5 h-3.5" />}
          >
            I'm going on
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setGuestOpen((v) => !v)} leftIcon={<UserPlus className="w-3.5 h-3.5" />}>
            Guest
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => (notifyOn ? setNotifyOn(false) : void enableNotifications())}
            leftIcon={notifyOn ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
          >
            {notifyOn ? 'Alerts on' : 'Alerts off'}
          </Button>
          {(onAirUid || onAirName) && (
            <Button size="sm" variant="secondary" isLoading={busyUid === '__off__'} onClick={() => void takeOffAir()} leftIcon={<Square className="w-3.5 h-3.5" />}>
              Back to clips
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => void load()} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>Refresh</Button>
        </div>
      </div>

      {/* A guest is somebody with no CSGN account — the operator vouching for
          them personally. Marked as such everywhere it appears, and credited
          with no on-air minutes, because those are what fees are split by. */}
      {guestOpen && (
        <Card hover={false} className="p-4 space-y-3">
          <p className="text-xs text-gray-400">
            Put a channel on air that isn't a CSGN member. It shows as an admin-added guest on the
            schedule and earns no fee share — guests are yours to vouch for.
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            <input
              value={guestUrl}
              onChange={(e) => setGuestUrl(e.target.value)}
              placeholder="https://www.twitch.tv/theirchannel"
              className="w-full rounded-xl bg-white/[0.04] border border-white/[0.1] focus:border-primary-500/60 outline-none px-3 py-2 text-sm"
            />
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value.slice(0, 40))}
              placeholder="Name on screen (optional)"
              className="w-full rounded-xl bg-white/[0.04] border border-white/[0.1] focus:border-primary-500/60 outline-none px-3 py-2 text-sm"
            />
          </div>
          <Button
            size="sm"
            disabled={!/^https:\/\//.test(guestUrl.trim())}
            isLoading={busyUid === '__guest__'}
            onClick={() => void putGuestOnAir()}
            leftIcon={<Play className="w-3.5 h-3.5" />}
          >
            Put guest on air
          </Button>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-400">
          <span className="text-live font-bold">{live.length}</span> of {entries.length} connected
          {entries.length === 1 ? ' channel' : ' channels'} live right now.
          {viewerFloor > 0 && <span className="text-gray-600"> · {viewerFloor}+ viewers to beat the reel</span>}
        </p>
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
