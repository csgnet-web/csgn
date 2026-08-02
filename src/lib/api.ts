import { auth } from '@/config/firebase'

async function functionFetch<T>(name: string, init: RequestInit = {}, authRequired = false): Promise<T> {
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json')
  if (authRequired) {
    const token = await auth.currentUser?.getIdToken()
    if (!token) throw new Error('Please sign in first.')
    headers.set('Authorization', `Bearer ${token}`)
  }
  const res = await fetch(`/.netlify/functions/${name}`, { ...init, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || `Request failed: ${res.status}`)
  return data as T
}

export interface PublicProfile {
  username: string
  displayName: string
  avatarUrl: string
  role: string
  twitch: string
  bio: string
  slots: number
  winnings: number
}

export type TwitchProof = { proofToken: string; twitch: { twitchUserId: string; username: string; displayName: string; profileImageUrl: string } }
export type TwitchOAuthResult = { twitchProofToken: string; twitchUserId: string; username: string; displayName: string; profileImageUrl: string }

export const api = {
  createPhantomChallenge: (walletAddress: string) => functionFetch<{ challengeToken: string; message: string }>('createPhantomChallenge', { method: 'POST', body: JSON.stringify({ walletAddress }) }),
  verifyPhantomSignature: (walletAddress: string, signature: string, challengeToken: string) => functionFetch<{ proofToken: string; walletAddress: string }>('verifyPhantomSignature', { method: 'POST', body: JSON.stringify({ walletAddress, signature, challengeToken }) }),
  /** Exchange a verified Phantom proof for a Firebase custom token (wallet login). */
  loginWithPhantom: (proofToken: string) => functionFetch<{ customToken: string }>('loginWithPhantom', { method: 'POST', body: JSON.stringify({ proofToken }) }),
  startTwitchOAuth: () => functionFetch<{ authUrl: string }>('startTwitchOAuth', { method: 'POST' }),
  consumeTwitchOAuthResult: (handoffId: string) => functionFetch<TwitchOAuthResult>('consumeTwitchOAuthResult', { method: 'POST', body: JSON.stringify({ handoffId }) }),
  /** Twitch is OPTIONAL here — Phantom is the credential, Twitch only gates
   *  claiming a slot. See netlify/functions/finalizeCreateAccount.ts. */
  finalizeCreateAccount: (body: { username: string; phantomProofToken: string; twitchProofToken?: string }) => functionFetch<{ user: unknown }>('finalizeCreateAccount', { method: 'POST', body: JSON.stringify(body) }, true),
  /** Attach Twitch to an existing account, any time after sign-up. */
  linkTwitch: (twitchProofToken: string) => functionFetch<{ ok: boolean; alreadyLinked?: boolean; twitch: { username: string; displayName: string; profileImageUrl?: string } }>('linkTwitch', { method: 'POST', body: JSON.stringify({ twitchProofToken }) }, true),
  /** Recommended members, or one member by username. Server-projected — the
   *  response never contains an email, wallet or role flag beyond the label. */
  publicProfiles: (params: { limit?: number; exclude?: string } = {}) => {
    const q = new URLSearchParams()
    if (params.limit) q.set('limit', String(params.limit))
    if (params.exclude) q.set('exclude', params.exclude)
    return functionFetch<{ profiles: PublicProfile[] }>(`publicProfiles?${q.toString()}`)
  },
  publicProfile: (username: string) => functionFetch<{ profile: PublicProfile | null }>(`publicProfiles?username=${encodeURIComponent(username)}`),
  claimSlot: (slotId: string) => functionFetch<{ ok: boolean; slotId: string }>('claimSlot', { method: 'POST', body: JSON.stringify({ slotId }) }, true),
  /** Admin: re-type every slot by its ET airtime (7 PM–3 AM network, rest open). */
  normalizeSlots: () => functionFetch<{ normalized: number; retyped: number }>('adminNormalizeExistingSlots', { method: 'POST' }, true),
  /** Close a vote and recompute its tally from live on-chain balances.
   *  `close: false` re-settles without closing (refresh the standings). */
  settleVote: (voteId: string, close = true) => functionFetch<{
    ok: boolean; voteId: string; ballots: number; counted: number; dropped: number; unread: number
    tally: Record<string, { tokens: number; wallets: number }>
  }>('adminSettleVote', { method: 'POST', body: JSON.stringify({ voteId, close }) }, true),
  submitRightNow: (proofToken: string, text: string) => functionFetch<{ ok: boolean; text: string; railSize: number }>('submitRightNow', { method: 'POST', body: JSON.stringify({ proofToken, text }) }),
  castVote: (proofToken: string, voteId: string, option: number) => functionFetch<{ ok: boolean; option: number; weight: number }>('castVote', { method: 'POST', body: JSON.stringify({ proofToken, voteId, option }) }),
  /** Ballots are cast against the MINT, not a typed ticker — symbols collide
   *  and a string nobody can look up makes the ranking unauditable. */
  voteMeme: (proofToken: string, address: string) => functionFetch<{ ok: boolean; address: string; symbol: string; weight: number; tallies: Record<string, { tokens: number; wallets: number }> }>('voteMeme', { method: 'POST', body: JSON.stringify({ proofToken, address }) }),
  jukeboxSpotlight: (proofToken: string, signature: string, coin: { symbol: string; currency?: 'SOL' | 'CSGN'; coingeckoId?: string; dexPair?: string; dexChain?: string; note?: string }) =>
    functionFetch<{ ok: boolean; symbol: string; currency: 'SOL' | 'CSGN'; amount: number; requiredAmount: number; sol?: number; requiredSol?: number }>('jukeboxSpotlight', { method: 'POST', body: JSON.stringify({ proofToken, signature, ...coin }) }),
}
