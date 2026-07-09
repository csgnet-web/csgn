import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { onSnapshot, doc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { detectStream } from '@/lib/player'
import {
  reduce,
  serverLiveSignal,
  isServerLive,
  isServerConfirmedOffline,
  INITIAL_STATE,
  MOUNT_TIMEOUT_MS,
  type BroadcastDoc,
  type MasterState,
} from '@/lib/masterControl'
import { createFeedGate, PROGRESS_TICK_MS, type FeedGate, type GateDecision } from '@/lib/feedGate'
import { loadTwitchPlayer, type TwitchPlayer, type TwitchPlayerCtor } from '@/lib/twitchEmbed'
import { isOBS, obsVersion } from '@/lib/environment'
import { useLiveSlot } from '@/contexts/useLiveSlot'
import { WipeOverlay } from '@/components/ui/WipeOverlay'
import IntermissionBoard from '@/components/player/IntermissionBoard'
import StatusCard from '@/components/player/StatusCard'
import VodRotator, { type VodItem } from '@/components/player/VodRotator'
import FeedCover from '@/components/player/FeedCover'
import { formatESTRange, DEFAULT_STREAM_URL } from '@/lib/slots'

interface EmergencyOverride { enabled?: boolean; streamUrl?: string }

const TICK_MS = 5_000
/** While LIVE, re-check audio on this cadence and unmute ONLY if it has drifted
 *  back to muted. Deliberately gentle: we never call play() or re-set volume on
 *  a healthy feed, because those re-trigger Twitch's overlay chrome and can
 *  rebuffer — the flashing-UI + stutter the old 8s keepalive caused on-stream. */
const AUDIO_ASSERT_MS = 15_000
/** Twitch's source (highest) quality group. Pinned once per playback session,
 *  after the preroll mask, from a populated quality list — the operator wants
 *  max quality out to X. Never requested during bootstrap: setQuality() while
 *  Twitch is stitching the preroll is what froze the feed on the first ad
 *  frame (player chrome stuck showing "playing", no frames ever advancing). */
const SOURCE_QUALITY = 'chunked'
/** Short beat between FeedGate confirming content and the cover lifting, so
 *  the reveal lands on a feed that has already proven stable. The heavy
 *  lifting (preroll mask, pin settle, stability) happens inside FeedGate —
 *  this is just a debounce, not the protection itself. */
const REVEAL_HOLD_MS = 1_200
/** Never rebuild the embed more often than this (each rebuild re-buffers). */
const EMBED_REBUILD_MIN_MS = 30_000
/** Only play the brand wipe when leaving a mode we actually settled in.
 *  Rapid-fire transitions (boot settling into the real network state, a brief
 *  event race) would otherwise stack/restart the stinger — the "wipe ran
 *  twice" glitch an operator can see on-stream. */
const WIPE_MIN_DWELL_MS = 5_000
/** Hard ceiling on how long the "Now Live" curtain may hold while the state
 *  machine says LIVE. FeedGate's confirm normally lifts the cover well before
 *  this (mask + pin + hold ≈ 37s); if it never can — getCurrentTime blind in
 *  OBS's CEF, an embed wedged in a rebuild loop, any failure we haven't met
 *  yet — the feed is revealed and unmuted anyway. A visible Twitch stream
 *  always beats a perfect transition: fail OPEN, never hold the curtain
 *  indefinitely. Once the deadline reveals, the gate may no longer re-cover
 *  or tear the embed down; the OBS operator owns any remaining cleanup. */
const LIVE_REVEAL_DEADLINE_MS = 45_000

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
 * otherwise sit on STARTING_SOON forever).
 *
 * Playback handling is "quiet bootstrap": between constructing the embed
 * (autoplay, muted) and FeedGate confirming that broadcast content is actually
 * flowing, the player is never touched — no play(), no setQuality(), no
 * unmute. Twitch stitches preroll ads server-side into the live session, its
 * READY/PLAYING events fire while the *ad* runs, and poking the player inside
 * that window wedged it frozen on the first ad frame. The branded cover stays
 * up (and audio stays muted) through the whole gate window, so neither the ad
 * video, Twitch's ad countdown, nor any startup chrome can reach the encode —
 * only settled broadcast video is ever revealed. Audio is forced on when the
 * gate confirms; in a normal browser tab, where the autoplay policy blocks a
 * gesture-less unmute, a one-tap affordance unlocks sound.
 */
export default function Player() {
  const hostname = useMemo(() => (typeof window !== 'undefined' ? window.location.hostname : 'localhost'), [])
  const obs = useMemo(() => isOBS(), [])
  const { currentSlot, slotsReady } = useLiveSlot()
  const [state, dispatch] = useReducer(reduce, INITIAL_STATE)
  const [vodItems, setVodItems] = useState<VodItem[]>([])
  const [emergency, setEmergency] = useState<EmergencyOverride | null>(null)
  const [showWipe, setShowWipe] = useState(false)
  // The branded cover stays over the LIVE feed until playback is confirmed
  // flowing — masks the Twitch startup reveal (poster, preroll ad + countdown,
  // chrome flash) on both first load and every rebuild.
  const [feedReady, setFeedReady] = useState(false)
  // FeedGate has confirmed the armed channel's broadcast content is flowing
  // (frames advancing, preroll mask elapsed, quality pinned and settled). This
  // — never an embed event or a bare timer — is what allows the cover to lift
  // and audio to come on, so an ad or a wedged/mistuned embed can never reach
  // the encode.
  const [playbackOk, setPlaybackOk] = useState(false)
  const playbackOkRef = useRef(false)
  useEffect(() => { playbackOkRef.current = playbackOk }, [playbackOk])
  // The reveal deadline fired: the gate couldn't confirm in time, so the feed
  // was force-revealed. While set, the gate's observations are treated as
  // untrustworthy — it may not re-cover the feed or rebuild the embed, since
  // either would fight a stream that may be playing fine beyond its sight.
  const [forceReveal, setForceReveal] = useState(false)
  const forceRevealRef = useRef(false)
  useEffect(() => { forceRevealRef.current = forceReveal }, [forceReveal])
  // Bumped to tear down and recreate the Twitch embed when FeedGate finds it
  // wedged (LIVE with no frames advancing — e.g. frozen on a preroll).
  const [rebuildNonce, setRebuildNonce] = useState(0)
  // The browser blocked autoplay-with-sound (normal tabs only) — surface a
  // one-tap "enable sound" affordance. Never happens inside OBS.
  const [audioBlocked, setAudioBlocked] = useState(false)

  const playerRef = useRef<TwitchPlayer | null>(null)
  // The channel the CURRENT embed instance was constructed for. The embed is
  // only ever tuned via its constructor — a channel change tears it down and
  // rebuilds it — so this ref is definitionally what the iframe is playing.
  // (setChannel/getChannel are deliberately never used: Twitch silently drops
  // setChannel mid-bootstrap, getChannel lags behind a retune, and acting on
  // either wedged real broadcasts — the mistuned-offline-page and
  // stuck-unplayed-after-slot-change failures.)
  const armedChannelRef = useRef<string | null>(null)
  // One FeedGate per embed instance — recreated with the embed so a rebuild or
  // retune always starts from a clean "nothing observed yet" state.
  const gateRef = useRef<FeedGate | null>(null)
  const playerContainerRef = useRef<HTMLDivElement>(null)
  const mountTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastRebuildAtRef = useRef(0)

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
  const [gateInfo, setGateInfo] = useState('—')
  // Deferred one tick so it's safe to call from anywhere, including
  // synchronously inside effects; the timestamp is captured at call time.
  const logEvent = useCallback((name: string) => {
    const stamp = new Date().toLocaleTimeString()
    setTimeout(() => setEventLog((prev) => [...prev.slice(-9), `${stamp}  ${name}`]), 0)
  }, [])

  // Drop playback confidence and re-cover the feed. Deferred one tick so it's
  // safe to call synchronously inside effects (react-hooks/set-state-in-effect);
  // 0ms is imperceptible next to the 1.4s wipe and the gate's confirm window.
  const coverFeed = useCallback(() => {
    setTimeout(() => {
      setPlaybackOk(false)
      setFeedReady(false)
    }, 0)
  }, [])

  // The feed is (or may be) down: re-cover it so nothing raw shows, and tell
  // the state machine. Every offline signal funnels through here.
  const feedDown = useCallback(() => {
    coverFeed()
    dispatch({ type: 'PLAYER_OFFLINE', nowMs: Date.now() })
  }, [coverFeed])

  // Tear the embed down and recreate it (the channel-lifecycle effect re-runs
  // via rebuildNonce and finds playerRef empty). Rate-limited: each rebuild is
  // a re-buffer, so it's a last resort; FeedGate re-signals until it lands.
  const rebuildPlayer = useCallback(() => {
    const now = Date.now()
    if (now - lastRebuildAtRef.current < EMBED_REBUILD_MIN_MS) return
    lastRebuildAtRef.current = now
    logEvent('embed rebuild')
    if (playerContainerRef.current) playerContainerRef.current.innerHTML = ''
    playerRef.current = null
    armedChannelRef.current = null
    gateRef.current = null
    setPlaybackOk(false)
    setFeedReady(false)
    setRebuildNonce((n) => n + 1)
  }, [logEvent])

  // ── Audio policy: muted until FeedGate confirms broadcast content while
  //    LIVE, then audible. Never unmutes during the bootstrap/preroll window —
  //    that both leaked ad audio to the encode and (in normal tabs, where a
  //    gesture-less unmute is blocked) knocked the bootstrapping player over.
  //    setMuted(false) is honoured inside OBS (autoplay-with-sound allowed)
  //    and in tabs where the viewer has already interacted; otherwise the
  //    player fires PLAYBACK_BLOCKED and we fall back to tap-to-unmute. ──
  const syncAudio = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    try {
      if (modeRef.current === 'LIVE' && playbackOkRef.current) {
        player.setMuted(false)
        player.setVolume(1)
      } else {
        player.setMuted(true)
      }
    } catch { /* best-effort */ }
  }, [])

  // Gentle mid-broadcast audio check: only touch the player if it has actually
  // drifted back to muted. Unlike syncAudio it never re-sets volume on a
  // healthy feed — redundant calls flashed Twitch's overlay chrome and could
  // rebuffer, which is what made the old 8s keepalive visible on-stream.
  // Silent no-op in the common (already-audible) case.
  const assertAudio = useCallback(() => {
    const player = playerRef.current
    if (!player || modeRef.current !== 'LIVE' || !playbackOkRef.current) return
    try {
      if (player.getMuted()) {
        player.setMuted(false)
        player.setVolume(1)
      }
    } catch { /* best-effort */ }
  }, [])

  // Pin the highest-quality feed — source ('chunked') when present, else the
  // top of Twitch's best→worst list. Called ONLY when FeedGate says the mask
  // is over and the list is populated; a blind setQuality on an empty list
  // mid-bootstrap is exactly the poke that froze prerolls.
  const pinSourceQuality = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    try {
      const qualities = player.getQualities?.() ?? []
      if (qualities.length === 0) return
      const source = qualities.find((q) => q.group === SOURCE_QUALITY)
      player.setQuality(source ? SOURCE_QUALITY : qualities[0].group)
      logEvent(`quality pinned (${source ? SOURCE_QUALITY : qualities[0].group})`)
    } catch { /* best-effort */ }
  }, [logEvent])

  // Re-cover the feed the instant the mode changes — render-phase adjustment
  // so not even one frame of the new state leaks out unrevealed.
  const [prevMode, setPrevMode] = useState<MasterState['mode'] | null>(null)
  if (prevMode !== state.mode) {
    setPrevMode(state.mode)
    setFeedReady(false)
    setForceReveal(false)
  }

  // Brand wipe on state changes, gated on dwell time: only a transition out of
  // a mode we actually settled in gets the stinger, so the boot sequence
  // (INTERMISSION → STARTING_SOON → LIVE inside a couple of seconds) and brief
  // event races can't fire overlapping/back-to-back wipes.
  const modeChangedAtRef = useRef<number | null>(null)
  useEffect(() => {
    const now = Date.now()
    const last = modeChangedAtRef.current
    modeChangedAtRef.current = now
    if (last === null || now - last < WIPE_MIN_DWELL_MS) return
    const t = setTimeout(() => setShowWipe(true), 0)
    return () => clearTimeout(t)
  }, [state.mode])

  useEffect(() => {
    if (!showWipe) return
    const t = setTimeout(() => setShowWipe(false), 1400)
    return () => clearTimeout(t)
  }, [showWipe])

  // ── Feed reveal: the cover is reset to hidden-feed on every mode change (the
  //    render-phase block above) and whenever playback confidence is lost. It
  //    lifts ONLY once FeedGate has confirmed broadcast content (playbackOk)
  //    plus a short debounce — never on a timer or an embed event alone. If
  //    the embed never actually plays, the branded cover simply stays up and
  //    the gate rebuilds the embed behind it. ──
  useEffect(() => {
    if (state.mode !== 'LIVE' || !playbackOk) return
    const t = setTimeout(() => setFeedReady(true), REVEAL_HOLD_MS)
    return () => clearTimeout(t)
  }, [state.mode, playbackOk])

  // ── Reveal deadline (fail-open): the cover may NEVER hold longer than
  //    LIVE_REVEAL_DEADLINE_MS while LIVE. The gate lifting the cover clears
  //    this timer; if the gate can't, the video is shown and unmuted anyway
  //    and the gate loses its power to re-cover or rebuild (forceReveal).
  //    Re-arms whenever the cover comes back, so cover time stays bounded on
  //    every path — the page can never sit on "Now Live" indefinitely. ──
  useEffect(() => {
    if (state.mode !== 'LIVE' || feedReady) return
    const t = setTimeout(() => {
      logEvent('reveal deadline — forcing feed visible')
      setForceReveal(true)
      setPlaybackOk(true)
      setFeedReady(true)
    }, LIVE_REVEAL_DEADLINE_MS)
    return () => clearTimeout(t)
  }, [state.mode, feedReady, logEvent])

  // ── Firestore: admin emergency override (non-slot takeover URL) ──
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'config', 'emergencyOverride'),
      (snap) => setEmergency(snap.exists() ? (snap.data() as EmergencyOverride) : null),
      () => setEmergency(null),
    )
    return unsub
  }, [])

  // Operator hook (?channel=name): force /player onto a specific public Twitch
  // channel, bypassing slot data — for checking a channel inside OBS before
  // its slot starts, and for driving deterministic end-to-end tests. The
  // admin emergency override still wins.
  const forcedChannel = useMemo(() => {
    if (typeof window === 'undefined') return null
    const raw = new URLSearchParams(window.location.search).get('channel')
    if (!raw) return null
    const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    return cleaned || null
  }, [])

  // ── Broadcast source is derived live from the shared slot data + override,
  //    so an admin changing a slot's stream URL or status (or the clock rolling
  //    into a new slot) switches /player automatically — no server round-trip. ──
  const broadcast = useMemo<BroadcastDoc>(() => {
    if (emergency?.enabled && emergency.streamUrl) {
      return { streamUrl: emergency.streamUrl, source: 'emergency_override', slotId: null }
    }
    if (forcedChannel) {
      return { streamUrl: `https://www.twitch.tv/${forcedChannel}`, source: 'slot', slotId: null }
    }
    if (currentSlot) {
      const assigned = Boolean(currentSlot.assignedUid) || currentSlot.status === 'confirmed' || currentSlot.status === 'live'
      return {
        streamUrl: currentSlot.streamUrl || DEFAULT_STREAM_URL,
        source: assigned ? 'slot' : 'default',
        slotId: currentSlot.id,
      }
    }
    // Slots not loaded yet: hold intermission with NO channel armed. Arming the
    // default channel here starts the embed on it, and a slot streamer arriving
    // a beat later then depends on a retune the Twitch iframe can silently drop
    // mid-bootstrap — how a mistuned offline page ended up on-stream.
    if (!slotsReady) return { streamUrl: '', source: 'loading', slotId: null }
    return { streamUrl: DEFAULT_STREAM_URL, source: 'default', slotId: null }
  }, [emergency, forcedChannel, currentSlot, slotsReady])

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

  // ── Twitch player lifecycle: one instance, rebuilt per channel ──
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
    else if (signal === 'GO_OFFLINE') feedDown()
  }, [channel, activity, state.mode, feedDown])

  // Reaching LIVE by ANY path (embed ONLINE/PLAYING, the server signal above,
  // or FeedGate confirming frames) means the channel is up — cancel the
  // mount-timeout so it can't later fire a spurious PLAYER_OFFLINE and bounce
  // a healthy stream into BRB. This is the fix for a false "We'll be right
  // back" ~15s after an already-live load.
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
      // Already LIVE (server-confirmed or prior event) — a "no ONLINE event
      // after mount" timer is only meaningful pre-live, and firing it here
      // would bounce a healthy rebuild/retune into BRB.
      if (modeRef.current === 'LIVE') return
      mountTimeoutRef.current = setTimeout(feedDown, MOUNT_TIMEOUT_MS)
    }

    // Any signal that the channel is live cuts the state machine to LIVE. We
    // deliberately do NOT rely on ONLINE alone: inside OBS's CEF that event is
    // unreliable and the page would sit on "Starting Soon" forever, so a real
    // PLAYING event (playback began ⇒ the channel must be online) counts too.
    // Note this ONLY moves the state machine — the cover lift, audio, and
    // quality pin all wait for FeedGate, because PLAYING fires while Twitch's
    // stitched preroll ad is playing and acting on the player then wedged it.
    const goLive = (via: string) => {
      // Guard: only events from an embed armed on the CURRENT channel count.
      // A channel change tears the embed down and rebuilds it, but an event
      // from the outgoing iframe can still land during the swap — it must not
      // flip us LIVE or lift the cover for the wrong stream.
      if (armedChannelRef.current !== channelRef.current) {
        logEvent(`${via} ignored: stale embed (${armedChannelRef.current ?? '—'})`)
        return
      }
      logEvent(`→ LIVE (${via})`)
      if (mountTimeoutRef.current) clearTimeout(mountTimeoutRef.current)
      setAudioBlocked(false) // fresh live feed — clear any stale block flag
      gateRef.current?.notePlaying() // fallback truth if getCurrentTime is unavailable
      dispatch({ type: 'PLAYER_ONLINE' })
    }

    let player: TwitchPlayer

    const attach = (PlayerCtor: TwitchPlayerCtor) => {
      player.addEventListener(PlayerCtor.READY, () => logEvent('READY'))
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
      // Either way, playback is no longer confirmed — re-cover the feed so the
      // encode shows the branded curtain, never Twitch's offline chrome; a
      // spurious drop keeps frames advancing and FeedGate re-confirms moments
      // later, so the cover lifts again on its own.
      const onEmbedDrop = (label: string) => {
        const serverLive = isServerLive(channelRef.current, activityRef.current, Date.now())
        logEvent(`${label}${serverLive ? ' (ignored: server live)' : ''}`)
        setPlaybackOk(false)
        setFeedReady(false)
        if (!serverLive) dispatch({ type: 'PLAYER_OFFLINE', nowMs: Date.now() })
      }
      player.addEventListener(PlayerCtor.OFFLINE, () => onEmbedDrop('OFFLINE'))
      player.addEventListener(PlayerCtor.ENDED, () => onEmbedDrop('ENDED'))
    }

    // A different channel is armed: tear the old embed down completely and
    // rebuild tuned from the constructor. setChannel() is deliberately never
    // used for this — Twitch silently drops it mid-bootstrap (the mistuned
    // offline-page incident) and retuning can wedge playback in a restart
    // loop (video stuck unplayed after a slot change). A constructor-tuned
    // iframe is deterministic: it is on the right channel from birth.
    if (playerRef.current && armedChannelRef.current !== channel) {
      logEvent(`channel change → rebuild (${armedChannelRef.current ?? '—'} → ${channel})`)
      if (playerContainerRef.current) playerContainerRef.current.innerHTML = ''
      playerRef.current = null
      armedChannelRef.current = null
      gateRef.current = null
      coverFeed()
    }

    if (playerRef.current) {
      armMountTimeout() // same channel — effect re-ran for another reason
    } else {
      loadTwitchPlayer()
        .then((PlayerCtor) => {
          if (cancelled || !playerContainerRef.current || playerRef.current) return
          // Quiet bootstrap: autoplay muted with stock options and then hands
          // off. No quality request here — the pin waits for FeedGate, because
          // any rendition demand while Twitch stitches the preroll can wedge
          // playback on the first ad frame.
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
          armedChannelRef.current = channel
          gateRef.current = createFeedGate(Date.now())
          armMountTimeout()
        })
        .catch(() => { logEvent('embed load failed'); feedDown() })
    }

    return () => {
      cancelled = true
      if (mountTimeoutRef.current) clearTimeout(mountTimeoutRef.current)
    }
  }, [channel, rebuildNonce, hostname, obs, logEvent, syncAudio, feedDown, coverFeed])

  // ── FeedGate sampling: once a second, read what the embed is *actually*
  //    doing (frames advancing? quality list up?) and act on the gate's
  //    decisions. This loop — not Twitch's events — owns the cover, the
  //    audio unlock, the quality pin, and wedge recovery:
  //
  //      confirmed   broadcast content flowing post-mask → playbackOk (reveal
  //                  + unmute); also cuts the state machine to LIVE, which
  //                  covers OBS's CEF when ONLINE/PLAYING never fire.
  //      pinQuality  safe moment to pin source quality (list populated).
  //      nudge       frames stopped on a previously-flowing feed → one gentle
  //                  play() behind the cover.
  //      rebuild     LIVE but no frames for 20s (e.g. frozen on a preroll —
  //                  the player chrome still claims "playing") → tear down and
  //                  reconstruct the embed behind the cover. ──
  useEffect(() => {
    if (!channel) return
    const t = setInterval(() => {
      const player = playerRef.current
      const gate = gateRef.current
      if (!player || !gate) return
      let currentTimeS: number | null = null
      let qualityCount = 0
      try {
        const ct = player.getCurrentTime?.()
        if (typeof ct === 'number' && Number.isFinite(ct)) currentTimeS = ct
        qualityCount = player.getQualities?.()?.length ?? 0
      } catch { /* sampled best-effort — nulls mean "unknown" */ }

      const d: GateDecision = gate.sample({
        nowMs: Date.now(),
        currentTimeS,
        qualityCount,
        live: modeRef.current === 'LIVE',
      })

      if (d.pinQuality) pinSourceQuality()
      if (d.nudge) {
        logEvent('stall: nudging play()')
        try { player.play() } catch { /* best-effort */ }
      }
      // After a deadline reveal the gate is blind or wrong — a rebuild would
      // tear down (and a demotion would re-cover) a feed that may be playing
      // fine beyond its sight. Only the clean confirm path stays active.
      if (d.rebuild && !forceRevealRef.current) {
        logEvent('gate: no frames while LIVE — rebuilding')
        rebuildPlayer()
      }
      if (d.confirmed !== playbackOkRef.current && (d.confirmed || !forceRevealRef.current)) {
        logEvent(d.confirmed ? 'gate: content confirmed' : `gate: feed lost (${d.phase})`)
        setPlaybackOk(d.confirmed)
        if (!d.confirmed) setFeedReady(false)
      }
      // Frames of broadcast content are flowing ⇒ the channel is live, even if
      // every Twitch event went missing (OBS CEF) — bring the state machine.
      // Defer to the server when it has WATCHED the channel go offline, so
      // this inference can't fight a Helix-driven BRB into a LIVE↔BRB flap;
      // real-time embed events (ONLINE/PLAYING) still win over a stale sample.
      if (
        d.confirmed &&
        modeRef.current !== 'LIVE' &&
        !isServerConfirmedOffline(channelRef.current, activityRef.current, Date.now())
      ) {
        dispatch({ type: 'PLAYER_ONLINE' })
      }

      if (debug) {
        setGateInfo(`${d.phase} · mask ${(d.maskRemainingMs / 1000).toFixed(0)}s · idle ${(d.sinceProgressMs / 1000).toFixed(0)}s · q${qualityCount}`)
      }
    }, PROGRESS_TICK_MS)
    return () => clearInterval(t)
  }, [channel, rebuildNonce, debug, pinSourceQuality, rebuildPlayer, logEvent])

  // ── Audio follows mode + gate: audible only when LIVE with confirmed
  //    content; muted through every mask/bootstrap/stall window. ──
  useEffect(() => { syncAudio() }, [state.mode, playbackOk, syncAudio])

  // While on-air, gently re-check audio so the feed can't silently drift muted
  // (guards against Twitch/CEF quietly re-muting mid-broadcast). assertAudio is
  // a no-op unless actually muted, so it never disturbs a healthy feed.
  useEffect(() => {
    if (state.mode !== 'LIVE' || !playbackOk) return
    const t = setInterval(assertAudio, AUDIO_ASSERT_MS)
    return () => clearInterval(t)
  }, [state.mode, playbackOk, assertAudio])

  // ── Browser-only: unlock audio on the first user gesture. Browsers refuse a
  //    programmatic unmute until the viewer interacts; OBS needs none of this.
  //    The gesture just clears the block and re-applies the audio policy —
  //    audio still waits for FeedGate, so a tap during the ad mask can't leak
  //    ad sound from behind the cover. ──
  useEffect(() => {
    if (obs) return
    const unlock = () => {
      syncAudio()
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
  }, [obs, syncAudio])

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
        {preview === 'wipe' && <WipeOverlay visible label="Now Live" streamerName={streamerName || 'Streamer'} slotLabel={slotLabel} />}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Twitch player — always mounted while a channel is armed; hidden+muted
          unless LIVE so playback can be confirmed and cut back at any moment.
          pointer-events off: no click or hover may ever reach the iframe, so
          Twitch's control bar / pause / channel chrome can't be summoned onto
          the encode (or by a stray viewer click) — /player has its own
          tap-for-sound affordance outside the iframe. */}
      <div
        ref={playerContainerRef}
        className="absolute inset-0"
        style={{ visibility: state.mode === 'LIVE' ? 'visible' : 'hidden', pointerEvents: 'none' }}
      />

      {/* Branded curtain over the LIVE feed until FeedGate confirms settled
          broadcast content — masks the play-button poster, the entire preroll
          ad window (video, countdown text, "commercial break" chrome), and
          every startup/rebuild reveal. */}
      {state.mode === 'LIVE' && !feedReady && (
        <FeedCover label="Now Live" streamerName={streamerName} slotLabel={slotLabel} />
      )}

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

      <WipeOverlay
        visible={showWipe}
        label={state.mode === 'LIVE' ? 'Now Live' : 'CSGN 24/7'}
        streamerName={state.mode === 'LIVE' ? streamerName : undefined}
        slotLabel={state.mode === 'LIVE' ? slotLabel : undefined}
      />

      {/* Browser tabs only: the viewer's browser muted the feed until they
          interact. One tap (anywhere, or this button) unlocks sound. */}
      {audioBlocked && !obs && state.mode === 'LIVE' && (
        <button
          type="button"
          onClick={() => {
            syncAudio()
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
          playback={playbackOk ? (feedReady ? 'confirmed (revealed)' : 'confirmed (covered)') : 'not confirmed'}
          gate={gateInfo}
          audioBlocked={audioBlocked}
          serverLive={activity?.lastLive ? `yes @ ${activity.lastCheckedAt ?? '?'}` : String(activity?.lastLive ?? '—')}
          log={eventLog}
        />
      )}
    </div>
  )
}

function DebugOverlay({
  obs, mode, channel, playback, gate, audioBlocked, serverLive, log,
}: {
  obs: boolean
  mode: MasterState['mode']
  channel: string | null
  playback: string
  gate: string
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
      <div className={row}><span>playback</span><span>{playback}</span></div>
      <div className={row}><span>gate</span><span className="truncate max-w-[12rem]">{gate}</span></div>
      <div className={row}><span>audioBlocked</span><span>{String(audioBlocked)}</span></div>
      <div className={row}><span>server live</span><span className="truncate max-w-[10rem]">{serverLive}</span></div>
      <div className="mt-2 border-t border-white/15 pt-1 text-white/60">events</div>
      {log.length === 0 ? <div className="text-white/40">(none yet)</div>
        : log.map((e, i) => <div key={i} className="truncate">{e}</div>)}
    </div>
  )
}
