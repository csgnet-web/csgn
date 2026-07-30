// The $CSGN holding thresholds, in one place.
//
// Every gate the token controls is a *promotion* gate — it decides whose message
// gets amplified, never who is allowed in. Access to the network (an account, a
// slot, going live) is free and always will be; see §5 of docs/master-plan.md.
//
// These are the defaults. The live values are stored in config/tokenGates so a
// threshold can be retuned as the token's price moves without a deploy — a fixed
// token count is a moving dollar cost, and a gate that quietly becomes a
// hundred-dollar wall is a gate nobody passes.

export interface TokenGates {
  /** Hold this much $CSGN to push a message onto the on-air Right Now rail. */
  rightNowMinCsgn: number
}

export const DEFAULT_TOKEN_GATES: TokenGates = {
  rightNowMinCsgn: 5_000_000,
}

/** Read a stored gates doc, falling back per-field so a partial or corrupt doc
 *  can never lock everyone out (or, worse, open a gate to zero). */
export function normalizeTokenGates(raw: unknown): TokenGates {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const min = Number(d.rightNowMinCsgn)
  return {
    rightNowMinCsgn: Number.isFinite(min) && min > 0 ? Math.floor(min) : DEFAULT_TOKEN_GATES.rightNowMinCsgn,
  }
}
