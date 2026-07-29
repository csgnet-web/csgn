// Vote history — the permanent record of every token-weighted vote the network
// has run. Same shape as Creator Fees on purpose: whatever is still open sits
// at the top demanding a decision, everything settled archives into day/week/
// month buckets below.
import { Trophy, Vote as VoteIcon, Users } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { HistoryLedger } from '@/components/admin/HistoryLedger'
import { isVoteOpen, voteStandings as standings, type VoteRecord } from '@/lib/votes'

const votedAt = (vote: VoteRecord): string => vote.updatedAt || vote.createdAt || ''

const compactTokens = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(Math.round(n))

interface VoteHistoryTabProps {
  votes: VoteRecord[]
  votesLoading: boolean
  closingId: string | null
  onCloseVote: (vote: VoteRecord) => void
}

export function VoteHistoryTab({ votes, votesLoading, closingId, onCloseVote }: VoteHistoryTabProps) {
  const open = votes.filter(isVoteOpen)
  const closed = votes.filter((v) => !isVoteOpen(v))
  const allTokens = votes.reduce((sum, v) => sum + standings(v).totalTokens, 0)
  const allBallots = votes.reduce((sum, v) => sum + standings(v).totalWallets, 0)

  /** Live view — full bar chart so the operator can read the room on air. */
  const renderOpen = (vote: VoteRecord) => {
    const { rows, totalTokens, totalWallets } = standings(vote)
    return (
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">{vote.question || 'Untitled vote'}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {compactTokens(totalTokens)} $CSGN · {totalWallets} wallet{totalWallets !== 1 ? 's' : ''}
              {vote.createdAt && ` · opened ${new Date(vote.createdAt).toLocaleString()}`}
            </p>
          </div>
          <Button variant="secondary" size="sm" isLoading={closingId === vote.id} onClick={() => onCloseVote(vote)}>
            Close voting
          </Button>
        </div>

        <div className="mt-3 space-y-1.5">
          {rows.map((row) => (
            <div key={`${vote.id}-${row.index}`}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-200 truncate">{row.label}</span>
                <span className="text-gray-400 font-mono shrink-0 ml-2">
                  {compactTokens(row.tokens)} · {(row.share * 100).toFixed(0)}%
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-accent-500" style={{ width: `${Math.max(row.share * 100, row.tokens > 0 ? 3 : 0)}%` }} />
              </div>
            </div>
          ))}
          {rows.length === 0 && <p className="text-xs text-gray-500">No options recorded on this vote.</p>}
        </div>
      </div>
    )
  }

  /** Archive view — the result, one line, expandable for the full split. */
  const renderClosed = (vote: VoteRecord) => {
    const { rows, totalTokens, totalWallets } = standings(vote)
    const winner = rows[0]
    return (
      <details className="group">
        <summary className="px-4 sm:px-5 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 cursor-pointer hover:bg-white/[0.03] transition-colors">
          <Trophy className="w-3.5 h-3.5 text-gold shrink-0" />
          <span className="text-sm text-white truncate max-w-[18rem]">{vote.question || 'Untitled vote'}</span>
          {winner && winner.tokens > 0 ? (
            <Badge variant="gold">{winner.label} · {(winner.share * 100).toFixed(0)}%</Badge>
          ) : (
            <Badge variant="default">no ballots</Badge>
          )}
          <span className="ml-auto text-xs text-gray-500 font-mono">{compactTokens(totalTokens)} $CSGN · {totalWallets}w</span>
        </summary>
        <div className="px-4 sm:px-5 pb-3 space-y-1">
          {rows.map((row) => (
            <div key={`${vote.id}-${row.index}`} className="flex items-center justify-between text-xs">
              <span className="text-gray-400 truncate">{row.label}</span>
              <span className="text-gray-500 font-mono shrink-0 ml-2">
                {compactTokens(row.tokens)} · {row.wallets}w · {(row.share * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </details>
    )
  }

  if (votesLoading) {
    return (
      <div className="py-16 text-center">
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">Loading vote history...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          ['Open now', String(open.length), open.length > 0 ? 'text-cyan-300' : 'text-gray-400'],
          ['Votes run', String(votes.length), 'text-gray-300'],
          ['$CSGN voted', compactTokens(allTokens), 'text-gold'],
          ['Ballots cast', String(allBallots), 'text-emerald-400'],
        ] as const).map(([label, value, color]) => (
          <Card key={label} hover={false} className="p-3">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
            <p className={`mt-1 text-lg font-bold font-mono truncate ${color}`}>{value}</p>
          </Card>
        ))}
      </div>

      {open.length > 0 ? (
        <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-cyan-500/[0.09] to-transparent overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-cyan-500/20">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-cyan-200">
              <VoteIcon className="w-4 h-4" />
              {open.length} vote{open.length !== 1 ? 's' : ''} open right now
            </h3>
            <span className="text-xs text-cyan-300/80">Holders can still move their weight</span>
          </div>
          <div className="divide-y divide-cyan-500/10">
            {open.map((vote) => <div key={vote.id}>{renderOpen(vote)}</div>)}
          </div>
        </div>
      ) : (
        <Card hover={false} className="p-6 text-center">
          <Users className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-white">No vote is open</p>
          <p className="text-xs text-gray-400 mt-1">Launch one from Ticker Controls → Vote to put a decision in the crowd's hands.</p>
        </Card>
      )}

      <HistoryLedger
        title="Closed votes"
        items={closed}
        at={votedAt}
        keyOf={(vote) => vote.id}
        renderItem={renderClosed}
        summary={(items) => {
          const tokens = items.reduce((sum, v) => sum + standings(v).totalTokens, 0)
          const wallets = items.reduce((sum, v) => sum + standings(v).totalWallets, 0)
          return `${compactTokens(tokens)} $CSGN · ${wallets} ballot${wallets !== 1 ? 's' : ''}`
        }}
        emptyLabel="No closed votes yet — results archive here by day, week, and month."
      />
    </div>
  )
}

export default VoteHistoryTab
