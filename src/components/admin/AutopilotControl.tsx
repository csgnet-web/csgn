import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { ExternalLink, Pause, Play, Radio, ShieldAlert } from 'lucide-react'
import { db } from '@/config/firebase'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CSGN_30, DEFAULT_AUTOPILOT, segmentAt, wheelPosition, type AutoPilotConfig, type NetworkMode } from '@/lib/autopilot'

export default function AutopilotControl() {
  const [config, setConfig] = useState<AutoPilotConfig>(DEFAULT_AUTOPILOT)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => onSnapshot(doc(db, 'config', 'autopilot'), (snap) => {
    if (snap.exists()) setConfig({ ...DEFAULT_AUTOPILOT, ...snap.data() } as AutoPilotConfig)
  }), [])

  const save = async (patch: Partial<AutoPilotConfig>) => {
    setBusy(true); setMessage('')
    const next = { ...config, ...patch, updatedAt: new Date().toISOString() }
    await setDoc(doc(db, 'config', 'autopilot'), next, { merge: true })
    setConfig(next); setBusy(false); setMessage('Saved to air.')
  }
  const field = 'w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 text-sm text-white outline-none focus:border-primary-500/60'
  return <div className="space-y-5">
    <Card hover={false} className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-[11px] tracking-[.22em] text-primary-400 font-bold">AUTONOMOUS PLAYOUT</p><h2 className="text-2xl font-display font-bold text-white mt-1">The CSGN 30</h2><p className="text-sm text-gray-400 mt-1">One clock, one rundown, one safe fallback. OBS only captures the output.</p></div>
        <a href="/autoplayer?preview=1" target="_blank" rel="noreferrer" className="text-sm text-primary-300 flex items-center gap-2">Open rehearsal output <ExternalLink className="w-4 h-4" /></a>
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
  </div>
}
