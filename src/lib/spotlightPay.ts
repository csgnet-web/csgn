import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { CSGN_TREASURY } from './slots'

// Client side of the Coin Jukebox: pay SOL to the CSGN treasury to put your coin
// in the broadcast spotlight (TouchTunes-style). A plain SystemProgram transfer,
// returned as a confirmed signature that jukeboxSpotlight then re-verifies
// on-chain before granting the spotlight. The treasury recycles the SOL into
// distribution / creator payouts / liquidity — nothing is burned.
//
// ⚠️ Not yet exercised against a live mainnet transaction — dry-run with a tiny
//    amount before enabling the jukebox publicly.
const RPC = 'https://api.mainnet-beta.solana.com'

interface PhantomTxProvider {
  isPhantom?: boolean
  signAndSendTransaction?: (tx: Transaction) => Promise<{ signature: string }>
}

/** Pay `sol` SOL from `walletAddress` to the treasury; resolves with the
 *  confirmed tx signature. Throws if Phantom is unavailable or the user rejects. */
export async function paySpotlight(walletAddress: string, sol: number): Promise<string> {
  const provider = (window as unknown as { solana?: PhantomTxProvider }).solana
  if (!provider?.isPhantom || !provider.signAndSendTransaction) throw new Error('Phantom is required to play the jukebox.')
  if (!(sol > 0)) throw new Error('Amount must be positive.')

  const owner = new PublicKey(walletAddress)
  const treasury = new PublicKey(CSGN_TREASURY)
  const lamports = Math.round(sol * LAMPORTS_PER_SOL)

  const conn = new Connection(RPC, 'confirmed')
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed')
  const tx = new Transaction({ feePayer: owner, blockhash, lastValidBlockHeight })
  tx.add(SystemProgram.transfer({ fromPubkey: owner, toPubkey: treasury, lamports }))

  const { signature } = await provider.signAndSendTransaction(tx)
  await conn.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')
  return signature
}
