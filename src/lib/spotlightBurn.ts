import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { createBurnCheckedInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { CSGN_MINT, CSGN_DECIMALS } from './slots'

// Client side of buy-and-burn: construct + send a real SPL burn of CSGN from the
// connected Phantom wallet, returning the confirmed signature (which the
// burnSpotlight function then re-verifies on-chain before granting the
// spotlight). BurnChecked is used deliberately — the token program reverts the
// whole transaction on any decimal/amount mismatch, so a bug here fails the burn
// rather than destroying a wrong amount of someone's tokens.
//
// ⚠️ Not yet exercised against a live mainnet transaction — dry-run with a tiny
//    amount before enabling buy-and-burn publicly.
const RPC = 'https://api.mainnet-beta.solana.com'

interface PhantomTxProvider {
  isPhantom?: boolean
  signAndSendTransaction?: (tx: Transaction) => Promise<{ signature: string }>
}

/** Burn `uiAmount` CSGN from `walletAddress`; resolves with the tx signature
 *  once confirmed. Throws if Phantom is unavailable or the user rejects. */
export async function burnCsgn(walletAddress: string, uiAmount: number): Promise<string> {
  const provider = (window as unknown as { solana?: PhantomTxProvider }).solana
  if (!provider?.isPhantom || !provider.signAndSendTransaction) throw new Error('Phantom is required to burn $CSGN.')
  if (!(uiAmount > 0)) throw new Error('Burn amount must be positive.')

  const owner = new PublicKey(walletAddress)
  const mint = new PublicKey(CSGN_MINT)
  const ata = getAssociatedTokenAddressSync(mint, owner, false, TOKEN_PROGRAM_ID)
  const rawAmount = BigInt(Math.round(uiAmount * 10 ** CSGN_DECIMALS))

  const conn = new Connection(RPC, 'confirmed')
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed')
  const tx = new Transaction({ feePayer: owner, blockhash, lastValidBlockHeight })
  tx.add(createBurnCheckedInstruction(ata, mint, owner, rawAmount, CSGN_DECIMALS, [], TOKEN_PROGRAM_ID))

  const { signature } = await provider.signAndSendTransaction(tx)
  await conn.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')
  return signature
}
