import { useEffect, useMemo, useState } from 'react'
import { onSnapshot, doc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { detectStream } from '@/lib/player'

const DEFAULT_TWITCH_STREAM = 'https://www.twitch.tv/csgnet'

type CurrentBroadcast = { streamUrl?: string; source?: string; slotId?: string | null }

function buildEmbedSrc(streamUrl: string, hostname: string): string {
  const stream = detectStream(streamUrl) ?? detectStream(DEFAULT_TWITCH_STREAM)!
  if (stream.type === 'youtube') {
    const params = new URLSearchParams({ autoplay: '1', mute: '0', controls: '0', rel: '0', modestbranding: '1', iv_load_policy: '3', disablekb: '1', playsinline: '1' })
    return `https://www.youtube-nocookie.com/embed/${stream.id}?${params.toString()}`
  }
  const params = new URLSearchParams({ channel: stream.id, parent: hostname, autoplay: 'true', muted: 'false', controls: 'false' })
  return `https://player.twitch.tv/?${params.toString()}`
}

export default function Player() {
  const hostname = useMemo(() => (typeof window !== 'undefined' ? window.location.hostname : 'localhost'), [])
  const [currentBroadcast, setCurrentBroadcast] = useState<CurrentBroadcast | null>(null)

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'public', 'currentBroadcast'), (snap) => {
      setCurrentBroadcast(snap.exists() ? (snap.data() as CurrentBroadcast) : null)
    }, () => setCurrentBroadcast(null))
    return unsub
  }, [])

  const src = buildEmbedSrc(currentBroadcast?.streamUrl || DEFAULT_TWITCH_STREAM, hostname)

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <iframe
        key={src}
        src={src}
        title="CSGN /player"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowFullScreen
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, background: '#000' }}
      />
    </div>
  )
}
