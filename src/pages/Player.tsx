import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { onSnapshot, doc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { detectStream } from '@/lib/player'
import {
  reduce,
  INITIAL_STATE,
  MOUNT_TIMEOUT_MS,
  type BroadcastDoc,
  type MasterState,
} from '@/lib/masterControl'
import { loadTwitchPlayer, type TwitchPlayer, type TwitchPlayerCtor } from '@/lib/twitchEmbed'
import { isOBS, obsVersion } from '@/lib/environment'
import { useLiveSlot } from '@/contexts/useLiveSlot'
import { WipeOverlay } from '@/components/ui/WipeOverlay'
import IntermissionBoard from '@/components/player/IntermissionBoard'
import StatusCard from '@/components/player/StatusCard'
import VodRotator, { type VodItem } from '@/components/player/VodRotator'
import { formatESTRange, DEFAULT_STREAM_URL } from '@/lib/slots'

interface EmergencyOverride { enabled?: boolean; streamUrl?: string }

const TICK_MS = 5_000
/** While LIVE, re-assert audio on this cadence so the feed can never silently
 *  drift back to muted (belt-and-suspenders, mainly for OBS's CEF). */
const AUDIO_KEEPALIVE_MS = 8_000

function buildYouTubeOverrideSrc(url: string): string | null {
  const stream = detectStream(url)
  if (!stream || stream.type !== 'youtube') return null
  const params = new URLSearchParams({ autoplay: '1', mute: '0', controls: '0', rel: '0', modestbranding: '1', iv_load_policy: '3', disablekb: '1', playsinline: '1' })
  return `https://www.youtube-nocookie.com/embed/${stream.id}?${params.toString()}`
}

/**
 * CSGN Master Control — the page OBS renders as a Browser Source and streams
 * to X 24/7. OBS is a dumb encoder; ALL network logic runs here:
 *
 *   LIVE           streamer's Twitch feed, audio on
 *   STARTING_SOON  slot claimed, streamer not live yet → branded card
 *   BRB            feed dropped → grace card, auto-return on reconnect
 *   INTERMISSION   VOD/promo rotation + animated network board
 *   OVERRIDE       emergency non-Twitch URL (YouTube iframe)
 *
 * The Twitch player (embed JS API) stays mounted and muted through every
 * non-LIVE state — an ONLINE *or* PLAYING event wipes back to the feed (PLAYING
 * is the fallback for OBS's CEF, where ONLINE is unreliable and the page would
 * otherwise sit on STARTING_SOON forever). Audio is forced on when LIVE; in a
 * normal browser tab, where the autoplay policy blocks a gesture-less unmute,
 * a one-tap affordance unlocks sound.
 */
export default function Player() {
  const hostname = useMemo(() => (typeof window !== 'undefined' ? window.location.hostname : 'localhost'), [])
  const obs = useMemo(() => isOBS(), [])
  const { currentSlot } = useLiveSlot()
  const [state, dispatch] = useReducer(reduce, INITIAL_STATE)
  const [vodItems, setVodItems] = useState<VodItem[]>([])
  const [emergency, setEmergency] = useState<EmergencyOverride | null>(null)
  const [showWipe, setShowWipe] = useState(false)
  // The browser blocked autoplay-with-sound (normal tabs only) — surface a
  // one-tap "enable sound" affordance. Never happens inside OBS.
  const [audioBlocked, setAudioBlocked] = useState(false)

  const playerRef = useRef<TwitchPlayer | null>(null)
  const playerContainerRef = useRef<HTMLDivElement>(null)
  const mountTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Latest mode, readable from event/gesture callbacks without re-subscribing.
  const modeRef = useRef<MasterState['mode']>(state.mode)
  useEffect(() => { modeRef.current = state.mode }, [state.mode])

  // ── Debug overlay (?debug=1): shows env + live state + event log so the
  //    operator can see exactly what OBS's browser is doing on-stream. ──
  const debug = useMemo(
    () => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).has('debug') : false),
    [],
  )
  const [eventLog, setEventLog] = useState<string[]>([])
  const logEvent = useCallback((name: string) => {
    setEventLog((prev) => [...prev.slice(-9), `${new Date().toLocaleTimeString()}  ${name}`])
  }, [])

  // ── Audio: keep the feed playing always; make it audible only when LIVE.
  //    setMuted(false) is honoured inside OBS (autoplay-with-sound allowed) and
  //    in browser tabs where the viewer has already interacted; otherwise the
  //    Twitch player fires PLAYBACK_BLOCKED and we fall back to a tap-to-unmute. ──
  const syncAudio = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    try {
      player.play() // never let OBS capture a paused frame
      if (modeRef.current === 'LIVE') {
        player.setMuted(false)
        player.setVolume(1)
      } else {
        player.setMuted(true)
      }
    } catch { /* best-effort */ }
  }, [])

  // Brand wipe on every state change (not initial load) — state adjustment
  // during render, then a timeout effect clears it after the 1.4s stinger.
  const [prevMode, setPrevMode] = useState<MasterState['mode'] | null>(null)
  if (prevMode !== state.mode) {
    setPrevMode(state.mode)
    if (prevMode !== null) setShowWipe(true)
  }

  useEffect(() => {
    if (!showWipe) return
    const t = setTimeout(() => setShowWipe(false), 1400)
    return () => clearTimeout(t)
  }, [showWipe])

  // ── Firestore: admin emergency override (non-slot takeover URL) ──
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'config', 'emergencyOverride'),
      (snap) => setEmergency(snap.exists() ? (snap.data() as EmergencyOverride) : null),
      () => setEmergency(null),
    )
    return unsub
  }, [])

  // ── Broadcast source is derived live from the shared slot data + override,
  //    so an admin changing a slot's stream URL or status (or the clock rolling
  //    into a new slot) switches /player automatically — no server round-trip. ──
  const broadcast = useMemo<BroadcastDoc>(() => {
    if (emergency?.enabled && emergency.streamUrl) {
      return { streamUrl: emergency.streamUrl, source: 'emergency_override', slotId: null }
    }
    if (currentSlot) {
      const assigned = Boolean(currentSlot.assignedUid) || currentSlot.status === 'confirmed' || currentSlot.status === 'live'
      return {
        streamUrl: currentSlot.streamUrl || DEFAULT_STREAM_URL,
        source: assigned ? 'slot' : 'default',
        slotId: currentSlot.id,
      }
    }
    return { streamUrl: DEFAULT_STREAM_URL, source: 'default', slotId: null }
  }, [emergency, currentSlot])

  useEffect(() => {
    dispatch({ type: 'BROADCAST_CHANGED', broadcast, nowMs: Date.now() })
  }, [broadcast])

  // ── Firestore: admin-managed intermission VOD playlist ──
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'config', 'vodPlaylist'),
      (snap) => {
        const items = snap.exists() ? (snap.data().items as VodItem[] | undefined) : undefined
        setVodItems(Array.isArray(items) ? items.filter((i) => typeof i?.url === 'string' && i.url) : [])
      },
      () => setVodItems([]),
    )
    return unsub
  }, [])

  // ── Clock tick: expires BRB grace / starting-soon deadlines ──
  useEffect(() => {
    const t = setInterval(() => dispatch({ type: 'TICK', nowMs: Date.now() }), TICK_MS)
    return () => clearInterval(t)
  }, [])

  // ── Twitch player lifecycle: one instance, retuned per channel ──
  const channel = 'channel' in state ? state.channel : null

  // ── Authoritative live signal (server Helix check). feePollerBackground hits
  //    the Twitch API every minute and records streamActivity.lastLive on the
  //    slot doc we already subscribe to. The embed's ONLINE event only fires on
  //    an offline→online *transition*, so a channel that's already live when
  //    /player loads never triggers it and the page hangs on STARTING_SOON.
  //    This rescues exactly that case — but only from a pre-live state; once
  //    we're LIVE, the embed's real-time OFFLINE/BRB handling stays in charge
  //    so a genuine drop still shows the BRB card instead of a black feed. ──
  const activity = currentSlot?.streamActivity
  useEffect(() => {
    if (!channel) return
    if (state.mode !== 'STARTING_SOON' && state.mode !== 'INTERMISSION') return
    if (!activity?.lastLive) return
    if (activity.channel && activity.channel.toLowerCase() !== channel.toLowerCase()) return
    const checkedMs = activity.lastCheckedAt ? new Date(activity.lastCheckedAt).getTime() : 0
    if (!checkedMs || Date.now() - checkedMs > 3 * 60_000) return // stale check ⇒ don't trust it
    // (the debug overlay's "server live" + "mode" rows record this transition)
    dispatch({ type: 'PLAYER_ONLINE' })
  }, [channel, activity, state.mode])
  useEffect(() => {
    if (!channel) return
    let cancelled = false

    const armMountTimeout = () => {
      if (mountTimeoutRef.current) clearTimeout(mountTimeoutRef.current)
      mountTimeoutRef.current = setTimeout(() => {
        dispatch({ type: 'PLAYER_OFFLINE', nowMs: Date.now() })
      }, MOUNT_TIMEOUT_MS)
    }

    // Any signal that the channel is live cuts us to LIVE. We deliberately do
    // NOT rely on ONLINE alone: inside OBS's CEF that event is unreliable and
    // the page would sit on "Starting Soon" forever, so a real PLAYING event
    // (playback actually began ⇒ the channel must be online) counts too.
    const goLive = (via: string) => {
      logEvent(`→ LIVE (${via})`)
      if (mountTimeoutRef.current) clearTimeout(mountTimeoutRef.current)
      setAudioBlocked(false) // fresh live feed — clear any stale block flag
      try { player.play() } catch { /* play() is best-effort */ }
      dispatch({ type: 'PLAYER_ONLINE' })
      syncAudio()
    }

    let player: TwitchPlayer

    const attach = (PlayerCtor: TwitchPlayerCtor) => {
      player.addEventListener(PlayerCtor.READY, () => { logEvent('READY'); syncAudio() })
      player.addEventListener(PlayerCtor.ONLINE, () => goLive('online'))
      if (PlayerCtor.PLAYING) player.addEventListener(PlayerCtor.PLAYING, () => goLive('playing'))
      if (PlayerCtor.PLAYBACK_BLOCKED) {
        player.addEventListener(PlayerCtor.PLAYBACK_BLOCKED, () => {
          logEvent('PLAYBACK_BLOCKED')
          // Muted autoplay is always allowed — keep the picture alive.
          try { player.setMuted(true); player.play() } catch { /* best-effort */ }
          if (obs) {
            // OBS grants audio without a gesture; the block is usually just the
            // feed not flowing yet — retry the unmute shortly.
            setTimeout(syncAudio, 1_200)
          } else {
            setAudioBlocked(true) // viewer must tap to unlock sound
          }
        })
      }
      player.addEventListener(PlayerCtor.OFFLINE, () => { logEvent('OFFLINE'); dispatch({ type: 'PLAYER_OFFLINE', nowMs: Date.now() }) })
      player.addEventListener(PlayerCtor.ENDED, () => { logEvent('ENDED'); dispatch({ type: 'PLAYER_OFFLINE', nowMs: Date.now() }) })
    }

    if (playerRef.current) {
      playerRef.current.setChannel(channel)
      armMountTimeout()
    } else {
      loadTwitchPlayer()
        .then((PlayerCtor) => {
          if (cancelled || !playerContainerRef.current || playerRef.current) return
          player = new PlayerCtor(playerContainerRef.current, {
            channel,
            parent: [hostname],
            width: '100%',
            height: '100%',
            autoplay: true,
            muted: true,
          })
          attach(PlayerCtor)
          playerRef.current = player
          armMountTimeout()
        })
        .catch(() => { logEvent('embed load failed'); dispatch({ type: 'PLAYER_OFFLINE', nowMs: Date.now() }) })
    }

    return () => {
      cancelled = true
      if (mountTimeoutRef.current) clearTimeout(mountTimeoutRef.current)
    }
  }, [channel, hostname, obs, logEvent, syncAudio])

  // ── Playback + audio: the feed always autoplays; audible only when LIVE ──
  useEffect(() => { syncAudio() }, [state.mode, syncAudio])

  // While LIVE, keep re-asserting audio so the feed can't silently drift muted
  // (guards against Twitch/CEF quietly re-muting mid-broadcast).
  useEffect(() => {
    if (state.mode !== 'LIVE') return
    const t = setInterval(syncAudio, AUDIO_KEEPALIVE_MS)
    return () => clearInterval(t)
  }, [state.mode, syncAudio])

  // ── Browser-only: unlock audio on the first user gesture. Browsers refuse a
  //    programmatic unmute until the viewer interacts; OBS needs none of this. ──
  useEffect(() => {
    if (obs) return
    const unlock = () => {
      const player = playerRef.current
      if (player && modeRef.current === 'LIVE') {
        try { player.setMuted(false); player.setVolume(1); player.play() } catch { /* best-effort */ }
      }
      setAudioBlocked(false)
    }
    const opts: AddEventListenerOptions = { passive: true }
    window.addEventListener('pointerdown', unlock, opts)
    window.addEventListener('keydown', unlock, opts)
    window.addEventListener('touchstart', unlock, opts)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('touchstart', unlock)
    }
  }, [obs])

  const streamerName = currentSlot?.assignedName || ''
  const slotLabel = currentSlot ? formatESTRange(currentSlot) : ''
  const overrideSrc = state.mode === 'OVERRIDE' ? buildYouTubeOverrideSrc(state.url) : null

  // Operator preview: /player?preview=board|brb|starting|wipe forces a state
  // so each look can be checked inside OBS before going live.
  const preview = useMemo(
    () => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('preview') : null),
    [],
  )
  if (preview) {
    return (
      <div className="fixed inset-0 bg-black overflow-hidden">
        {preview === 'board' && <IntermissionBoard />}
        {preview === 'brb' && <StatusCard variant="brb" streamerName={streamerName || 'Streamer'} slotLabel={slotLabel} />}
        {preview === 'starting' && <StatusCard variant="starting-soon" streamerName={streamerName || 'Streamer'} slotLabel={slotLabel} />}
        {preview === 'wipe' && <WipeOverlay visible label="Now Live" />}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Twitch player — always mounted while a channel is armed; hidden+muted
          unless LIVE so its ONLINE event can cut back at any moment. */}
      <div
        ref={playerContainerRef}
        className="absolute inset-0"
        style={{ visibility: state.mode === 'LIVE' ? 'visible' : 'hidden' }}
      />

      {state.mode === 'OVERRIDE' && (
        overrideSrc ? (
          <iframe
            key={overrideSrc}
            src={overrideSrc}
            title="CSGN override"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, background: '#000' }}
          />
        ) : (
          <IntermissionBoard />
        )
      )}

      {state.mode === 'STARTING_SOON' && (
        <StatusCard variant="starting-soon" streamerName={streamerName} slotLabel={slotLabel} />
      )}

      {state.mode === 'BRB' && (
        <StatusCard variant="brb" streamerName={streamerName} slotLabel={slotLabel} />
      )}

      {state.mode === 'INTERMISSION' && <VodRotator items={vodItems} />}

      <WipeOverlay visible={showWipe} label={state.mode === 'LIVE' ? 'Now Live' : 'CSGN 24/7'} />

      {/* Browser tabs only: the viewer's browser muted the feed until they
          interact. One tap (anywhere, or this button) unlocks sound. */}
      {audioBlocked && !obs && state.mode === 'LIVE' && (
        <button
          type="button"
          onClick={() => {
            const player = playerRef.current
            if (player) {
              try { player.setMuted(false); player.setVolume(1); player.play() } catch { /* best-effort */ }
            }
            setAudioBlocked(false)
          }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full bg-white/90 px-5 py-2.5 text-sm font-semibold text-black shadow-lg backdrop-blur transition hover:bg-white"
        >
          <span aria-hidden>🔊</span> Tap for sound
        </button>
      )}

      {debug && (
        <DebugOverlay
          obs={obs}
          mode={state.mode}
          channel={channel}
          audioBlocked={audioBlocked}
          serverLive={activity?.lastLive ? `yes @ ${activity.lastCheckedAt ?? '?'}` : String(activity?.lastLive ?? '—')}
          log={eventLog}
        />
      )}
    </div>
  )
}

function DebugOverlay({
  obs, mode, channel, audioBlocked, serverLive, log,
}: {
  obs: boolean
  mode: MasterState['mode']
  channel: string | null
  audioBlocked: boolean
  serverLive: string
  log: string[]
}) {
  const row = 'flex justify-between gap-4'
  return (
    <div className="absolute top-3 left-3 z-30 w-80 max-w-[45vw] rounded-lg bg-black/80 p-3 font-mono text-[11px] leading-relaxed text-emerald-300 shadow-lg backdrop-blur">
      <div className="mb-1 font-bold text-white">CSGN /player debug</div>
      <div className={row}><span>env</span><span>{obs ? `OBS ${obsVersion() ?? ''}`.trim() : 'browser'}</span></div>
      <div className={row}><span>mode</span><span className="text-white">{mode}</span></div>
      <div className={row}><span>channel</span><span>{channel ?? '—'}</span></div>
      <div className={row}><span>audioBlocked</span><span>{String(audioBlocked)}</span></div>
      <div className={row}><span>server live</span><span className="truncate max-w-[10rem]">{serverLive}</span></div>
      <div className="mt-2 border-t border-white/15 pt-1 text-white/60">events</div>
      {log.length === 0 ? <div className="text-white/40">(none yet)</div>
        : log.map((e, i) => <div key={i} className="truncate">{e}</div>)}
    </div>
  )
}
