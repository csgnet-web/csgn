import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Gavel, Ticket, Wallet, Clock3 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { usePhantomWallet } from '@/hooks/usePhantomWallet'
import { queueStore } from '@/lib/queue'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

interface QueueSlot {
  id: string
  type: 'auction' | 'lottery'
  label: string
  startAt: Date
}

const baseStart = 0.03

function formatDate(date: Date) {
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function Queue() {
  const { user } = useAuth()
  const { walletAddress, balance, connect, isConnecting, error } = usePhantomWallet()
  const [bids, setBids] = useState(queueStore.getBids())
  const [lotteryEntries, setLotteryEntries] = useState(queueStore.getLotteryEntries())

  const { slots, nowTs } = useMemo(() => {
    const now = new Date().getTime()
    const generated = Array.from({ length: 8 }, (_, i) => {
      const startAt = new Date(now + (8 + i * 2) * 60 * 60 * 1000)
      return {
        id: `slot-${i}`,
        label: `${startAt.toLocaleTimeString([], { hour: 'numeric' })} Slot`,
        startAt,
        type: i < 5 ? 'auction' as const : 'lottery' as const,
      }
    })

    return { slots: generated, nowTs: now }
  }, [])

  if (!user) return <Navigate to="/account" replace />

  return (
    <div className="min-h-screen pt-24 lg:pt-32 pb-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <Card hover={false} className="p-5 bg-white/5 border-red-500/20">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold text-white">Queue & Bidding</h1>
              <p className="text-sm text-gray-400 mt-1">Auction starts 24h before each slot and closes 2h before air time. Bids follow a bonding-curve minimum from 0.03 SOL.</p>
            </div>
            <div className="flex items-center gap-2">
              {walletAddress ? (
                <Badge variant="purple"><Wallet className="w-3 h-3" /> {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)} {balance !== null ? `(${balance.toFixed(3)} SOL)` : ''}</Badge>
              ) : (
                <Button variant="primary" size="sm" onClick={connect} isLoading={isConnecting}>Connect Phantom</Button>
              )}
            </div>
          </div>
          {error && <p className="text-xs text-red-300 mt-2">{error}</p>}
        </Card>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card hover={false} className="p-5 space-y-4">
            <h2 className="text-white font-semibold flex items-center gap-2"><Gavel className="w-4 h-4 text-red-400" /> Auction Slots</h2>
            {slots.filter((s) => s.type === 'auction').map((slot, index) => {
              const existingBids = bids.filter((bid) => bid.slotId === slot.id)
              const minimumBid = Number((baseStart + 0.005 * Math.pow(existingBids.length, 1.35)).toFixed(3))
              const opensAt = slot.startAt.getTime() - 24 * 60 * 60 * 1000
              const closesAt = slot.startAt.getTime() - 2 * 60 * 60 * 1000
              const isWindowOpen = nowTs >= opensAt && nowTs <= closesAt

              return <BidComposer
                key={slot.id}
                slot={slot}
                minimumBid={minimumBid}
                isWindowOpen={isWindowOpen}
                canBid={Boolean(walletAddress)}
                onPlaceBid={(amount) => {
                  if (!user) return
                  const bid = {
                    id: crypto.randomUUID(),
                    uid: user.uid,
                    slotId: slot.id,
                    slotLabel: slot.label,
                    slotStart: slot.startAt.toISOString(),
                    amount,
                    status: 'pending' as const,
                    createdAt: new Date().toISOString(),
                  }
                  queueStore.saveBid(bid)
                  setBids(queueStore.getBids())
                }}
                badge={index === 0 ? 'Soonest' : undefined}
              />
            })}
          </Card>

          <Card hover={false} className="p-5 space-y-4">
            <h2 className="text-white font-semibold flex items-center gap-2"><Ticket className="w-4 h-4 text-purple-400" /> Lottery Slots</h2>
            {slots.filter((s) => s.type === 'lottery').map((slot) => {
              const opensAt = slot.startAt.getTime() - 24 * 60 * 60 * 1000
              const closesAt = slot.startAt.getTime() - 2 * 60 * 60 * 1000
              const isWindowOpen = nowTs >= opensAt && nowTs <= closesAt
              const dayKey = slot.startAt.toISOString().split('T')[0]
              const todayEntry = lotteryEntries.find((entry) => entry.uid === user.uid && entry.dayKey === dayKey)

              return (
                <div key={slot.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-white font-medium">{slot.label}</p>
                      <p className="text-xs text-gray-500">Draw window: {formatDate(new Date(opensAt))} → {formatDate(new Date(closesAt))}</p>
                    </div>
                    <Badge variant="purple">Lottery</Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-gray-400">Limit 1 lottery entry per day per account.</p>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!isWindowOpen || Boolean(todayEntry)}
                      onClick={() => {
                        const entry = {
                          id: crypto.randomUUID(),
                          uid: user.uid,
                          slotId: slot.id,
                          slotLabel: slot.label,
                          slotStart: slot.startAt.toISOString(),
                          dayKey,
                          status: 'pending' as const,
                          createdAt: new Date().toISOString(),
                        }
                        queueStore.saveLotteryEntry(entry)
                        setLotteryEntries(queueStore.getLotteryEntries())
                      }}
                    >
                      {todayEntry ? 'Applied Today' : isWindowOpen ? 'Join Lottery' : 'Window Closed'}
                    </Button>
                  </div>
                </div>
              )
            })}
            <p className="text-xs text-gray-500">Lottery selections are finalized after close and emailed to selected users.</p>
          </Card>
        </div>
      </div>
    </div>
  )
}

function BidComposer({ slot, minimumBid, isWindowOpen, canBid, onPlaceBid, badge }: {
  slot: QueueSlot
  minimumBid: number
  isWindowOpen: boolean
  canBid: boolean
  onPlaceBid: (amount: number) => void
  badge?: string
}) {
  const [amount, setAmount] = useState(minimumBid.toFixed(3))

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-white font-medium">{slot.label}</p>
          <p className="text-xs text-gray-500 flex items-center gap-1"><Clock3 className="w-3 h-3" /> Airs {formatDate(slot.startAt)}</p>
        </div>
        <div className="flex gap-2">{badge && <Badge variant="blue">{badge}</Badge>}<Badge variant="default">Min {minimumBid.toFixed(3)} SOL</Badge></div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          type="number"
          step="0.001"
          min={minimumBid}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white"
        />
        <Button
          variant="primary"
          size="sm"
          disabled={!isWindowOpen || !canBid || Number(amount) < minimumBid}
          onClick={() => onPlaceBid(Number(amount))}
        >
          {isWindowOpen ? 'Place Bid' : 'Window Closed'}
        </Button>
      </div>
      <p className="mt-2 text-xs text-gray-500">Funds are only transferred if your bid wins.</p>
    </div>
  )
}
