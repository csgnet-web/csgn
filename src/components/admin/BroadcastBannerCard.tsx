import { useEffect, useRef, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { Timer } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { db } from '@/config/firebase'
import {
  normalizeBanner, resolveBanner, DEFAULT_BANNER_LINES, type BannerMode,
} from '@/lib/broadcastBanner'

/**
 * THE STRIP — the headline, clock and rotating lines beside LIVE on /watch.
 *
 * Writes one admin-only document, `config/broadcastBanner`. The strip used to be
 * four constants in Watch.tsx, so announcing anything — or putting a clock on it
 * — meant a deploy. Same pattern as the ticker chyron: one Firestore write
 * changes what's on screen, everywhere, immediately.
 */

const MODES: Array<{ id: BannerMode; label: string; hint: string }> = [
  { id: 'auto', label: 'On', hint: 'Show the headline and clock set below' },
  { id: 'manual', label: 'On (manual)', hint: 'Same, and never auto-derived later' },
  { id: 'off', label: 'Off', hint: 'Fall back to the default network copy' },
]

/** `datetime-local` speaks local wall-clock with no zone; these convert to and
 *  from the ISO instant we actually store, so a countdown set at 8pm means 8pm
 *  on the operator's clock rather than 8pm UTC. */
function isoToLocalInput(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const d = new Date(t - new Date(t).getTimezoneOffset() * 60_000)
  return d.toISOString().slice(0, 16)
}
const localInputToIso = (value: string): string => {
  const t = Date.parse(value)
  return Number.isFinite(t) ? new Date(t).toISOString() : ''
}

export default function BroadcastBannerCard() {
  const seeded = useRef(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [mode, setMode] = useState<BannerMode>('auto')
  const [headline, setHeadline] = useState('')
  const [countdownLabel, setCountdownLabel] = useState('STARTS IN')
  const [countdownAt, setCountdownAt] = useState('')
  const [linesText, setLinesText] = useState('')
  const [href, setHref] = useState('')

  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'broadcastBanner'), (snap) => {
      // Seed the form once, then leave it alone — re-seeding on every snapshot
      // would wipe out what the operator is mid-way through typing.
      if (seeded.current) return
      seeded.current = true
      const b = normalizeBanner(snap.exists() ? snap.data() : null)
      setMode(b.mode)
      setHeadline(b.headline)
      setCountdownLabel(b.countdownLabel)
      setCountdownAt(isoToLocalInput(b.countdownTo))
      setLinesText(b.lines.join('\n'))
      setHref(b.href)
    }, () => {})
  }, [])

  const flash = (ok: string) => { setMsg(ok); setErr(null); setTimeout(() => setMsg(null), 2500) }
  const fail = (e: unknown) => { setErr(e instanceof Error ? e.message : 'Save failed.'); setMsg(null) }

  const saveBanner = async () => {
    setBusy(true)
    try {
      const lines = linesText.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 8)
      await setDoc(doc(db, 'config', 'broadcastBanner'), {
        mode, headline: headline.trim(), countdownLabel: countdownLabel.trim(),
        countdownTo: localInputToIso(countdownAt),
        lines: lines.length ? lines : [...DEFAULT_BANNER_LINES],
        href: href.trim(),
        updatedAt: new Date().toISOString(),
      }, { merge: true })
      flash('Banner updated — /watch is already showing it.')
    } catch (e) { fail(e) } finally { setBusy(false) }
  }

  const clearCountdown = async () => {
    setCountdownAt('')
    setBusy(true)
    try {
      await setDoc(doc(db, 'config', 'broadcastBanner'), { countdownTo: '', updatedAt: new Date().toISOString() }, { merge: true })
      flash('Countdown cleared — the strip is back to rotating copy.')
    } catch (e) { fail(e) } finally { setBusy(false) }
  }

  // Exactly what /watch will render, from the same pure resolver.
  const preview = resolveBanner(
    normalizeBanner({
      mode, headline, countdownLabel,
      countdownTo: localInputToIso(countdownAt),
      lines: linesText.split('\n').map((l) => l.trim()).filter(Boolean),
      href,
    }),
    nowMs,
    DEFAULT_BANNER_LINES,
  )

  const field = 'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary-500/50'
  const label = 'block text-[11px] uppercase tracking-[0.14em] text-gray-500 mb-1.5'
  const pill = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
      active ? 'bg-primary-500/20 border-primary-500/40 text-white' : 'bg-white/[0.03] border-white/10 text-gray-400 hover:text-white'
    }`

  return (
    <Card hover={false} className="p-5 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Timer className="w-4 h-4 text-primary-400" /> Broadcast Banner
        </h3>
        {msg && <span className="text-xs text-emerald-300">{msg}</span>}
        {err && <span className="text-xs text-red-300">{err}</span>}
      </div>

      {/* Live preview of the /watch strip */}
      <div>
        <p className={label}>Preview — the strip on /watch</p>
        <div className="rounded-lg border border-white/10 bg-gradient-to-r from-red-600 to-red-500 px-3 py-2 flex items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-white font-black tracking-[0.25em] text-sm uppercase">LIVE</span>
          </div>
          <div className="flex-1 min-w-0 flex items-center justify-end gap-2 text-right">
            {preview.kind === 'countdown' && preview.countdown ? (
              <>
                <span className="truncate text-[10px] sm:text-xs font-black uppercase tracking-[0.12em] text-white/85">{preview.headline}</span>
                <span className="hidden sm:inline shrink-0 text-[10px] uppercase tracking-[0.16em] text-white/50">{preview.label}</span>
                <span className={`shrink-0 font-mono font-black tabular-nums text-sm ${preview.countdown.urgent ? 'text-amber-300' : 'text-white'}`}>
                  {preview.countdown.display}
                </span>
              </>
            ) : (
              <span className="truncate font-mono text-[11px] uppercase tracking-[0.08em] text-white/85">
                {preview.lines?.[0]}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <p className={label}>Strip mode</p>
          <div className="flex flex-wrap gap-2">
            {MODES.map(({ id, label: l, hint }) => (
              <button key={id} type="button" onClick={() => setMode(id)} className={pill(mode === id)} title={hint}>{l}</button>
            ))}
          </div>
          <p className="text-[11px] text-gray-600 mt-1.5">{MODES.find((m) => m.id === mode)?.hint}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="bb-headline">Headline</label>
            <input id="bb-headline" className={field} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="TONIGHT — OPEN STAGE" maxLength={120} />
          </div>
          <div>
            <label className={label} htmlFor="bb-cdlabel">Countdown label</label>
            <input id="bb-cdlabel" className={field} value={countdownLabel} onChange={(e) => setCountdownLabel(e.target.value)} placeholder="STARTS IN" maxLength={24} />
          </div>
          <div>
            <label className={label} htmlFor="bb-cdat">Counts down to (your local time)</label>
            <input id="bb-cdat" type="datetime-local" className={field} value={countdownAt} onChange={(e) => setCountdownAt(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="bb-href">Link (optional)</label>
            <input id="bb-href" className={field} value={href} onChange={(e) => setHref(e.target.value)} placeholder="/schedule" maxLength={200} />
          </div>
        </div>

        <div>
          <label className={label} htmlFor="bb-lines">Rotating lines — one per line, shown when no countdown is running</label>
          <textarea id="bb-lines" rows={4} className={`${field} font-mono text-xs`} value={linesText} onChange={(e) => setLinesText(e.target.value)} placeholder={DEFAULT_BANNER_LINES.join('\n')} />
          <p className="text-[11px] text-gray-600 mt-1">The strip is a 4-face prism. Fewer than four lines cycle to fill it.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" onClick={() => void saveBanner()} isLoading={busy}>Save strip</Button>
          <Button variant="secondary" size="sm" onClick={() => void clearCountdown()} disabled={busy || !countdownAt}>Clear countdown</Button>
        </div>
      </div>
    </Card>
  )
}
