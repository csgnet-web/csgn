import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { onSnapshot, doc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeToCurrentSlot, formatESTRange, type Slot } from '@/lib/slots'
import { detectStream, buildYouTubeSrc, PLAYER_ALLOW } from '@/lib/player'
const DEFAULT_TWITCH_STREAM = 'https://www.twitch.tv/csgnet'

/* ── YouTube sub-component ── */
function YouTubePlayer({ videoId }: { videoId: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const el = iframeRef.current
    if (!el) return

    const sendCmd = (func: string, args: unknown[] | string = '') =>
      el.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func, args }), '*'
      )

    const unmute = () => {
      sendCmd('unMute')
      sendCmd('setVolume', [100])
    }

    const subscribe = () =>
      el.contentWindow?.postMessage(
        JSON.stringify({ event: 'listening', id: 1 }), '*'
      )

    const onMessage = (e: MessageEvent) => {
      if (e.source !== el.contentWindow) return
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        if (data.event === 'onReady') unmute()
        if (data.event === 'onStateChange' && data.info === 1) unmute()
      } catch { /* non-JSON */ }
    }

    let t1: ReturnType<typeof setTimeout>
    let t2: ReturnType<typeof setTimeout>
    const onLoad = () => {
      subscribe()
      t1 = setTimeout(unmute, 1000)
      t2 = setTimeout(unmute, 3000)
    }

    window.addEventListener('message', onMessage)
    el.addEventListener('load', onLoad)
    return () => {
      window.removeEventListener('message', onMessage)
      el.removeEventListener('load', onLoad)
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [videoId])

  return (
    <iframe
      ref={iframeRef}
      src={buildYouTubeSrc(videoId)}
      className="w-full h-full"
      allow={PLAYER_ALLOW}
      allowFullScreen
      title="CSGN Player"
    />
  )
}

/* ── Twitch sub-component ── */
function TwitchPlayer({ channel, hostname }: { channel: string; hostname: string }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const loadTwitchScript = (): Promise<void> =>
      new Promise((resolve) => {
        if ((window as unknown as Record<string, unknown>).Twitch) { resolve(); return }
        const existing = document.querySelector('script[src="https://embed.twitch.tv/embed/v1.js"]')
        if (existing) {
          existing.addEventListener('load', () => resolve(), { once: true })
          return
        }
        const script = document.createElement('script')
        script.src = 'https://embed.twitch.tv/embed/v1.js'
        script.onload = () => resolve()
        document.head.appendChild(script)
      })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let embed: any = null

    loadTwitchScript().then(() => {
      if (!containerRef.current) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const TwitchAPI = (window as any).Twitch
      embed = new TwitchAPI.Embed(containerRef.current, {
        width: '100%',
        height: '100%',
        channel,
        parent: [hostname],
        autoplay: true,
        muted: false,
        layout: 'video',
      })
      embed!.addEventListener(TwitchAPI.Embed.VIDEO_READY, () => {
        const player = embed!.getPlayer()
        player.setMuted(false)
        player.setVolume(1)
        player.play()
        const keepAlive = setInterval(() => {
          try {
            player.setMuted(false)
            player.setVolume(1)
            player.play()
          } catch {
            // no-op
          }
        }, 3000)
        ;(embed as { __keepAlive?: ReturnType<typeof setInterval> }).__keepAlive = keepAlive
      })
    })

    const onVisibility = () => {
      try {
        const player = embed?.getPlayer?.()
        player?.setMuted(false)
        player?.setVolume(1)
        player?.play()
      } catch {
        // ignore
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      const keepAlive = (embed as { __keepAlive?: ReturnType<typeof setInterval> } | null)?.__keepAlive
      if (keepAlive) clearInterval(keepAlive)
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
  }, [channel, hostname])

  return <div ref={containerRef} className="w-full h-full" />
}

/* ── Stream renderer ── */
function StreamEmbed({ streamUrl, hostname }: { streamUrl: string; hostname: string }) {
  if (!streamUrl) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#050507] gap-4">
        <svg viewBox="0 0 120 40" className="h-10 w-auto fill-white/15" xmlns="http://www.w3.org/2000/svg">
          <text x="0" y="32" fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="38" letterSpacing="2">CSGN</text>
        </svg>
        <p className="text-white/25 font-mono text-xs tracking-widest uppercase">No Stream Active</p>
      </div>
    )
  }

  const stream = detectStream(streamUrl)

  if (stream?.type === 'youtube') {
    return <YouTubePlayer videoId={stream.id} />
  }

  const fallbackChannel = detectStream(DEFAULT_TWITCH_STREAM)?.id || 'csgnet'
  const channel = stream?.id || fallbackChannel
  return <TwitchPlayer channel={channel} hostname={hostname} />
}

/* ── Page ── */
export default function Player() {
  const { profile, loading } = useAuth()
  const hostname = useMemo(() => (typeof window !== 'undefined' ? window.location.hostname : 'localhost'), [])

  const [currentSlot, setCurrentSlot] = useState<Slot | null>(null)
  // playerOverride is a separate Firestore key so it doesn't clash with the Watch page's output override
  const [playerOverride, setPlayerOverride] = useState<string | null>(null)

  // Subscribe to optional per-player override (config/playerFeed)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'playerFeed'), (snap) => {
      setPlayerOverride(snap.exists() ? (snap.data().url || null) : null)
    }, () => setPlayerOverride(null))
    return unsub
  }, [])

  // Subscribe to current live slot
  useEffect(() => {
    const unsub = subscribeToCurrentSlot((slot) => setCurrentSlot(slot))
    return unsub
  }, [])

  if (loading) {
    return (
      <div className="w-screen h-screen bg-[#050507] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!profile || profile.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  // Show the slot's raw Twitch/YouTube stream — this is what OBS captures
  const streamUrl = playerOverride ?? currentSlot?.streamUrl ?? DEFAULT_TWITCH_STREAM
  const slotLabel = currentSlot ? formatESTRange(currentSlot) : null

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative">
      <StreamEmbed streamUrl={streamUrl} hostname={hostname} />

      {/* Minimal HUD — bottom-left, non-intrusive for OBS crop */}
      <div className="absolute bottom-3 left-3 z-10 pointer-events-none select-none">
        <div className="flex flex-col gap-0.5 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/[0.08]">
          <span className="text-[9px] font-mono text-white/30 uppercase tracking-[0.2em]">CSGN /player</span>
          {currentSlot?.assignedName && (
            <span className="text-xs font-bold text-white/60 leading-none">{currentSlot.assignedName}</span>
          )}
          {slotLabel && (
            <span className="text-[9px] font-mono text-white/30 leading-none">{slotLabel}</span>
          )}
          {!currentSlot && (
            <span className="text-[9px] font-mono text-white/25 leading-none">No slot active — defaulting to /csgnet</span>
          )}
        </div>
      </div>
    </div>
  )
}
