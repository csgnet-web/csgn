import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js'
import {
  getAssociatedTokenAddressSync,
  createTransferCheckedInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token'
import { CSGN_TREASURY, CSGN_MINT, CSGN_DECIMALS } from './slots'

// Client side of the Coin Jukebox: pay the CSGN treasury to put your coin in the
// broadcast spotlight (TouchTunes-style) — in SOL (a plain SystemProgram
// transfer) or in $CSGN (an SPL transfer of the mint). Either returns a confirmed
// signature that jukeboxSpotlight then re-verifies on-chain before granting the
// spotlight. The treasury recycles the proceeds into distribution / creator
// payouts / liquidity — nothing is burned (see /treasury).
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

/** Pay `amount` $CSGN from `walletAddress` to the treasury's token account;
 *  resolves with the confirmed tx signature. An SPL transferChecked of the mint —
 *  the token equivalent of paySpotlight. Throws if Phantom is unavailable, the
 *  wallet holds no $CSGN token account, or the user rejects. */
export async function paySpotlightCsgn(walletAddress: string, amount: number): Promise<string> {
  const provider = (window as unknown as { solana?: PhantomTxProvider }).solana
  if (!provider?.isPhantom || !provider.signAndSendTransaction) throw new Error('Phantom is required to play the jukebox.')
  if (!(amount > 0)) throw new Error('Amount must be positive.')

  const owner = new PublicKey(walletAddress)
  const treasury = new PublicKey(CSGN_TREASURY)
  const mint = new PublicKey(CSGN_MINT)
  const rawAmount = BigInt(Math.round(amount * 10 ** CSGN_DECIMALS))

  const fromAta = getAssociatedTokenAddressSync(mint, owner)
  const toAta = getAssociatedTokenAddressSync(mint, treasury)

  const conn = new Connection(RPC, 'confirmed')
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed')
  const tx = new Transaction({ feePayer: owner, blockhash, lastValidBlockHeight })

  // Create the treasury's token account first if it somehow doesn't exist yet
  // (payer = the buyer). Almost always a no-op — the treasury already holds $CSGN.
  try {
    await getAccount(conn, toAta)
  } catch {
    tx.add(createAssociatedTokenAccountInstruction(owner, toAta, treasury, mint))
  }
  tx.add(createTransferCheckedInstruction(fromAta, mint, toAta, owner, rawAmount, CSGN_DECIMALS))

  const { signature } = await provider.signAndSendTransaction(tx)
  await conn.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')
  return signature
}
