import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { Activity, BarChart3, Radio, ShieldCheck, Sparkles, Trophy } from 'lucide-react'
import { db } from '@/config/firebase'
import { CSGN_30, DEFAULT_AUTOPILOT, DEMO_PACKAGE, formatClock, isPackageFresh, segmentAt, wheelPosition, type AnchorPackage, type AutoPilotConfig } from '@/lib/autopilot'

const scoreCards = [
  { league: 'NBA', away: 'BOS', home: 'NYK', awayScore: '—', homeScore: '—', state: 'DATA FEED' },
  { league: 'NFL', away: 'DAL', home: 'PHI', awayScore: '—', homeScore: '—', state: 'UPCOMING' },
  { league: 'MLB', away: 'LAD', home: 'NYY', awayScore: '—', homeScore: '—', state: 'SCHEDULE' },
]

function AnchorDesk({ item, demoVoice }: { item: AnchorPackage; demoVoice: boolean }) {
  const [turnIndex, setTurnIndex] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)
  const turn = item.turns[turnIndex % item.turns.length]

  useEffect(() => {
    if (turn.audioUrl && audioRef.current) {
      audioRef.current.load()
      void audioRef.current.play().catch(() => {})
      return
    }
    if (!demoVoice || !('speechSynthesis' in window)) return
    const utterance = new SpeechSynthesisUtterance(turn.text)
    const voices = window.speechSynthesis.getVoices()
    const candidates = voices.filter((voice) => voice.lang.startsWith('en'))
    utterance.voice = candidates[turn.anchor === 'A' ? 0 : Math.min(1, candidates.length - 1)] ?? null
    utterance.rate = turn.anchor === 'A' ? 1.02 : 0.96
    utterance.onend = () => setTurnIndex((index) => (index + 1) % item.turns.length)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    return () => window.speechSynthesis.cancel()
  }, [demoVoice, item.turns.length, turn.anchor, turn.audioUrl, turn.text])

  return <div className="anchor-desk">
    <div className={`anchor-card ${turn.anchor === 'A' ? 'active' : ''}`}>
      <div className="anchor-card__portrait"><span>CS</span><i /></div><b>ANCHOR A</b><small>FOUNDER COMMENTARY</small>
    </div>
    <div className="anchor-desk__script">
      <span>{item.sourceLabel}</span><strong>{item.title}</strong><p>{turn.text}</p>
      <div className="anchor-desk__beats">{item.turns.map((_, index) => <i key={index} className={index === turnIndex ? 'active' : ''} />)}</div>
    </div>
    <div className={`anchor-card ${turn.anchor === 'B' ? 'active' : ''}`}>
      <div className="anchor-card__portrait anchor-card__portrait--b"><span>GN</span><i /></div><b>ANCHOR B</b><small>NEWS + DATA</small>
    </div>
    {turn.audioUrl && <audio ref={audioRef} src={turn.audioUrl} onEnded={() => setTurnIndex((index) => (index + 1) % item.turns.length)} />}
  </div>
}

export default function AutoPlayer() {
  const query = useMemo(() => new URLSearchParams(window.location.search), [])
  const preview = query.has('preview')
  const demoVoice = query.has('demoVoice')
  const forcedSegment = query.get('segment')
  const [now, setNow] = useState(() => new Date())
  const [config, setConfig] = useState<AutoPilotConfig>(DEFAULT_AUTOPILOT)
  const [networkMode, setNetworkMode] = useState<{ mode?: string; who?: string | null }>({})
  const [broadcastUrl, setBroadcastUrl] = useState('')

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => onSnapshot(doc(db, 'config', 'autopilot'), (snap) => {
    if (snap.exists()) setConfig({ ...DEFAULT_AUTOPILOT, ...snap.data() } as AutoPilotConfig)
  }, () => {}), [])
  useEffect(() => onSnapshot(doc(db, 'public', 'channelMode'), (snap) => {
    setNetworkMode(snap.exists() ? snap.data() : {})
  }, () => {}), [])
  useEffect(() => onSnapshot(doc(db, 'public', 'currentBroadcast'), (snap) => {
    setBroadcastUrl(snap.exists() ? String(snap.data().streamUrl || '') : '')
  }, () => {}), [])

  const position = wheelPosition(now)
  const scheduledSegment = segmentAt(position)
  const segment = CSGN_30.find((item) => item.id === forcedSegment)
    ?? (config.hold ? CSGN_30.find((item) => item.id === config.holdSegment) : undefined)
    ?? scheduledSegment
  const held = Boolean(config.hold && config.holdSegment)
  const remaining = segment.start + segment.duration - position
  const progress = forcedSegment ? 36 : held ? 100 : Math.min(100, Math.max(0, ((position - segment.start) / segment.duration) * 100))
  const mode = query.has('safe') ? 'SAFE' : config.mode
  const anchorPackage = config.activePackage && isPackageFresh(config.activePackage, now) ? config.activePackage : DEMO_PACKAGE
  const twitch = broadcastUrl.match(/twitch\.tv\/([^/?#]+)/i)?.[1]?.replace(/^@/, '')
  const streamTakeover = networkMode.mode === 'stream' && twitch
  const twitchSrc = streamTakeover
    ? `https://player.twitch.tv/?channel=${encodeURIComponent(twitch)}&parent=${encodeURIComponent(window.location.hostname)}&autoplay=true&muted=false`
    : ''
  const clock = now.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })
  const onAirMode = streamTakeover ? 'STREAM TAKEOVER' : mode

  return (
    <main className="autoplayer" style={{ '--segment': segment.accent } as CSSProperties}>
      <div className="autoplayer__grid" />
      {streamTakeover && <div className="autoplayer__takeover"><iframe title={`${networkMode.who || twitch} live on CSGN`} src={twitchSrc} allow="autoplay; fullscreen" /><div><span>LIVE TAKEOVER</span><strong>{networkMode.who || twitch}</strong></div></div>}
      <header className="autoplayer__top">
        <div className="autoplayer__brand"><span>CSGN</span><b>NETWORK</b></div>
        <div className="autoplayer__mode"><i />{onAirMode}</div>
        <div className="autoplayer__clock"><strong>{clock}</strong><span>ET · {preview ? 'REHEARSAL' : 'LIVE'}</span></div>
      </header>

      <section className="autoplayer__stage">
        <div className="autoplayer__copy">
          <p className="autoplayer__eyebrow"><Sparkles /> {segment.eyebrow}</p>
          <h1>{segment.name}</h1>
          <h2>{config.headline}</h2>
          <p className="autoplayer__analysis">{config.analysis}</p>
          <div className="autoplayer__source"><ShieldCheck /> OPERATOR-APPROVED RUNDOWN · AS OF {clock} ET</div>
        </div>

        <div className="autoplayer__visual">
          {segment.id === 'scores' ? (
            <div className="score-stack">{scoreCards.map((game) => <div className="score-card" key={game.league}><b>{game.league}</b><span>{game.away}</span><em>{game.awayScore}</em><span>{game.home}</span><em>{game.homeScore}</em><small>{game.state}</small></div>)}</div>
          ) : segment.id === 'markets' || segment.id === 'numbers' ? (
            <div className="market-board"><BarChart3 /><span>LIVE DATA MODULE</span><strong>BTC · ETH · SOL</strong><p>Prices remain in the permanent lower-third.</p><div className="market-bars"><i /><i /><i /><i /><i /><i /></div></div>
          ) : segment.id === 'community' ? (
            <div className="community-frame"><Radio /><span>COMMUNITY PICK</span><strong>Approved clips enter here</strong><p>Rights checked · 15–45 seconds · return to AUTO</p></div>
          ) : segment.id === 'lead' || segment.id === 'board' || segment.id === 'film' || segment.id === 'finish' ? (
            <AnchorDesk key={`${segment.id}-${anchorPackage.id}`} item={anchorPackage} demoVoice={demoVoice} />
          ) : (
            <div className="orb"><Activity /><span>CSGN INTELLIGENCE</span><b>LIVE</b></div>
          )}
        </div>
      </section>

      <footer className="autoplayer__rundown">
        <div className="autoplayer__progress"><i style={{ width: `${progress}%` }} /></div>
        <div className="autoplayer__now"><Trophy /><span>NOW</span><strong>{segment.name}</strong><b>{forcedSegment ? 'PREVIEW' : held ? 'HOLD' : formatClock(remaining)}</b></div>
        <div className="autoplayer__next"><span>NEXT</span><strong>{CSGN_30[(CSGN_30.indexOf(segment) + 1) % CSGN_30.length].name}</strong><small>{config.nextUpdate}</small></div>
      </footer>
    </main>
  )
}
