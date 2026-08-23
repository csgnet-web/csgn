import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import {
  getAssociatedTokenAddressSync,
  createTransferCheckedInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token'
import { CSGN_TREASURY, CSGN_MINT, CSGN_DECIMALS } from './slots'

// Client side of the Coin Jukebox: bid $CSGN to the treasury to take the
// broadcast spotlight. An SPL transferChecked of the mint, returning a confirmed
// signature that jukeboxSpotlight then re-verifies on-chain before granting the
// spotlight.
//
// $CSGN ONLY. The SOL path was removed deliberately — see the header of
// netlify/functions/jukeboxSpotlight.ts. The treasury recycles the proceeds into
// distribution / creator payouts / liquidity; nothing is burned (see /treasury).
//
// ⚠️ Not yet exercised against a live mainnet transaction — dry-run with a tiny
//    amount before enabling the jukebox publicly.
const RPC = 'https://api.mainnet-beta.solana.com'

interface PhantomTxProvider {
  isPhantom?: boolean
  signAndSendTransaction?: (tx: Transaction) => Promise<{ signature: string }>
}

/** Pay `amount` $CSGN from `walletAddress` to the treasury's token account;
 *  resolves with the confirmed tx signature. An SPL transferChecked of the mint.
 *  Throws if Phantom is unavailable, the wallet holds no $CSGN token account,
 *  or the user rejects. */
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
