// Temporary, client-side storage of the Twitch proof handed back from the
// mobile-safe OAuth redirect flow. The proof token itself is verified
// server-side during finalizeCreateAccount; this only keeps it around long
// enough for the user to finish Create Account.

export const TWITCH_PROOF_KEY = 'csgn:twitchProof'

export interface StoredTwitchProof {
  proofToken: string
  twitch: { twitchUserId: string; username: string; displayName: string; profileImageUrl: string }
  expiresAt: number
}

export function storeTwitchProof(proof: StoredTwitchProof): void {
  try {
    sessionStorage.setItem(TWITCH_PROOF_KEY, JSON.stringify(proof))
  } catch {
    /* sessionStorage unavailable — ignore */
  }
}

export function readTwitchProof(): StoredTwitchProof | null {
  try {
    const raw = sessionStorage.getItem(TWITCH_PROOF_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredTwitchProof
    if (!parsed?.proofToken || !parsed?.twitch?.twitchUserId || !parsed?.expiresAt) {
      clearTwitchProof()
      return null
    }
    if (Date.now() >= parsed.expiresAt) {
      clearTwitchProof()
      return null
    }
    return parsed
  } catch {
    clearTwitchProof()
    return null
  }
}

export function clearTwitchProof(): void {
  try {
    sessionStorage.removeItem(TWITCH_PROOF_KEY)
  } catch {
    /* sessionStorage unavailable — ignore */
  }
}
