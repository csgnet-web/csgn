import { useState } from 'react'
import { CheckCircle2, ExternalLink, MonitorPlay, Trash2, XCircle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'
import { ON_AIR_LOOKS, ON_AIR_STYLES, ON_AIR_MOTIONS, clipLength } from '@/lib/clipEmbed'

/**
 * REHEARSE THE REEL — get the clip factory on screen before anybody has
 * connected a TikTok account.
 *
 * Two rehearsals, and the difference is worth being explicit about on the
 * screen itself, because an operator who confuses them will draw the wrong
 * conclusion from a green result:
 *
 *   `/player?rehearse=run` — the LOOK. Fixed demo footage, every card shape,
 *   every hand-over, on a loop. Proves the broadcast package. Says nothing
 *   about your links.
 *
 *   This card — the PIPELINE. Your links, through the real parser, the real
 *   metadata lookup and the real scheduler. Proves that what you intend to put
 *   on air actually parses, embeds and runs the length you think it does.
 *
 * It writes one document that only `/player?rehearse=live` reads, so it is safe
 * to run while the channel is on air.
 */

type Outcome = {
  url: string
  ok: boolean
  error?: string
  platform?: string
  canonicalUrl?: string
  measured?: boolean
  sourceSeconds?: number | null
}

const field = 'w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/25'
const label = 'block text-[11px] uppercase tracking-[0.14em] text-gray-500 mb-1.5'

export default function RehearsalCard() {
  const [raw, setRaw] = useState('')
  const [username, setUsername] = useState('rehearsal')
  const [look, setLook] = useState('signal')
  const [style, setStyle] = useState('bar')
  const [motion, setMotion] = useState('cut')
  const [seconds, setSeconds] = useState('')
  const [busy, setBusy] = useState<'seed' | 'clear' | null>(null)
  const [error, setError] = useState('')
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null)
  const [built, setBuilt] = useState<{ items: number; totalSeconds: number } | null>(null)

  // One link per line is what a person pastes out of a notes app; commas and
  // spaces are what they paste out of a chat message. Accept all three rather
  // than telling somebody their perfectly good list is the wrong shape.
  const urls = raw.split(/[\s,]+/).map((u) => u.trim()).filter(Boolean)

  const run = async () => {
    setBusy('seed')
    setError('')
    try {
      const res = await api.rehearseReel({
        action: 'seed',
        urls,
        username: username.trim() || 'rehearsal',
        look,
        style,
        motion,
        seconds: Number(seconds) > 0 ? Math.floor(Number(seconds)) : undefined,
      })
      setOutcomes(res.urls)
      setBuilt(res.ok ? { items: res.items, totalSeconds: res.totalSeconds ?? 0 } : null)
      if (!res.ok) setError(res.reason || 'Nothing could be scheduled from those links.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the rehearsal.')
    }
    setBusy(null)
  }

  const clear = async () => {
    setBusy('clear')
    setError('')
    try {
      await api.rehearseReel({ action: 'clear' })
      setOutcomes(null)
      setBuilt(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not clear the rehearsal.')
    }
    setBusy(null)
  }

  return (
    <Card hover={false} className="p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 shrink-0 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center">
          <MonitorPlay className="w-4 h-4 text-primary-400" />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-bold text-white">Rehearse the reel</h3>
          <p className="mt-1 text-xs text-gray-400 leading-relaxed">
            Put your own links through the real parser and the real scheduler, with no member, no
            TikTok connection and no approval queue. Watch the result at{' '}
            <code className="text-primary-300">/player?rehearse=live</code> — the live reel is not touched.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <label className={label} htmlFor="rehearsal-urls">Clip links — one per line</label>
        <textarea
          id="rehearsal-urls"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={4}
          spellCheck={false}
          placeholder={'https://www.youtube.com/shorts/…\nhttps://www.tiktok.com/@handle/video/…\nhttps://www.instagram.com/reel/…'}
          className={`${field} font-mono text-xs leading-relaxed resize-y`}
        />
        <p className="mt-1.5 text-[11px] text-gray-600">
          {urls.length === 0 ? 'Up to 12 links.' : `${urls.length} link${urls.length === 1 ? '' : 's'} · up to 12`}
        </p>
      </div>

      {/* The member's card travels with every segment, so a rehearsal has to be
          able to wear a specific one — that is how you find out the ticker
          style collides with your own lower third before it does. */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className={label} htmlFor="rehearsal-handle">Handle</label>
          <input id="rehearsal-handle" value={username} onChange={(e) => setUsername(e.target.value)} className={field} />
        </div>
        <div>
          <label className={label} htmlFor="rehearsal-look">Look</label>
          <select id="rehearsal-look" value={look} onChange={(e) => setLook(e.target.value)} className={field}>
            {ON_AIR_LOOKS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="rehearsal-style">Shape</label>
          <select id="rehearsal-style" value={style} onChange={(e) => setStyle(e.target.value)} className={field}>
            {ON_AIR_STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="rehearsal-motion">Motion</label>
          <select id="rehearsal-motion" value={motion} onChange={(e) => setMotion(e.target.value)} className={field}>
            {ON_AIR_MOTIONS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="rehearsal-seconds">Seconds</label>
          <input
            id="rehearsal-seconds"
            value={seconds}
            onChange={(e) => setSeconds(e.target.value.replace(/[^0-9]/g, ''))}
            inputMode="numeric"
            placeholder="real"
            className={field}
          />
        </div>
      </div>
      <p className="mt-1.5 text-[11px] text-gray-600">
        Leave seconds blank to run each clip for however long the platform says it actually is — which
        also shows you which of your links came back measured rather than guessed.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={run} isLoading={busy === 'seed'} disabled={urls.length === 0 || busy !== null}>
          Build rehearsal
        </Button>
        <Button variant="secondary" onClick={clear} isLoading={busy === 'clear'} disabled={busy !== null} leftIcon={<Trash2 className="w-4 h-4" />}>
          Clear
        </Button>
        <a
          href="/player?rehearse=live&debug=1"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white"
        >
          Open the rehearsal <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {error && <p className="mt-4 text-xs text-red-300">{error}</p>}

      {built && (
        <p className="mt-4 text-xs text-emerald-300">
          {built.items} segment{built.items === 1 ? '' : 's'} laid down · {clipLength(built.totalSeconds)} of
          rehearsal footage. Point OBS at <code className="text-primary-300">/player?rehearse=live</code>.
        </p>
      )}

      {outcomes && outcomes.length > 0 && (
        <ul className="mt-4 space-y-2">
          {outcomes.map((o, i) => (
            <li key={`${o.url}-${i}`} className="flex items-start gap-2.5 text-xs">
              {o.ok
                ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-px" />
                : <XCircle className="w-4 h-4 shrink-0 text-red-400 mt-px" />}
              <span className="min-w-0">
                <span className="block truncate font-mono text-gray-400">{o.canonicalUrl || o.url}</span>
                <span className={o.ok ? 'text-gray-500' : 'text-red-300'}>
                  {o.ok
                    ? `${o.platform} · ${o.measured ? `${o.sourceSeconds}s measured` : 'length not published — using the house default'}`
                    : o.error}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
