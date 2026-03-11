import { useState, useEffect, useCallback } from 'react'
import { Gavel, Wallet, Clock3, AlertTriangle, TrendingUp, Crown, Info } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { usePhantomWallet } from '@/hooks/usePhantomWallet'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  fetchSlots,
  placeBid,
  requestSlot,
  getMinimumBid,
  formatCSGN,
  CSGN_MINT,
  CSGN_TREASURY,
  CSGN_DECIMALS,
  type Slot,
} from '@/lib/slots'

const CSGN_MINT_PUBKEY = CSGN_MINT
const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
const ASSOCIATED_TOKEN_PROGRAM_ID = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bEp'

function formatDate(date: Date) {
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/**
 * Compute the Associated Token Account (ATA) for an owner + mint.
 * Uses PublicKey.findProgramAddressSync from @solana/web3.js.
 */
async function findATA(ownerAddress: string, mintAddress: string): Promise<string> {
  const { PublicKey } = await import('@solana/web3.js')
  const owner = new PublicKey(ownerAddress)
  const mint = new PublicKey(mintAddress)
  const tokenProgram = new PublicKey(TOKEN_PROGRAM_ID)
  const associatedTokenProgram = new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID)

  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), tokenProgram.toBuffer(), mint.toBuffer()],
    associatedTokenProgram,
  )
  return ata.toBase58()
}

/**
 * Build and send a CSGN SPL token transfer via Phantom.
 * Returns the tx signature.
 */
async function sendCSGNBid(
  fromWalletAddress: string,
  amountTokens: number,
): Promise<string> {
  const { PublicKey, Transaction, TransactionInstruction, Connection } = await import('@solana/web3.js')

  const provider = window.solana
  if (!provider?.isPhantom) throw new Error('Phantom wallet not detected.')

  const connection = new Connection('https://api.mainnet-beta.solana.com')

  const fromPubkey = new PublicKey(fromWalletAddress)
  const toPubkey = new PublicKey(CSGN_TREASURY)
  const mintPubkey = new PublicKey(CSGN_MINT_PUBKEY)
  const tokenProgramPubkey = new PublicKey(TOKEN_PROGRAM_ID)

  // Find ATAs for source (bidder) and destination (treasury)
  const sourceATA = await findATA(fromWalletAddress, CSGN_MINT_PUBKEY)
  const destATA = await findATA(CSGN_TREASURY, CSGN_MINT_PUBKEY)

  // Amount in base units (multiply by 10^6 for CSGN decimals) — browser-safe, no Buffer
  const amountBaseUnits = BigInt(amountTokens) * BigInt(Math.pow(10, CSGN_DECIMALS))

  // Build SPL Transfer instruction data (type=3, u64 LE amount) using DataView
  const transferData = new Uint8Array(9)
  transferData[0] = 3 // Transfer instruction discriminator
  new DataView(transferData.buffer).setBigUint64(1, amountBaseUnits, true) // LE

  const transferIx = new TransactionInstruction({
    programId: tokenProgramPubkey,
    keys: [
      { pubkey: new PublicKey(sourceATA), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(destATA), isSigner: false, isWritable: true },
      { pubkey: fromPubkey, isSigner: true, isWritable: false },
    ],
    data: transferData as any,
  })

  // Ensure destination ATA exists — create it if not
  const destAtaPubkey = new PublicKey(destATA)
  let createATAIx: InstanceType<typeof TransactionInstruction> | null = null
  try {
    const destAtaInfo = await connection.getAccountInfo(destAtaPubkey)
    if (!destAtaInfo) {
      const assocProgram = new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID)
      createATAIx = new TransactionInstruction({
        programId: assocProgram,
        keys: [
          { pubkey: fromPubkey, isSigner: true, isWritable: true },
          { pubkey: destAtaPubkey, isSigner: false, isWritable: true },
          { pubkey: toPubkey, isSigner: false, isWritable: false },
          { pubkey: mintPubkey, isSigner: false, isWritable: false },
          { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false },
          { pubkey: tokenProgramPubkey, isSigner: false, isWritable: false },
        ],
        data: new Uint8Array(0) as any,
      })
    }
  } catch {
    // proceed without creating
  }

  const { blockhash } = await connection.getLatestBlockhash()
  const transaction = new Transaction()
  transaction.recentBlockhash = blockhash
  transaction.feePayer = fromPubkey

  if (createATAIx) transaction.add(createATAIx)
  transaction.add(transferIx)

  const signed = await (provider as any).signAndSendTransaction(transaction)
  await connection.confirmTransaction(signed.signature)

  return signed.signature as string
}

export default function Queue() {
  const { user, profile } = useAuth()
  const { walletAddress, balance, connect, isConnecting, error: walletError } = usePhantomWallet()
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [requestMessages, setRequestMessages] = useState<Record<string, string>>({})

  const loadSlots = useCallback(async () => {
    const now = new Date()
    const future = new Date(now.getTime() + 48 * 60 * 60 * 1000)
    try {
      const data = await fetchSlots(now, future)
      setSlots(data)
    } catch (err) {
      console.warn('Failed to fetch slots:', err)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadSlots()
  }, [loadSlots])

  const now = Date.now()
  const auctionSlots = slots.filter((s) => s.type === 'auction' && s.status === 'open')
  const ceoSlots = slots.filter((s) => s.type === 'ceo' && s.status === 'open')

  const handlePlaceBid = async (slot: Slot) => {
    if (!user || !profile || !walletAddress) return
    setActionError(null)
    setActionLoading(slot.id)

    const bidAmount = getMinimumBid(slot.bids.length)

    try {
      // Send CSGN tokens via Phantom
      const txSignature = await sendCSGNBid(walletAddress, bidAmount)

      // Record the bid in Firestore
      await placeBid(slot.id, {
        uid: user.uid,
        displayName: profile.displayName || 'User',
        amount: bidAmount,
        walletAddress,
        txSignature,
        createdAt: new Date().toISOString(),
      })

      await loadSlots()
    } catch (err: any) {
      if (err?.message?.includes('User rejected')) {
        setActionError('Transaction cancelled.')
      } else {
        setActionError(err?.message || 'Failed to place bid. Please try again.')
      }
    }
    setActionLoading(null)
  }

  const handleRequestSlot = async (slot: Slot) => {
    if (!user || !profile) return
    setActionError(null)
    setActionLoading(slot.id)

    const message = requestMessages[slot.id] || ''
    if (!message.trim()) {
      setActionError('Please add a message with your request.')
      setActionLoading(null)
      return
    }

    try {
      await requestSlot(slot.id, {
        uid: user.uid,
        displayName: profile.displayName || 'User',
        message: message.trim(),
        createdAt: new Date().toISOString(),
      })
      setRequestMessages((prev) => ({ ...prev, [slot.id]: '' }))
      await loadSlots()
    } catch (err: any) {
      setActionError(err?.message || 'Failed to submit request.')
    }
    setActionLoading(null)
  }

  return (
    <div className="min-h-screen pt-24 lg:pt-32 pb-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <Card hover={false} className="p-5 bg-white/5 border-red-500/20">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold text-white">Bidding Queue</h1>
              <p className="text-sm text-gray-400 mt-1">
                Auction slots (3 AM–7 PM) accept CSGN bids on a quadratic curve. CEO Schedule (7 PM–3 AM) is admin-curated — request a slot below.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {walletAddress ? (
                <Badge variant="purple">
                  <Wallet className="w-3 h-3" /> {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}{' '}
                  {balance !== null ? `(${balance.toFixed(3)} SOL)` : ''}
                </Badge>
              ) : (
                <Button variant="primary" size="sm" onClick={connect} isLoading={isConnecting}>
                  Connect Phantom
                </Button>
              )}
            </div>
          </div>
          {!user && <p className="text-xs text-amber-300 mt-2">You can view all slots without logging in. Sign in to bid or submit CEO requests.</p>}
          {walletError && <p className="text-xs text-red-300 mt-2">{walletError}</p>}
          {actionError && (
            <div className="mt-3 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {actionError}
            </div>
          )}
        </Card>

        {/* CSGN Token info */}
        <Card hover={false} className="p-4 bg-cyan-500/5 border-cyan-500/20">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-white font-medium">Bids are paid in CSGN tokens</p>
              <p className="text-xs text-gray-400 mt-1">
                Connect your Phantom wallet to bid. CSGN is transferred on-chain to the treasury.{' '}
                <span className="font-mono text-[10px] text-gray-500">Mint: {CSGN_MINT_PUBKEY}</span>
              </p>
            </div>
          </div>
        </Card>

        {user && !user.emailVerified && (
          <Card hover={false} className="p-4 bg-amber-500/5 border-amber-500/20">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <p className="text-sm text-gray-300">Verify your email to place bids and submit slot requests.</p>
            </div>
          </Card>
        )}

        {loading ? (
          <div className="py-16 text-center">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading available slots...</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Auction Slots */}
            <Card hover={false} className="p-5 space-y-4">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <Gavel className="w-4 h-4 text-red-400" /> Auction Slots
                <span className="text-xs text-gray-500 font-normal">3 AM – 7 PM ET</span>
              </h2>
              {auctionSlots.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">No auction slots open right now. Check back soon.</p>
              ) : (
                auctionSlots.map((slot, index) => {
                  const bidPrice = getMinimumBid(slot.bids.length)
                  const closesAt = new Date(slot.startTime).getTime() - 2 * 60 * 60 * 1000
                  const isWindowOpen = now <= closesAt
                  const userAlreadyBid = user ? slot.bids.some((b) => b.uid === user.uid) : false

                  return (
                    <div key={slot.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-white font-medium">{slot.label}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock3 className="w-3 h-3" /> Airs {formatDate(new Date(slot.startTime))}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {index === 0 && <Badge variant="blue">Soonest</Badge>}
                          <Badge variant="default">{slot.bids.length} bid{slot.bids.length !== 1 ? 's' : ''}</Badge>
                        </div>
                      </div>

                      {/* Quadratic curve visualization */}
                      <div className="mt-3 p-3 bg-white/[0.03] rounded-lg border border-white/5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> Bid Price (Quadratic Curve)
                          </span>
                          <span className="text-xs text-gray-500">y = 100k + 10k·x²</span>
                        </div>
                        <div className="text-2xl font-bold font-mono text-white">
                          {bidPrice.toLocaleString()} <span className="text-sm text-cyan-400">CSGN</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          Next bid: {getMinimumBid(slot.bids.length + 1).toLocaleString()} CSGN
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-xs text-gray-500">CSGN transferred via Phantom on bid.</p>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={!user || !isWindowOpen || !walletAddress || userAlreadyBid || !user.emailVerified}
                          isLoading={actionLoading === slot.id}
                          onClick={() => handlePlaceBid(slot)}
                        >
                          {userAlreadyBid
                            ? 'Bid Placed'
                            : !user
                            ? 'Log in to Bid'
                            : !isWindowOpen
                            ? 'Bidding Closed'
                            : !walletAddress
                            ? 'Connect Wallet'
                            : `Bid ${formatCSGN(bidPrice)}`}
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </Card>

            {/* CEO Schedule Slots */}
            <Card hover={false} className="p-5 space-y-4">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <Crown className="w-4 h-4 text-yellow-400" /> CEO Schedule
                <span className="text-xs text-gray-500 font-normal">7 PM – 3 AM ET</span>
              </h2>
              {ceoSlots.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">No CEO Schedule slots open for requests right now.</p>
              ) : (
                ceoSlots.map((slot) => {
                  const alreadyRequested = user ? slot.requests?.some((r) => r.uid === user.uid) : false
                  const myRequest = user ? slot.requests?.find((r) => r.uid === user.uid) : undefined

                  return (
                    <div key={slot.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-white font-medium">{slot.label}</p>
                          <p className="text-xs text-gray-500">
                            <Clock3 className="w-3 h-3 inline mr-1" />
                            Airs {formatDate(new Date(slot.startTime))}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="gold">{slot.requests?.length ?? 0} request{(slot.requests?.length ?? 0) !== 1 ? 's' : ''}</Badge>
                        </div>
                      </div>

                      {alreadyRequested ? (
                        <div className="p-2 bg-white/5 rounded-lg border border-white/10 text-xs">
                          <p className="text-gray-400">Request submitted:</p>
                          <p className="text-white mt-0.5">{myRequest?.message}</p>
                          <Badge
                            variant={myRequest?.status === 'accepted' ? 'green' : myRequest?.status === 'declined' ? 'red' : 'gold'}
                            className="mt-1"
                          >
                            {myRequest?.status}
                          </Badge>
                          {myRequest?.responseNote && (
                            <p className="text-gray-400 text-xs mt-1">Note: {myRequest.responseNote}</p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <textarea
                            value={requestMessages[slot.id] || ''}
                            onChange={(e) => setRequestMessages((prev) => ({ ...prev, [slot.id]: e.target.value }))}
                            placeholder="Tell us why you'd like this slot..."
                            rows={2}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50 resize-none"
                          />
                          <Button
                            variant="secondary"
                            size="sm"
                            className="w-full"
                            disabled={!user || !user.emailVerified || !requestMessages[slot.id]?.trim()}
                            isLoading={actionLoading === slot.id}
                            onClick={() => handleRequestSlot(slot)}
                          >
                            {!user ? 'Log in to Request' : 'Submit Request'}
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
              <p className="text-xs text-gray-500">
                CEO Schedule slots are admin-curated. Submit a request and you'll be notified in your Account page.
              </p>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
