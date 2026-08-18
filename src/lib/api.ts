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
}

export type TwitchProof = { proofToken: string; twitch: { twitchUserId: string; username: string; displayName: string; profileImageUrl: string } }
export type TwitchOAuthResult = { twitchProofToken: string; twitchUserId: string; username: string; displayName: string; profileImageUrl: string }

/** What `startTwitchOAuth` hands back. `state` identifies this attempt and
 *  `linkToken` is the signed bearer that claims its result — see lib/twitchLink.ts. */
export type TwitchLinkStart = { authUrl: string; state: string; linkToken: string }

/** One poll of the Twitch round trip. `pending` means "still out there". */
export type TwitchLinkStatus =
  | { status: 'pending' }
  | { status: 'failed'; error: string }
  | ({ status: 'ready' } & TwitchOAuthResult)

export const api = {
  createPhantomChallenge: (walletAddress: string) => functionFetch<{ challengeToken: string; message: string }>('createPhantomChallenge', { method: 'POST', body: JSON.stringify({ walletAddress }) }),
  verifyPhantomSignature: (walletAddress: string, signature: string, challengeToken: string) => functionFetch<{ proofToken: string; walletAddress: string }>('verifyPhantomSignature', { method: 'POST', body: JSON.stringify({ walletAddress, signature, challengeToken }) }),
  /** Exchange a verified Phantom proof for a Firebase custom token (wallet login).
   *  404s for a wallet with no account — it never creates one. */
  loginWithPhantom: (proofToken: string) => functionFetch<{ customToken: string }>('loginWithPhantom', { method: 'POST', body: JSON.stringify({ proofToken }) }),
  /** Wallet-only sign-up: the wallet is the credential, so there is no email and
   *  no password. Returns a custom token whose exchange creates the auth user. */
  signupWithPhantom: (body: { username: string; phantomProofToken: string; twitchProofToken?: string }) =>
    functionFetch<{ customToken: string }>('signupWithPhantom', { method: 'POST', body: JSON.stringify(body) }),
  startTwitchOAuth: () => functionFetch<TwitchLinkStart>('startTwitchOAuth', { method: 'POST' }),
  /** Claim the result of a Twitch round trip. Safe to call repeatedly — it
   *  returns `pending` until some browser finishes the OAuth, and the proof is
   *  handed out exactly once. This is what lets the flow complete in Safari
   *  while the user's original tab (in Phantom's in-app browser) waits. */
  claimTwitchLink: (linkToken: string) => functionFetch<TwitchLinkStatus>('claimTwitchLink', { method: 'POST', body: JSON.stringify({ linkToken }) }),
  /** Twitch is OPTIONAL here — Phantom is the credential, Twitch only gates
   *  claiming a slot. See netlify/functions/finalizeCreateAccount.ts. */
  finalizeCreateAccount: (body: { username: string; phantomProofToken: string; twitchProofToken?: string }) => functionFetch<{ user: unknown }>('finalizeCreateAccount', { method: 'POST', body: JSON.stringify(body) }, true),
  /** Record an email the client has already linked via Firebase on the profile.
   *  The address is read from the caller's ID token, never from the body. */
  linkEmail: () => functionFetch<{ ok: boolean; alreadyLinked?: boolean; email: string }>('linkEmail', { method: 'POST' }, true),
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
  /** Admin: record a manual SOL creator-fee transfer against a member's slots.
   *  The signature is the receipt — the server validates its shape, skips any
   *  slot that is already settled, and stamps the whole group in one batch. */
  markFeesPaid: (slotIds: string[], txSignature: string) =>
    functionFetch<{ ok: boolean; marked: number; skipped: string[]; totalSOL: number }>(
      'adminMarkFeesPaid',
      { method: 'POST', body: JSON.stringify({ slotIds, txSignature }) },
      true,
    ),
  /* ── Clips: a member's reel of links that air between live hours ── */

  /** Your clips, your slice of the day, and when you are next on. One call so
   *  /studio can't show a stale allowance beside a fresh reel. */
  myClips: () => functionFetch<{
    clips: Array<{ id: string; platform: string; sourceUrl: string; title: string; seconds: number; order: number; status: string; rejectReason: string | null }>
    airtime: { seconds: number; capped: boolean; inventorySeconds: number; networkBlockEnabled: boolean; builtAt: string | null }
    airings: Array<{ startsAt: string; seconds: number; clipId: string }>
  }>('myClips', {}, true),
  /** Add a post to your reel. It lands pending — nothing airs unreviewed. */
  submitClip: (url: string, seconds: number, title: string) =>
    functionFetch<{ ok: boolean; clip: { id: string; platform: string; sourceUrl: string; title: string; seconds: number; order: number; status: string } }>(
      'submitClip', { method: 'POST', body: JSON.stringify({ url, seconds, title }) }, true,
    ),
  /** Reorder, retitle, retime or remove one of your own clips. */
  updateMyClip: (clipId: string, patch: { action: 'update' | 'remove'; order?: number; seconds?: number; title?: string }) =>
    functionFetch<{ ok: boolean; clipId?: string; removed?: string; reReview?: boolean }>(
      'updateMyClip', { method: 'POST', body: JSON.stringify({ clipId, ...patch }) }, true,
    ),
  /** Admin: the clip review queue. */
  clipQueue: (status = 'pending') => functionFetch<{ clips: Array<{
    id: string; uid: string; username: string; platform: string; sourceUrl: string
    title: string; seconds: number; status: string; createdAt: unknown
  }> }>(`adminClipQueue?status=${encodeURIComponent(status)}`, {}, true),
  /** Admin: approve or reject one clip. A rejection must carry a reason. */
  reviewClip: (clipId: string, decision: 'approved' | 'rejected', reason = '') =>
    functionFetch<{ ok: boolean; clipId: string; status: string }>(
      'adminReviewClip', { method: 'POST', body: JSON.stringify({ clipId, decision, reason }) }, true,
    ),

  /** Admin: the sign-in/sign-up audit feed. Served by a function rather than
   *  read from Firestore so it works before firestore.rules is ever deployed. */
  authEvents: (limit = 50) => functionFetch<{ events: Array<{
    id: string; kind: string; uid: string | null; twitchUsername: string | null
    errorMessage: string | null; ua: string | null; ts: string | null
  }> }>(`adminAuthEvents?limit=${limit}`, {}, true),
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
