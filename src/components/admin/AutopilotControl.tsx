import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { ExternalLink, Pause, Play, Radio, ShieldAlert, Users, Film } from 'lucide-react'
import { db } from '@/config/firebase'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CSGN_30, DEFAULT_AUTOPILOT, segmentAt, wheelPosition, type AutoPilotConfig, type NetworkMode } from '@/lib/autopilot'
import LiveNowTab from './LiveNowTab'
import ClipQueueTab from './ClipQueueTab'

export default function AutopilotControl() {
  const [config, setConfig] = useState<AutoPilotConfig>(DEFAULT_AUTOPILOT)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [anchorA, setAnchorA] = useState('You are watching the CSGN 30. Here is what matters right now.')
  const [anchorB, setAnchorB] = useState('I will bring the verified numbers, context, and what to watch next.')
  const [audioA, setAudioA] = useState('')
  const [audioB, setAudioB] = useState('')
  useEffect(() => onSnapshot(doc(db, 'config', 'autopilot'), (snap) => {
    if (snap.exists()) setConfig({ ...DEFAULT_AUTOPILOT, ...snap.data() } as AutoPilotConfig)
  }), [])

  const save = async (patch: Partial<AutoPilotConfig>) => {
    setBusy(true); setMessage('')
    const next = { ...config, ...patch, updatedAt: new Date().toISOString() }
    try {
      await setDoc(doc(db, 'config', 'autopilot'), next, { merge: true })
      setConfig(next); setMessage('Saved to air.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save to air.')
    } finally { setBusy(false) }
  }
  const field = 'w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 text-sm text-white outline-none focus:border-primary-500/60'
  const publishPackage = () => save({ activePackage: {
    id: `package-${Date.now()}`,
    title: config.headline,
    sourceLabel: 'CSGN EDITORIAL · OPERATOR APPROVED',
    freshUntil: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    turns: [
      { anchor: 'A' as const, text: anchorA.trim(), ...(audioA.trim() ? { audioUrl: audioA.trim() } : {}) },
      { anchor: 'B' as const, text: anchorB.trim(), ...(audioB.trim() ? { audioUrl: audioB.trim() } : {}) },
    ].filter((turn) => turn.text),
  } })
  return <div className="space-y-5">
    <Card hover={false} className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-[11px] tracking-[.22em] text-primary-400 font-bold">AUTONOMOUS PLAYOUT</p><h2 className="text-2xl font-display font-bold text-white mt-1">The CSGN 30</h2><p className="text-sm text-gray-400 mt-1">One clock, one rundown, one safe fallback. OBS only captures the output.</p></div>
        <a href="/autoplayer?preview=1&demoVoice=1&segment=lead" target="_blank" rel="noreferrer" className="text-sm text-primary-300 flex items-center gap-2">Open audible demo <ExternalLink className="w-4 h-4" /></a>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-5">
        {(['AUTO', 'COMMUNITY', 'OWNER_LIVE', 'SAFE'] as NetworkMode[]).map((mode) => <button key={mode} onClick={() => void save({ mode })} className={`rounded-xl border p-3 text-xs font-bold tracking-wider cursor-pointer ${config.mode === mode ? 'border-primary-500 bg-primary-500/15 text-white' : 'border-white/10 text-gray-400 hover:text-white'}`}>{mode}</button>)}
      </div>
      <div className="flex gap-2 mt-3">
        <Button onClick={() => void save({ enabled: true, hold: false, mode: 'AUTO' })} isLoading={busy} leftIcon={<Play className="w-4 h-4" />}>Return Auto</Button>
        <Button variant="secondary" onClick={() => void save(config.hold ? { hold: false, holdSegment: '' } : { hold: true, holdSegment: segmentAt(wheelPosition(new Date())).id })} leftIcon={<Pause className="w-4 h-4" />}>{config.hold ? 'Release next' : 'Hold next'}</Button>
        <Button variant="secondary" onClick={() => void save({ mode: 'SAFE' })} leftIcon={<ShieldAlert className="w-4 h-4" />}>Take Safe</Button>
      </div>
    </Card>
    <div className="grid lg:grid-cols-[1fr_.9fr] gap-5">
      <Card hover={false} className="p-5 space-y-4">
        <div className="flex items-center gap-2"><Radio className="w-5 h-5 text-primary-400"/><h3 className="font-semibold">Current editorial frame</h3></div>
        <label className="block text-xs text-gray-400">Lead headline<input className={`${field} mt-1`} maxLength={100} value={config.headline} onChange={(e) => setConfig({ ...config, headline: e.target.value })}/></label>
        <label className="block text-xs text-gray-400">Analysis / context<textarea className={`${field} mt-1 min-h-24`} maxLength={220} value={config.analysis} onChange={(e) => setConfig({ ...config, analysis: e.target.value })}/></label>
        <label className="block text-xs text-gray-400">Next-update promise<input className={`${field} mt-1`} maxLength={80} value={config.nextUpdate} onChange={(e) => setConfig({ ...config, nextUpdate: e.target.value })}/></label>
        <Button onClick={() => void save(config)} isLoading={busy}>Publish rundown frame</Button>{message && <span className="text-xs text-emerald-300 ml-3">{message}</span>}
      </Card>
      <Card hover={false} className="p-5"><h3 className="font-semibold mb-3">30-minute wheel</h3><div className="space-y-1">{CSGN_30.map((s) => <a href={`/autoplayer?preview=1&segment=${s.id}`} target="_blank" rel="noreferrer" key={s.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/5"><i className="w-2 h-2 rounded-full" style={{background:s.accent}}/><span className="font-mono text-xs text-gray-500 w-11">{Math.floor(s.start/60)}:{String(s.start%60).padStart(2,'0')}</span><strong className="text-sm flex-1">{s.name}</strong><span className="text-xs text-gray-500">{Math.round(s.duration/60)}m</span></a>)}</div></Card>
    </div>
    <Card hover={false} className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4"><div><h3 className="font-semibold text-white">Two-anchor package</h3><p className="text-xs text-gray-500 mt-1">Paste generated voice files when ready. Without them, the audible demo uses local browser voices.</p></div><span className="text-xs font-mono text-primary-300">docs/autonomy-runbook.md</span></div>
      <div className="grid lg:grid-cols-2 gap-4">
        <label className="text-xs text-gray-400">Anchor A · founder commentary<textarea className={`${field} mt-1 min-h-28`} value={anchorA} onChange={(event) => setAnchorA(event.target.value)} /><input className={`${field} mt-2`} type="url" value={audioA} onChange={(event) => setAudioA(event.target.value)} placeholder="Optional hosted MP3/WAV URL" /></label>
        <label className="text-xs text-gray-400">Anchor B · news and data<textarea className={`${field} mt-1 min-h-28`} value={anchorB} onChange={(event) => setAnchorB(event.target.value)} /><input className={`${field} mt-2`} type="url" value={audioB} onChange={(event) => setAudioB(event.target.value)} placeholder="Optional hosted MP3/WAV URL" /></label>
      </div>
      <div className="mt-4 flex items-center gap-3"><Button onClick={() => void publishPackage()} isLoading={busy} disabled={!anchorA.trim() || !anchorB.trim()}>Publish six-hour package</Button><span className="text-xs text-gray-500">Expires automatically; stale packages fall back to the labeled demo.</span></div>
    </Card>
    <details className="group rounded-2xl border border-white/[0.08] bg-white/[0.02]" open>
      <summary className="cursor-pointer list-none p-5 flex items-center gap-3"><Film className="w-5 h-5 text-pink-400"/><div><strong className="text-sm">TikTok and ad breaks</strong><p className="text-xs text-gray-500">The existing connected-account review flow—no second sponsorship system.</p></div></summary><div className="px-5 pb-5"><ClipQueueTab /></div>
    </details>
    <details className="group rounded-2xl border border-white/[0.08] bg-white/[0.02]">
      <summary className="cursor-pointer list-none p-5 flex items-center gap-3"><Users className="w-5 h-5 text-cyan-400"/><div><strong className="text-sm">Twitch and owner takeovers</strong><p className="text-xs text-gray-500">Put a connected streamer on air or take the channel yourself.</p></div></summary><div className="px-5 pb-5"><LiveNowTab /></div>
    </details>
  </div>
}
