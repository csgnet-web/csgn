import { CSGN_MINT } from './slots'

// Client-side CSGN balance, used only to gate/label the UI (show the connect
// state, unlock the Right Now box at 5M). The authoritative check is always
// re-done server-side in the Netlify functions — a spoofed client balance can
// never submit or vote, it just changes what buttons render.
const RPC_URL = 'https://api.mainnet-beta.solana.com'

interface TokenAmount { uiAmount?: number | null }
interface RpcAccount { account?: { data?: { parsed?: { info?: { tokenAmount?: TokenAmount } } } } }

export async function fetchCsgnBalance(walletAddress: string): Promise<number> {
  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [walletAddress, { mint: CSGN_MINT }, { encoding: 'jsonParsed' }],
      }),
    })
    const data = (await res.json()) as { result?: { value?: RpcAccount[] } }
    let total = 0
    for (const acc of data?.result?.value || []) {
      const ui = acc.account?.data?.parsed?.info?.tokenAmount?.uiAmount
      if (ui != null) total += ui
    }
    return total
  } catch {
    return 0
  }
}

export const CSGN_RIGHT_NOW_MIN = 5_000_000
