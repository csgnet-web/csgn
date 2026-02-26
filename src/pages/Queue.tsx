import { useState, useEffect, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { Gavel, Ticket, Wallet, Clock3, AlertTriangle, TrendingUp } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { usePhantomWallet } from '@/hooks/usePhantomWallet'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  fetchSlots,
  placeBid,
  enterLottery,
  getMinimumBid,
  type Slot,
} from '@/lib/slots'

function formatDate(date: Date) {
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function Queue() {
  const { user, profile } = useAuth()
  const { walletAddress, balance, connect, isConnecting, error: walletError } = usePhantomWallet()
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

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

  if (!user) return <Navigate to="/account" replace />

  const now = Date.now()
  const auctionSlots = slots.filter((s) => s.type === 'auction' && s.status === 'open')
  const lotterySlots = slots.filter((s) => s.type === 'lottery' && s.status === 'open')

  const handlePlaceBid = async (slot: Slot) => {
    if (!user || !profile || !walletAddress) return
    setActionError(null)
    setActionLoading(slot.id)

    const bidAmount = getMinimumBid(slot.bids.length)

    try {
      // Request SOL transfer via Phantom
      const provider = window.solana
      if (!provider?.isPhantom) {
        setActionError('Phantom wallet not detected.')
        setActionLoading(null)
        return
      }

      // Encode a transfer instruction to the CSGN treasury
      // For MVP we use Phantom's signAndSendTransaction with a system transfer
      const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = await import('@solana/web3.js')
      const connection = new Connection('https://api.mainnet-beta.solana.com')

      const TREASURY_PUBKEY = new PublicKey('CSGNUgUpBqTNM7EBZSMeA5jzPLFNR2hELhLjbHLpbEY4')
      const lamports = Math.round(bidAmount * LAMPORTS_PER_SOL)

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(walletAddress),
          toPubkey: TREASURY_PUBKEY,
          lamports,
        })
      )

      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = new PublicKey(walletAddress)

      const signed = await (provider as any).signAndSendTransaction(transaction)
      await connection.confirmTransaction(signed.signature)

      // Record the bid in Firestore
      await placeBid(slot.id, {
        uid: user.uid,
        displayName: profile.displayName || 'User',
        amount: bidAmount,
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

  const handleEnterLottery = async (slot: Slot) => {
    if (!user) return
    setActionError(null)
    setActionLoading(slot.id)

    try {
      await enterLottery(slot.id, user.uid)
      await loadSlots()
    } catch (err: any) {
      setActionError(err?.message || 'Failed to enter lottery.')
    }
    setActionLoading(null)
  }

  return (
    <div className="min-h-screen pt-24 lg:pt-32 pb-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <Card hover={false} className="p-5 bg-white/5 border-red-500/20">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold text-white">Queue & Bidding</h1>
              <p className="text-sm text-gray-400 mt-1">Auction opens 24h before each slot and closes 2h before air time. Bid price follows a quadratic curve.</p>
            </div>
            <div className="flex items-center gap-2">
              {walletAddress ? (
                <Badge variant="purple"><Wallet className="w-3 h-3" /> {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)} {balance !== null ? `(${balance.toFixed(3)} SOL)` : ''}</Badge>
              ) : (
                <Button variant="primary" size="sm" onClick={connect} isLoading={isConnecting}>Connect Phantom</Button>
              )}
            </div>
          </div>
          {walletError && <p className="text-xs text-red-300 mt-2">{walletError}</p>}
          {actionError && (
            <div className="mt-3 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {actionError}
            </div>
          )}
        </Card>

        {!user.emailVerified && (
          <Card hover={false} className="p-4 bg-amber-500/5 border-amber-500/20">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <p className="text-sm text-gray-300">Verify your email to place bids and enter lotteries.</p>
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
              <h2 className="text-white font-semibold flex items-center gap-2"><Gavel className="w-4 h-4 text-red-400" /> Auction Slots</h2>
              {auctionSlots.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">No auction slots open right now. Check back soon.</p>
              ) : (
                auctionSlots.map((slot, index) => {
                  const bidPrice = getMinimumBid(slot.bids.length)
                  const closesAt = new Date(slot.startTime).getTime() - 2 * 60 * 60 * 1000
                  const isWindowOpen = now <= closesAt
                  const userAlreadyBid = slot.bids.some((b) => b.uid === user.uid)

                  return (
                    <div key={slot.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-white font-medium">{slot.label}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1"><Clock3 className="w-3 h-3" /> Airs {formatDate(new Date(slot.startTime))}</p>
                        </div>
                        <div className="flex gap-2">
                          {index === 0 && <Badge variant="blue">Soonest</Badge>}
                          <Badge variant="default">{slot.bids.length} bid{slot.bids.length !== 1 ? 's' : ''}</Badge>
                        </div>
                      </div>

                      {/* Quadratic curve visualization */}
                      <div className="mt-3 p-3 bg-white/[0.03] rounded-lg border border-white/5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-400 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Bid Price (Quadratic Curve)</span>
                          <span className="text-xs text-gray-500">y = 0.03 + 0.005x²</span>
                        </div>
                        <div className="text-2xl font-bold font-mono text-white">{bidPrice.toFixed(4)} <span className="text-sm text-gray-400">SOL</span></div>
                        <p className="text-xs text-gray-600 mt-1">Price is fixed based on current bid count. Next bid: {getMinimumBid(slot.bids.length + 1).toFixed(4)} SOL</p>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-xs text-gray-500">SOL is transferred via Phantom on bid.</p>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={!isWindowOpen || !walletAddress || userAlreadyBid || !user.emailVerified}
                          isLoading={actionLoading === slot.id}
                          onClick={() => handlePlaceBid(slot)}
                        >
                          {userAlreadyBid ? 'Bid Placed' : !isWindowOpen ? 'Bidding Closed' : `Bid ${bidPrice.toFixed(4)} SOL`}
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </Card>

            {/* Lottery Slots */}
            <Card hover={false} className="p-5 space-y-4">
              <h2 className="text-white font-semibold flex items-center gap-2"><Ticket className="w-4 h-4 text-purple-400" /> Lottery Slots</h2>
              {lotterySlots.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">No lottery slots open right now. Check back soon.</p>
              ) : (
                lotterySlots.map((slot) => {
                  const closesAt = new Date(slot.startTime).getTime() - 2 * 60 * 60 * 1000
                  const isWindowOpen = now <= closesAt
                  const alreadyEntered = slot.lotteryEntrants.includes(user.uid)

                  return (
                    <div key={slot.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-white font-medium">{slot.label}</p>
                          <p className="text-xs text-gray-500">Closes {formatDate(new Date(closesAt))}</p>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="purple">{slot.lotteryEntrants.length} entr{slot.lotteryEntrants.length !== 1 ? 'ies' : 'y'}</Badge>
                          <Badge variant="green">Free</Badge>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-xs text-gray-400">Lottery is free — winner selected 2h before air.</p>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!isWindowOpen || alreadyEntered || !user.emailVerified}
                          isLoading={actionLoading === slot.id}
                          onClick={() => handleEnterLottery(slot)}
                        >
                          {alreadyEntered ? 'Entered' : isWindowOpen ? 'Join Lottery' : 'Window Closed'}
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
              <p className="text-xs text-gray-500">Lottery winners are selected automatically and notified in their Account page.</p>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
