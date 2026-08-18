/**
 * The token, in one place.
 *
 * The mint appears in `src/lib/slots.ts` (client transactions) and in
 * `netlify/functions/_shared/solana.ts` (server reads) because those two
 * environments cannot share a module. Everything ELSE about the token — where
 * to buy it, where to look at its chart — belongs here, so a link is changed
 * once rather than found in four components.
 */

export const CSGN_MINT_ADDRESS = 'GFV7fphvprMr1PYpYGPJort2QP7JJLEp3J1Buu7Zpump'

/** Jupiter, pre-loaded with SOL → $CSGN. The shortest path from "I want more
 *  airtime" to actually holding more, which is the only reason a buy button
 *  exists anywhere in this app. */
export const JUPITER_SWAP_URL = `https://jup.ag/swap/SOL-${CSGN_MINT_ADDRESS}`

export const DEXSCREENER_URL = `https://dexscreener.com/solana/${CSGN_MINT_ADDRESS}`
