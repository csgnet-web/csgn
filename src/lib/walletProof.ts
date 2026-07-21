import { api } from './api'

type SignFn = (message: string) => Promise<string | null>

/**
 * Runs the Phantom challenge → sign → verify handshake and returns a short-lived
 * `phantom_wallet` proof token. Backend holder actions (submitRightNow, castVote)
 * accept this token as proof the caller controls the wallet, then read the
 * wallet's on-chain CSGN balance server-side. The token is valid ~15 minutes.
 */
export async function proveWallet(walletAddress: string, signMessage: SignFn): Promise<string> {
  const { challengeToken, message } = await api.createPhantomChallenge(walletAddress)
  const signature = await signMessage(message)
  if (!signature) throw new Error('Wallet signature was declined.')
  const { proofToken } = await api.verifyPhantomSignature(walletAddress, signature, challengeToken)
  return proofToken
}
