import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { Activity, BarChart3, Radio, ShieldCheck, Sparkles, Trophy } from 'lucide-react'
import { db } from '@/config/firebase'
import { CSGN_30, DEFAULT_AUTOPILOT, formatClock, segmentAt, wheelPosition, type AutoPilotConfig } from '@/lib/autopilot'

const scoreCards = [
  { league: 'NBA', away: 'BOS', home: 'NYK', awayScore: '—', homeScore: '—', state: 'DATA FEED' },
  { league: 'NFL', away: 'DAL', home: 'PHI', awayScore: '—', homeScore: '—', state: 'UPCOMING' },
  { league: 'MLB', away: 'LAD', home: 'NYY', awayScore: '—', homeScore: '—', state: 'SCHEDULE' },
]

export default function AutoPlayer() {
  const query = useMemo(() => new URLSearchParams(window.location.search), [])
  const preview = query.has('preview')
  const forcedSegment = query.get('segment')
  const [now, setNow] = useState(() => new Date())
  const [config, setConfig] = useState<AutoPilotConfig>(DEFAULT_AUTOPILOT)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => onSnapshot(doc(db, 'config', 'autopilot'), (snap) => {
    if (snap.exists()) setConfig({ ...DEFAULT_AUTOPILOT, ...snap.data() } as AutoPilotConfig)
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
  const clock = now.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })

  return (
    <main className="autoplayer" style={{ '--segment': segment.accent } as CSSProperties}>
      <div className="autoplayer__grid" />
      <header className="autoplayer__top">
        <div className="autoplayer__brand"><span>CSGN</span><b>NETWORK</b></div>
        <div className="autoplayer__mode"><i />{mode}</div>
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
          ) : (
            <div className="orb"><Activity /><span>CSGN INTELLIGENCE</span><b>{segment.id === 'film' ? '01' : 'LIVE'}</b></div>
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
