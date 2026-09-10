import { useCallback, useEffect, useState } from 'react'
import { Bot, CheckCircle2, Play, RefreshCw, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { api, type AutoRailStatus, type AutoRailRun } from '@/lib/api'

/**
 * THE AUTO-WRITER'S CONTROLS.
 *
 * A thing that writes on a live broadcast every two hours, unsupervised, and
 * the operator's whole relationship with it is this panel. Four affordances,
 * and the order is the argument:
 *
 *   1. What is wired up. "It is not running" has three different causes (no
 *      API key, switched off, or X unconfigured and quietly falling back), and
 *      an operator should not have to open Netlify's environment page to tell
 *      them apart.
 *   2. TRY IT — write lines and show them without putting them on air. This is
 *      the important one: it is the difference between switching on a writer
 *      you have read and one you have not.
 *   3. Run it now.
 *   4. Off.
 *
 * The last run's lines are shown verbatim, including how many were REJECTED,
 * because a model quietly failing the same check every run is a prompt problem
 * and this is the only place it becomes visible.
 */
export default function AutoRailCard() {
  const [status, setStatus] = useState<AutoRailStatus | null>(null)
  const [run, setRun] = useState<AutoRailRun | null>(null)
  const [busy, setBusy] = useState<'status' | 'dry' | 'run' | 'toggle' | null>(null)
  const [refreshing, setRefreshing] = useState(true)
  const [error, setError] = useState('')

  // No setState before the first await: the initial load runs from an effect,
  // and a synchronous state write there cascades a render for nothing. The
  // spinner is seeded true instead.
  const load = useCallback(async () => {
    try {
      const res = await api.autoRail({ action: 'status' })
      setStatus(res.config)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the writer.')
    }
    setRefreshing(false)
  }, [])

  useEffect(() => {
    ;(async () => { await load() })()
  }, [load])

  const refresh = () => {
    setRefreshing(true)
    void load()
  }

  const act = async (action: 'dry' | 'run' | 'toggle', enabled?: boolean) => {
    setBusy(action)
    setError('')
    try {
      const res = await api.autoRail({ action, enabled })
      setStatus(res.config)
      if (res.result) setRun(res.result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.')
    }
    setBusy(null)
  }

  const enabled = status?.enabled !== false
  const ready = status?.hasModelKey === true

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="w-8 h-8 shrink-0 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center">
          <Bot className="w-4 h-4 text-primary-400" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">Written automatically, every two hours</p>
          <p className="mt-1 text-xs text-gray-400 leading-relaxed">
            Reads what crypto is talking about and writes up to four lines. Holder headlines are
            never written over — the writer only fills what is left. Every line is checked in code
            before it can reach the broadcast: no links, no handles, nothing that reads as advice.
          </p>
        </div>
      </div>

      {/* What is actually wired up. Three different causes of "it is not
          running", named separately. */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <Wire label="Model" ok={ready} okText={status?.model || 'ready'} badText="ANTHROPIC_API_KEY not set" />
        <Wire
          label="Source"
          ok={status?.hasX === true}
          okText="X timeline"
          badText="Meme 100 board (X not configured)"
          neutral
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" isLoading={busy === 'dry'} disabled={!ready || busy !== null} onClick={() => act('dry')}>
          Try it — don't air it
        </Button>
        <Button size="sm" isLoading={busy === 'run'} disabled={!ready || busy !== null} leftIcon={<Play className="w-3.5 h-3.5" />} onClick={() => act('run')}>
          Write the rail now
        </Button>
        <Button
          size="sm"
          variant={enabled ? 'ghost' : 'gold'}
          isLoading={busy === 'toggle'}
          disabled={busy !== null}
          onClick={() => act('toggle', !enabled)}
        >
          {enabled ? 'Switch off' : 'Switch on'}
        </Button>
        <button
          type="button"
          onClick={refresh}
          aria-label="Refresh"
          className="ml-auto text-gray-500 hover:text-white cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {!enabled && (
        <p className="text-xs text-amber-300">
          Switched off. The rail keeps whatever holders put on it, and nothing is written or spent.
        </p>
      )}

      {error && <p className="text-xs text-red-300">{error}</p>}

      {status?.lastRunAt && (
        <p className="text-[11px] text-gray-500">
          Last run {new Date(status.lastRunAt).toLocaleString()} · {status.lastAccepted} aired
          {status.lastRejected > 0 && <span className="text-amber-300"> · {status.lastRejected} rejected</span>}
          {status.lastSource && ` · from ${status.lastSource === 'x' ? 'X' : status.lastSource}`}
          {status.lastError && <span className="text-red-300"> · {status.lastError}</span>}
        </p>
      )}

      {/* Exactly what it wrote, and exactly what was thrown out. */}
      {run && (
        <div className="space-y-1.5 pt-1 border-t border-white/[0.06]">
          <p className="text-[11px] uppercase tracking-[0.15em] text-gray-500">
            {run.skipped === 'dry_run' ? 'Would air — not on the broadcast' : 'Written'}
          </p>
          {(run.accepted ?? []).length === 0 && (
            <p className="text-xs text-gray-500">Nothing survived. {run.error}</p>
          )}
          {(run.accepted ?? []).map((line, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-white/[0.03] border border-white/[0.06] px-2.5 py-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
              <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-primary-200 bg-primary-500/15 border border-primary-500/30 rounded px-1.5 py-0.5">{line.tag}</span>
              <span className="flex-1 min-w-0 truncate text-sm text-white">{line.text}</span>
            </div>
          ))}
          {(run.rejected ?? []).map((line, i) => (
            <div key={`r${i}`} className="flex items-center gap-2 px-2.5 py-1">
              <XCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
              <span className="flex-1 min-w-0 truncate text-xs text-gray-500 line-through">{line.text || '(empty)'}</span>
              <span className="shrink-0 text-[10px] font-mono text-red-300">{line.reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** One wire, and whether it is connected. `neutral` for a thing whose "off"
 *  state is a working fallback rather than a fault — X not being configured is
 *  a decision about a bill, not a broken deployment. */
function Wire({ label, ok, okText, badText, neutral }: {
  label: string
  ok: boolean
  okText: string
  badText: string
  neutral?: boolean
}) {
  return (
    <div className="rounded-lg bg-black/25 border border-white/[0.06] px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-[0.15em] text-gray-600">{label}</p>
      <p className={`mt-0.5 truncate ${ok ? 'text-emerald-300' : neutral ? 'text-gray-400' : 'text-red-300'}`}>
        {ok ? okText : badText}
      </p>
    </div>
  )
}
