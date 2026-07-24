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

export type TwitchProof = { proofToken: string; twitch: { twitchUserId: string; username: string; displayName: string; profileImageUrl: string } }
export type TwitchOAuthResult = { twitchProofToken: string; twitchUserId: string; username: string; displayName: string; profileImageUrl: string }

export const api = {
  createPhantomChallenge: (walletAddress: string) => functionFetch<{ challengeToken: string; message: string }>('createPhantomChallenge', { method: 'POST', body: JSON.stringify({ walletAddress }) }),
  verifyPhantomSignature: (walletAddress: string, signature: string, challengeToken: string) => functionFetch<{ proofToken: string; walletAddress: string }>('verifyPhantomSignature', { method: 'POST', body: JSON.stringify({ walletAddress, signature, challengeToken }) }),
  startTwitchOAuth: () => functionFetch<{ authUrl: string }>('startTwitchOAuth', { method: 'POST' }),
  consumeTwitchOAuthResult: (handoffId: string) => functionFetch<TwitchOAuthResult>('consumeTwitchOAuthResult', { method: 'POST', body: JSON.stringify({ handoffId }) }),
  finalizeCreateAccount: (body: { username: string; phantomProofToken: string; twitchProofToken: string }) => functionFetch<{ user: unknown }>('finalizeCreateAccount', { method: 'POST', body: JSON.stringify(body) }, true),
  claimSlot: (slotId: string) => functionFetch<{ ok: boolean; slotId: string }>('claimSlot', { method: 'POST', body: JSON.stringify({ slotId }) }, true),
  submitRightNow: (proofToken: string, text: string) => functionFetch<{ ok: boolean; text: string; railSize: number }>('submitRightNow', { method: 'POST', body: JSON.stringify({ proofToken, text }) }),
  castVote: (proofToken: string, voteId: string, option: number) => functionFetch<{ ok: boolean; option: number; weight: number }>('castVote', { method: 'POST', body: JSON.stringify({ proofToken, voteId, option }) }),
  burnSpotlight: (proofToken: string, signature: string, coin: { symbol: string; coingeckoId?: string; dexPair?: string; dexChain?: string; note?: string }) =>
    functionFetch<{ ok: boolean; symbol: string; burned: number; required: number }>('burnSpotlight', { method: 'POST', body: JSON.stringify({ proofToken, signature, ...coin }) }),
}
