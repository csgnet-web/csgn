import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { onSnapshot, doc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeToCurrentSlot, type Slot } from '@/lib/slots'
import { detectStream } from '@/lib/player'

const DEFAULT_TWITCH_STREAM = 'https://www.twitch.tv/csgnet'

/**
 * /player — Admin-only OBS Browser-Capture surface.
 *
 * Goals (per OBS requirements):
 *   • zero loading UI, zero buffer overlays, zero placeholders
 *   • audio always on (OBS captures page audio)
 *   • iframe rendered eagerly with autoplay so the embed never re-mounts
 *
 * Strategy:
 *   • Build the embed src once per stream URL change. The iframe mounts once
 *     and stays mounted; OBS Browser Capture sees a single, persistent player.
 *   • Twitch + YouTube embeds both autoplay with audio on (mute=0 / muted=false).
 *   • Render zero spinners, "loading…" text, or fallbacks. If no slot is live,
 *     fall back to the canonical CSGN Twitch channel so something is always
 *     playing.
 */
function buildEmbedSrc(streamUrl: string, hostname: string): string {
  const stream = detectStream(streamUrl) ?? detectStream(DEFAULT_TWITCH_STREAM)!
  if (stream.type === 'youtube') {
    const params = new URLSearchParams({
      autoplay: '1',
      mute: '0',
      controls: '0',
      rel: '0',
      modestbranding: '1',
      iv_load_policy: '3',
      disablekb: '1',
      playsinline: '1',
    })
    return `https://www.youtube-nocookie.com/embed/${stream.id}?${params.toString()}`
  }
  const params = new URLSearchParams({
    channel: stream.id,
    parent: hostname,
    autoplay: 'true',
    muted: 'false',
    controls: 'false',
  })
  return `https://player.twitch.tv/?${params.toString()}`
}

export default function Player() {
  const { profile, loading } = useAuth()
  const hostname = useMemo(() => (typeof window !== 'undefined' ? window.location.hostname : 'localhost'), [])

  const [currentSlot, setCurrentSlot] = useState<Slot | null>(null)
  const [playerOverride, setPlayerOverride] = useState<string | null>(null)

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'config', 'playerFeed'),
      (snap) => setPlayerOverride(snap.exists() ? (snap.data().url || null) : null),
      () => setPlayerOverride(null),
    )
    return unsub
  }, [])

  useEffect(() => {
    const unsub = subscribeToCurrentSlot((slot) => setCurrentSlot(slot))
    return unsub
  }, [])

  if (loading) return null
  if (!profile || profile.role !== 'admin') return <Navigate to="/" replace />

  const streamUrl = playerOverride ?? currentSlot?.streamUrl ?? DEFAULT_TWITCH_STREAM
  const src = buildEmbedSrc(streamUrl, hostname)

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <iframe
        key={src}
        src={src}
        title="CSGN /player"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowFullScreen
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 0,
          background: '#000',
        }}
      />
    </div>
  )
}
