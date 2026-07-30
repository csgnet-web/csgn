// Server mirror of src/lib/tokenGates.ts — same defaults, same normalization.
// Kept as its own file because the client module imports the Firebase browser
// SDK transitively and can't be pulled into a function bundle.

export interface TokenGates {
  rightNowMinCsgn: number
}

export const DEFAULT_TOKEN_GATES: TokenGates = {
  rightNowMinCsgn: 5_000_000,
}

/** Fall back per-field so a partial or corrupt doc can never lock everyone out
 *  — or, worse, drop a gate to zero. */
export function normalizeTokenGates(raw: unknown): TokenGates {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const min = Number(d.rightNowMinCsgn)
  return {
    rightNowMinCsgn: Number.isFinite(min) && min > 0 ? Math.floor(min) : DEFAULT_TOKEN_GATES.rightNowMinCsgn,
  }
}
