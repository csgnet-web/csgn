import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { onSnapshot, doc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { detectStream } from '@/lib/player'
import {
  reduce,
  serverLiveSignal,
  isServerLive,
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
import FeedCover from '@/components/player/FeedCover'
import OnAirPromo from '@/components/player/OnAirPromo'
import { formatESTRange, DEFAULT_STREAM_URL } from '@/lib/slots'

interface EmergencyOverride { enabled?: boolean; streamUrl?: string }

const TICK_MS = 5_000
/** While LIVE, re-check audio on this cadence and unmute ONLY if it has drifted
 *  back to muted. Deliberately gentle: we never call play() or re-set volume on
 *  a healthy feed, because those re-trigger Twitch's overlay chrome and can
 *  rebuffer — the flashing-UI + stutter the old 8s keepalive caused on-stream. */
const AUDIO_ASSERT_MS = 15_000
/** Twitch's source (highest) quality group. Pinned so the encode never drops to
 *  auto/360p — the operator wants max quality out to X. */
const SOURCE_QUALITY = 'chunked'
/** Hold the branded cover this long after the feed goes LIVE before revealing,
 *  so the play-button poster / preroll / channel chrome flash is fully masked.
 *  LIVE is only ever declared once playback/online/server-live is confirmed, so
 *  a fixed hold is enough — no need to gate on a separate playback event. */
const REVEAL_HOLD_MS = 3_500

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
  // The branded cover stays over the LIVE feed until playback is confirmed
  // flowing — masks the Twitch startup reveal (poster, preroll, chrome flash)
  // on both first load and every OBS watchdog reload.
  const [feedReady, setFeedReady] = useState(false)
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

  // Gentle mid-broadcast audio check: only touch the player if it has actually
  // drifted back to muted. Unlike syncAudio it never calls play() or re-sets
  // volume on a healthy feed — those redundant calls flashed Twitch's overlay
  // chrome and could rebuffer, which is what made the old 8s keepalive visible
  // on-stream. Silent no-op in the common (already-audible) case.
  const assertAudio = useCallback(() => {
    const player = playerRef.current
    if (!player || modeRef.current !== 'LIVE') return
    try {
      if (player.getMuted()) {
        player.setMuted(false)
        player.setVolume(1)
      }
    } catch { /* best-effort */ }
  }, [])

  // Pin the highest-quality feed. Twitch's list is empty until playback starts,
  // so this is best-effort and retried; 'chunked' is source, else the top entry.
  const forceQuality = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    try {
      const qualities = player.getQualities?.() ?? []
      if (qualities.length === 0) {
        player.setQuality(SOURCE_QUALITY) // list not ready yet — ask for source anyway
        return
      }
      const source = qualities.find((q) => q.group === SOURCE_QUALITY)
      player.setQuality(source ? SOURCE_QUALITY : qualities[0].group) // list is best→worst
    } catch { /* best-effort */ }
  }, [])

  // Brand wipe on every state change (not initial load) — state adjustment
  // during render, then a timeout effect clears it after the 1.4s stinger.
  const [prevMode, setPrevMode] = useState<MasterState['mode'] | null>(null)
  if (prevMode !== state.mode) {
    setPrevMode(state.mode)
    if (prevMode !== null) setShowWipe(true)
    // Re-cover on every mode change; the reveal effect lifts it after the hold.
    setFeedReady(false)
  }

  useEffect(() => {
    if (!showWipe) return
    const t = setTimeout(() => setShowWipe(false), 1400)
    return () => clearTimeout(t)
  }, [showWipe])

  // ── Feed reveal: the cover is reset to hidden-feed on every mode change (the
  //    render-phase block above). Once LIVE, hold it a beat so the Twitch startup
  //    reveal (poster, preroll, chrome flash) is fully masked, then lift it. This
  //    re-arms on first load, reconnect, and each OBS watchdog reload. ──
  useEffect(() => {
    if (state.mode !== 'LIVE') return
    const t = setTimeout(() => setFeedReady(true), REVEAL_HOLD_MS)
    return () => clearTimeout(t)
  }, [state.mode])

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
  //    the Twitch API every minute and records streamActivity on the slot doc we
  //    already subscribe to, giving us ground truth that's independent of the
  //    embed's flaky events:
  //
  //      lastLive=true  → leave any pre-live card (STARTING_SOON / INTERMISSION).
  //         The embed's ONLINE event only fires on an offline→online *transition*,
  //         so a channel that's already live when /player loads never triggers it
  //         and the page would otherwise hang on STARTING_SOON.
  //      lastLive=false → backstop drop detection: only from LIVE, and only once
  //         the channel hasn't been seen live for SERVER_OFFLINE_CONFIRM_MS, so a
  //         one-off Helix hiccup can't yank a healthy stream to BRB.
  //
  //    Paired with the embed OFFLINE/ENDED override below (which ignores flaky
  //    drops while server-live), this keeps /player pinned to the feed whenever
  //    the streamer is genuinely broadcasting — including rescuing a BRB we only
  //    entered from a race. ──
  const activity = currentSlot?.streamActivity
  // Mirrors for use inside the embed event callbacks, which are attached once
  // and otherwise close over stale values.
  const channelRef = useRef(channel)
  useEffect(() => { channelRef.current = channel }, [channel])
  const activityRef = useRef(activity)
  useEffect(() => { activityRef.current = activity }, [activity])
  useEffect(() => {
    const signal = serverLiveSignal(state.mode, channel, activity, Date.now())
    if (signal === 'GO_LIVE') dispatch({ type: 'PLAYER_ONLINE' })
    else if (signal === 'GO_OFFLINE') dispatch({ type: 'PLAYER_OFFLINE', nowMs: Date.now() })
  }, [channel, activity, state.mode])

  // Reaching LIVE by ANY path (embed ONLINE/PLAYING or the server signal above)
  // means the channel is up — cancel the mount-timeout so it can't later fire a
  // spurious PLAYER_OFFLINE and bounce a healthy stream into BRB. This is the
  // fix for a false "We'll be right back" ~15s after an already-live load.
  useEffect(() => {
    if (state.mode === 'LIVE' && mountTimeoutRef.current) {
      clearTimeout(mountTimeoutRef.current)
      mountTimeoutRef.current = null
    }
  }, [state.mode])
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
      // Pin source quality once playback is up. The quality list populates a
      // beat after PLAYING, so retry across the reveal-hold window (all covered).
      forceQuality()
      setTimeout(forceQuality, 1_500)
      setTimeout(forceQuality, 3_000)
    }

    let player: TwitchPlayer

    const attach = (PlayerCtor: TwitchPlayerCtor) => {
      player.addEventListener(PlayerCtor.READY, () => { logEvent('READY'); syncAudio(); forceQuality() })
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
      // Embed OFFLINE/ENDED are unreliable: they fire when a live channel is
      // merely paused, mid-reload, or briefly reconnecting. Honour them ONLY
      // when the server's Helix check doesn't currently confirm the channel is
      // live — otherwise a healthy (often paused) feed gets bounced to BRB and,
      // because the drop keeps re-firing, never comes back. Server-live wins.
      const onEmbedDrop = (label: string) => {
        const serverLive = isServerLive(channelRef.current, activityRef.current, Date.now())
        logEvent(`${label}${serverLive ? ' (ignored: server live)' : ''}`)
        if (!serverLive) dispatch({ type: 'PLAYER_OFFLINE', nowMs: Date.now() })
      }
      player.addEventListener(PlayerCtor.OFFLINE, () => onEmbedDrop('OFFLINE'))
      player.addEventListener(PlayerCtor.ENDED, () => onEmbedDrop('ENDED'))
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
            quality: SOURCE_QUALITY, // request source from first frame (best-effort hint)
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
  }, [channel, hostname, obs, logEvent, syncAudio, forceQuality])

  // ── Playback + audio: the feed always autoplays; audible only when LIVE ──
  useEffect(() => { syncAudio() }, [state.mode, syncAudio])

  // While LIVE, gently re-check audio so the feed can't silently drift muted
  // (guards against Twitch/CEF quietly re-muting mid-broadcast). assertAudio is
  // a no-op unless actually muted, so it never disturbs a healthy feed.
  useEffect(() => {
    if (state.mode !== 'LIVE') return
    const t = setInterval(assertAudio, AUDIO_ASSERT_MS)
    return () => clearInterval(t)
  }, [state.mode, assertAudio])

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

  // Operator preview: /player?preview=board|brb|starting|wipe|promo forces a state
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
        {preview === 'promo' && <OnAirPromo preview />}
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

      {/* Branded curtain over the LIVE feed until it settles — masks the Twitch
          play-button poster / preroll / channel-chrome reveal on first load and
          on every OBS watchdog reload. */}
      {state.mode === 'LIVE' && !feedReady && <FeedCover label="Now Live" />}

      {/* Network-style promo lower-third over the live feed — who's on, who's
          next, what CSGN is — at most once every five minutes, ~9s at a time.
          Mounted only after the reveal so its clock starts with a settled feed. */}
      {state.mode === 'LIVE' && feedReady && <OnAirPromo />}

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
