import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, ExternalLink, Film, RefreshCw, XCircle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/lib/api'
import { CLIP_PLATFORM_LABELS, clipLength, type ClipPlatform } from '@/lib/clipEmbed'

/**
 * CLIP REVIEW — the gate between a member's link and the broadcast.
 *
 * The one screen where "looks fine, ship it" is not an option. A CSGN hour goes
 * out on a real Twitch channel: one copyrighted track is a strike, three is the
 * channel, and something illegal is worse than that. So the reviewer's job is to
 * OPEN THE POST and watch it, which is why every row leads with a link out
 * rather than an embedded preview — an embed here would tempt a decision made
 * off a thumbnail.
 *
 * Rejections carry a reason because the member sees it. "No" with no sentence
 * after it produces a second identical submission an hour later.
 */

interface QueueClip {
  id: string
  uid: string
  username: string
  platform: string
  sourceUrl: string
  title: string
  seconds: number
  status: string
}

type Filter = 'pending' | 'approved' | 'rejected'

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'pending', label: 'Waiting' },
  { id: 'approved', label: 'On air' },
  { id: 'rejected', label: 'Rejected' },
]

export default function ClipQueueTab() {
  const [filter, setFilter] = useState<Filter>('pending')
  const [clips, setClips] = useState<QueueClip[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const load = useCallback(async (status: Filter) => {
    try {
      const res = await api.clipQueue(status)
      setClips(res.clips)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the queue.')
      setClips([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    ;(async () => { await load(filter) })()
  }, [filter, load])

  const decide = async (clip: QueueClip, decision: 'approved' | 'rejected', why = '') => {
    setBusyId(clip.id)
    try {
      await api.reviewClip(clip.id, decision, why)
      setRejectingId(null)
      setReason('')
      await load(filter)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that decision.')
    }
    setBusyId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg bg-white/[0.04] p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => { setFilter(f.id); setLoading(true) }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                filter === f.id ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button variant="secondary" size="sm" onClick={() => { setLoading(true); void load(filter) }}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center">
          <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : clips.length === 0 ? (
        <Card hover={false} className="p-8 text-center">
          <Film className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-white font-semibold">
            {filter === 'pending' ? 'Nothing waiting' : `No ${filter} clips`}
          </p>
          {filter === 'pending' && (
            <p className="mt-1 text-xs text-gray-500">Everything members have sent in has a decision.</p>
          )}
        </Card>
      ) : (
        <Card hover={false} className="overflow-hidden">
          <div className="divide-y divide-white/[0.06]">
            {clips.map((clip) => (
              <div key={clip.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-white truncate">{clip.title || 'Untitled clip'}</span>
                      <Badge variant="default">{CLIP_PLATFORM_LABELS[clip.platform as ClipPlatform] ?? clip.platform}</Badge>
                      <span className="text-xs font-mono text-gray-500">{clipLength(clip.seconds)}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-emerald-400">@{clip.username || clip.uid.slice(0, 8)}</p>
                  </div>
                  {/* Watch it where it lives. The decision is about the actual
                      post, not about a title somebody typed. */}
                  <a
                    href={clip.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-400/30 bg-cyan-500/10 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Watch it
                  </a>
                </div>

                <p className="mt-2 text-[11px] font-mono text-gray-600 break-all">{clip.sourceUrl}</p>

                {clip.status === 'pending' && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button variant="gold" size="sm" isLoading={busyId === clip.id} onClick={() => void decide(clip, 'approved')}>
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Approve for air
                    </Button>
                    {rejectingId === clip.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          autoFocus
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Why? The member sees this."
                          className="w-56 px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50"
                        />
                        <Button
                          variant="ghost" size="sm" className="text-red-400 hover:text-red-300"
                          isLoading={busyId === clip.id}
                          disabled={!reason.trim()}
                          onClick={() => void decide(clip, 'rejected', reason.trim())}
                        >
                          Confirm
                        </Button>
                        <Button variant="ghost" size="sm" className="text-gray-500" onClick={() => { setRejectingId(null); setReason('') }}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={() => { setRejectingId(clip.id); setReason('') }}>
                        <XCircle className="w-3 h-3 mr-1" /> Reject
                      </Button>
                    )}
                  </div>
                )}

                {clip.status === 'approved' && (
                  <Button
                    variant="ghost" size="sm" className="mt-3 text-red-400 hover:text-red-300"
                    isLoading={busyId === clip.id}
                    onClick={() => void decide(clip, 'rejected', 'Pulled from air by an admin.')}
                  >
                    <XCircle className="w-3 h-3 mr-1" /> Pull from air
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <p className="text-xs text-gray-500 leading-relaxed">
        Approved clips enter the next schedule rebuild (about every ten minutes) and air between
        live hours. Pulling one takes it out of the next rebuild — a segment already on screen
        finishes, and it never comes back.
      </p>
    </div>
  )
}
