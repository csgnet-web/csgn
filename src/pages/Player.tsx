import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
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
import { loadTwitchPlayer, type TwitchPlayer } from '@/lib/twitchEmbed'
import { useLiveSlot } from '@/contexts/useLiveSlot'
import { WipeOverlay } from '@/components/ui/WipeOverlay'
import IntermissionBoard from '@/components/player/IntermissionBoard'
import StatusCard from '@/components/player/StatusCard'
import VodRotator, { type VodItem } from '@/components/player/VodRotator'
import { formatESTRange, DEFAULT_STREAM_URL } from '@/lib/slots'

interface EmergencyOverride { enabled?: boolean; streamUrl?: string }

const TICK_MS = 5_000

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
 * non-LIVE state — its ONLINE event is the signal that wipes back to the feed.
 */
export default function Player() {
  const hostname = useMemo(() => (typeof window !== 'undefined' ? window.location.hostname : 'localhost'), [])
  const { currentSlot } = useLiveSlot()
  const [state, dispatch] = useReducer(reduce, INITIAL_STATE)
  const [vodItems, setVodItems] = useState<VodItem[]>([])
  const [emergency, setEmergency] = useState<EmergencyOverride | null>(null)
  const [showWipe, setShowWipe] = useState(false)

  const playerRef = useRef<TwitchPlayer | null>(null)
  const playerContainerRef = useRef<HTMLDivElement>(null)
  const mountTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
  useEffect(() => {
    if (!channel) return
    let cancelled = false

    const armMountTimeout = () => {
      if (mountTimeoutRef.current) clearTimeout(mountTimeoutRef.current)
      mountTimeoutRef.current = setTimeout(() => {
        dispatch({ type: 'PLAYER_OFFLINE', nowMs: Date.now() })
      }, MOUNT_TIMEOUT_MS)
    }

    if (playerRef.current) {
      playerRef.current.setChannel(channel)
      armMountTimeout()
    } else {
      loadTwitchPlayer()
        .then((PlayerCtor) => {
          if (cancelled || !playerContainerRef.current || playerRef.current) return
          const player = new PlayerCtor(playerContainerRef.current, {
            channel,
            parent: [hostname],
            width: '100%',
            height: '100%',
            autoplay: true,
            muted: true,
          })
          player.addEventListener(PlayerCtor.ONLINE, () => {
            if (mountTimeoutRef.current) clearTimeout(mountTimeoutRef.current)
            dispatch({ type: 'PLAYER_ONLINE' })
          })
          player.addEventListener(PlayerCtor.OFFLINE, () => dispatch({ type: 'PLAYER_OFFLINE', nowMs: Date.now() }))
          player.addEventListener(PlayerCtor.ENDED, () => dispatch({ type: 'PLAYER_OFFLINE', nowMs: Date.now() }))
          playerRef.current = player
          armMountTimeout()
        })
        .catch(() => dispatch({ type: 'PLAYER_OFFLINE', nowMs: Date.now() }))
    }

    return () => {
      cancelled = true
      if (mountTimeoutRef.current) clearTimeout(mountTimeoutRef.current)
    }
  }, [channel, hostname])

  // ── Audio: the feed is audible only when LIVE ──
  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    if (state.mode === 'LIVE') {
      player.setMuted(false)
      player.setVolume(1)
    } else {
      player.setMuted(true)
    }
  }, [state.mode])

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
    </div>
  )
}
