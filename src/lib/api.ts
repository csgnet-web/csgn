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
  /** Change your username. The old handle is released back into the pool and
   *  there is a cooldown — see changeUsername.ts. */
  changeUsername: (username: string) =>
    functionFetch<{ ok: boolean; username: string; unchanged?: boolean; caseOnly?: boolean; cooldownDays?: number }>(
      'changeUsername', { method: 'POST', body: JSON.stringify({ username }) }, true,
    ),
  /** Turn stream forwarding on or off for an already-linked Twitch channel.
   *  Takes effect on the next roster sample — within about a minute. */
  setForwardConsent: (forwardConsent: boolean) =>
    functionFetch<{ ok: boolean; forwardConsent: boolean }>(
      'setForwardConsent', { method: 'POST', body: JSON.stringify({ forwardConsent }) }, true,
    ),
  /** Attach a Phantom wallet to an existing account, any time after sign-up.
   *  Without this a social sign-up has no wallet on file, so its $CSGN balance
   *  reads as zero and it is allocated no airtime — see linkPhantom.ts. */
  linkPhantom: (phantomProofToken: string) =>
    functionFetch<{ ok: boolean; alreadyLinked?: boolean; walletAddress: string; balance: number | null }>(
      'linkPhantom', { method: 'POST', body: JSON.stringify({ phantomProofToken }) }, true,
    ),
  /** Attach Twitch to an existing account, any time after sign-up. */
  /** `forwardConsent` is the grant that lets CSGN re-broadcast any stream on
   *  the channel — the thing that means a streamer never touches the schedule.
   *  Sending it again on an already-linked channel is how it is withdrawn. */
  linkTwitch: (twitchProofToken: string, forwardConsent = false) =>
    functionFetch<{ ok: boolean; alreadyLinked?: boolean; forwardConsent?: boolean; twitch: { username: string; displayName: string; profileImageUrl?: string } }>(
      'linkTwitch', { method: 'POST', body: JSON.stringify({ twitchProofToken, forwardConsent }) }, true,
    ),
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
  /** Create the CSGN profile for a Firebase user who signed in with Google, X
   *  or an email link. Idempotent — answers `created: false` if one exists. */
  finalizeSocialAccount: (username?: string) =>
    functionFetch<{ created: boolean; user: unknown }>(
      'finalizeSocialAccount', { method: 'POST', body: JSON.stringify({ username }) }, true,
    ),

  /* ── Clips: a member's reel of links that air between live hours ── */

  /** Your clips, your slice of the day, and when you are next on. One call so
   *  /studio can't show a stale allowance beside a fresh reel. */
  myClips: () => functionFetch<{
    onAirLook: string
    onAirStyle: string
    showAvatarOnAir: boolean
    /** The provider avatar we may put on air, captured from your ID token. */
    socialAvatar: { provider: string; url: string } | null
    username: string
    clips: Array<{
      id: string; platform: string; sourceUrl: string; title: string; thumbnailUrl: string
      seconds: number; sourceSeconds: number; trimStartSeconds: number; trimEndSeconds: number
      measured: boolean; order: number; status: string; rejectReason: string | null
    }>
    airtime: {
      /** What the bag earns today — independent of the review queue. */
      seconds: number
      /** What the playlist actually laid down. 0 until a clip is approved. */
      scheduledSeconds: number
      capped: boolean
      /** Share of circulating supply, as a fraction. */
      supplyShare: number
      inventorySeconds: number
      networkBlockEnabled: boolean; builtAt: string | null
      /** Which state this is — see myClips.ts. */
      reason: 'ok' | 'no_clips' | 'no_wallet' | 'unreadable' | 'no_balance' | 'no_inventory'
      walletAddress: string
      /** null means unread, not zero. */
      balance: number | null
      /** Why it could not be read, when it could not. */
      balanceError: string
    }
    airings: Array<{ startsAt: string; seconds: number; clipId: string }>
  }>('myClips', {}, true),
  /** Add a post to your reel. It lands pending — nothing airs unreviewed.
   *  No length argument: the server reads the real runtime off the platform. */
  submitClip: (url: string, title: string) =>
    functionFetch<{ ok: boolean; clip: { id: string; platform: string; sourceUrl: string; title: string; thumbnailUrl: string; seconds: number; measured: boolean; order: number; status: string } }>(
      'submitClip', { method: 'POST', body: JSON.stringify({ url, title }) }, true,
    ),
  /** Your on-air identity: the colour, the shape, and whether your X picture
   *  rides along. The avatar URL itself is never sent — the server reads it
   *  from your signed ID token. See updateMyProfile.ts. */
  setOnAirIdentity: (patch: { onAirLook?: string; onAirStyle?: string; showAvatarOnAir?: boolean }) =>
    functionFetch<{ ok: boolean; socialAvatar: { provider: string; url: string } | null }>(
      'updateMyProfile', { method: 'POST', body: JSON.stringify(patch) }, true,
    ),
  /** Reorder, retitle, retime or remove one of your own clips. */
  updateMyClip: (clipId: string, patch: {
    action: 'update' | 'remove'
    order?: number
    title?: string
    /** Crop the member's own video. Bounded server-side by its real length. */
    trimStartSeconds?: number
    trimEndSeconds?: number
  }) =>
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

  /** The Meme 100, served by a function rather than read from Firestore.
   *  Builds the board on demand when the stored copy is empty, so a cold start
   *  or an undeployed rules file cannot leave the page blank. */
  memeBoard: () => functionFetch<{
    coins: unknown[]
    updatedAt: string | null
    built: boolean
    reason?: string
    discovery?: { candidates?: number; qualified?: number } | null
  }>('memeBoard'),

  /** Admin: everybody in the network who is live on Twitch right now, plus
   *  what the operator should do about it. */
  liveNow: () => functionFetch<{
    entries: Array<{
      uid: string; username: string; twitchUsername: string; displayName: string
      profileImageUrl: string; live: boolean; viewerCount: number; title: string
      gameName: string; startedAt: string; liveMinutes: number; onAirMinutes: number
      sampledAt: string
    }>
    updatedAt: string | null
    onAirUid: string | null
    onAirIsGuest: boolean
    onAirName: string | null
    staleAfterMs: number
    viewerFloor: number
    alerts: Array<{
      kind: 'on_air_dropped' | 'pick_a_streamer' | 'switch_to_clips' | 'long_shift' | 'stronger_option'
      severity: 'critical' | 'action' | 'info'
      message: string
      uid?: string
      username?: string
    }>
    recommendation: { mode: 'streamer' | 'clips'; uid: string | null; why: string }
  }>('adminLiveNow', {}, true),
  /** Admin: put a member or a guest on the channel, or take the channel back. */
  setOnAir: (body: {
    uid?: string
    action: 'put_on_air' | 'take_off_air' | 'put_guest_on_air'
    guestUrl?: string
    guestName?: string
  }) =>
    functionFetch<{ ok: boolean; slotId: string; uid?: string; twitchUsername?: string; guest?: boolean; guestName?: string }>(
      'adminLiveNow', { method: 'POST', body: JSON.stringify(body) }, true,
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
  /** Bid $CSGN for the broadcast spotlight. The amount is whatever the signed
   *  transfer actually moved — the server re-reads it on-chain and rejects
   *  anything under the standing bid's raise. */
  jukeboxSpotlight: (proofToken: string, signature: string, coin: { symbol: string; coingeckoId?: string; dexPair?: string; dexChain?: string; note?: string }) =>
    functionFetch<{ ok: boolean; symbol: string; currency: 'CSGN'; amount: number; requiredAmount: number; expiresAt: string }>('jukeboxSpotlight', { method: 'POST', body: JSON.stringify({ proofToken, signature, ...coin }) }),
}
