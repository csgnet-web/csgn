// Token-weighted vote records (votes/{id}), as the admin panel reads them.
// Voting power is each wallet's on-chain $CSGN balance; the server tallies
// ballots into `tally` keyed by option index.

export interface VoteRecord {
  id: string
  question?: string
  options?: string[]
  status?: string
  tally?: Record<string, { tokens?: number; wallets?: number }>
  createdAt?: string
  updatedAt?: string
}

/** Open until an admin closes it — that's the decision the tab badge counts. */
export const isVoteOpen = (vote: VoteRecord): boolean => (vote.status || 'open') !== 'closed'

export interface VoteStanding {
  index: number
  label: string
  tokens: number
  wallets: number
  /** Share of total tokens cast, 0–1. Zero when nobody has voted yet. */
  share: number
}

/** Options ranked by token weight, plus the vote's totals. */
export function voteStandings(vote: VoteRecord): { rows: VoteStanding[]; totalTokens: number; totalWallets: number } {
  const tally = vote.tally ?? {}
  const rows: VoteStanding[] = (vote.options ?? []).map((label, index) => ({
    index,
    label,
    tokens: Number(tally[String(index)]?.tokens || 0),
    wallets: Number(tally[String(index)]?.wallets || 0),
    share: 0,
  }))
  const totalTokens = rows.reduce((sum, r) => sum + r.tokens, 0)
  const totalWallets = rows.reduce((sum, r) => sum + r.wallets, 0)
  for (const row of rows) row.share = totalTokens > 0 ? row.tokens / totalTokens : 0
  return { rows: [...rows].sort((a, b) => b.tokens - a.tokens), totalTokens, totalWallets }
}
