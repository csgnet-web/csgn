import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { User, Mail, Wallet, Twitter, LogIn, UserPlus, Trophy, Ticket, CalendarCheck, Bell, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { useAuth, type UserNotification } from '@/contexts/AuthContext'
import { usePhantomWallet } from '@/hooks/usePhantomWallet'
import { queueStore } from '@/lib/queue'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export default function Dashboard() {
  const { user, profile, signIn, signUp, resendVerification } = useAuth()
  const { walletAddress, balance, connect, disconnect, isConnecting, error } = usePhantomWallet()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [authError, setAuthError] = useState('')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [xHandle, setXHandle] = useState(profile?.socialLinks?.twitter || '')
  const [verificationSent, setVerificationSent] = useState(false)
  const [resending, setResending] = useState(false)

  const bids = useMemo(() => user ? queueStore.getBids().filter((bid) => bid.uid === user.uid) : [], [user])
  const lottery = useMemo(() => user ? queueStore.getLotteryEntries().filter((entry) => entry.uid === user.uid) : [], [user])
  const assigned = useMemo(() => user ? queueStore.getAssignedSlots().filter((slot) => slot.uid === user.uid) : [], [user])

  const notifications: UserNotification[] = profile?.notifications || []
  const unreadCount = notifications.filter((n) => !n.read).length

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setAuthError('')
    try {
      if (mode === 'login') {
        await signIn(form.email, form.password)
      } else {
        await signUp(form.email, form.password, form.name || 'CSGN Viewer')
        setVerificationSent(true)
      }
    } catch {
      setAuthError('Authentication failed. Please verify your credentials.')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen pt-24 lg:pt-32 pb-24">
        <div className="max-w-md mx-auto px-4">
          <Card hover={false} className="p-6 border-red-500/25 bg-white/[0.03]">
            {verificationSent ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-display font-bold text-white mb-2">Check Your Email</h2>
                <p className="text-sm text-gray-400 mb-4">
                  A verification link has been sent to <span className="text-white font-medium">{form.email}</span>.
                </p>
                <p className="text-xs text-gray-500 mb-5">You can browse CSGN while unverified, but verification is required to bid and enter lotteries.</p>
                <Button variant="primary" size="md" className="w-full" onClick={() => setVerificationSent(false)}>
                  Sign in to continue
                </Button>
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-display font-bold text-white mb-1">Account</h1>
                <p className="text-sm text-gray-400 mb-5">Use your account as the login point for Apply, Queue, and slot management.</p>
                <div className="flex gap-2 mb-4">
                  <Button variant={mode === 'login' ? 'primary' : 'secondary'} size="sm" onClick={() => setMode('login')}><LogIn className="w-3.5 h-3.5" /> Sign In</Button>
                  <Button variant={mode === 'signup' ? 'primary' : 'secondary'} size="sm" onClick={() => setMode('signup')}><UserPlus className="w-3.5 h-3.5" /> Create Account</Button>
                </div>
                <form onSubmit={onSubmit} className="space-y-3">
                  {mode === 'signup' && (
                    <input type="text" placeholder="Display name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                  )}
                  <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                  <input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                  {authError && <p className="text-xs text-red-300">{authError}</p>}
                  <Button variant="primary" size="md" className="w-full" isLoading={loading}>{mode === 'login' ? 'Sign In' : 'Create Account'}</Button>
                </form>
              </>
            )}
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-24 lg:pt-32 pb-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

        {/* Email verification banner */}
        {!user.emailVerified && (
          <Card hover={false} className="p-4 bg-amber-500/5 border-amber-500/20">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-white font-medium">Email not verified</p>
                <p className="text-xs text-gray-400">Please verify your email to bid on auction slots and enter lotteries.</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                isLoading={resending}
                onClick={async () => {
                  setResending(true)
                  try { await resendVerification() } catch { /* ignore */ }
                  setResending(false)
                }}
              >
                Resend
              </Button>
            </div>
          </Card>
        )}

        <Card hover={false} className="p-6 bg-white/[0.03] border-red-500/25">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold text-white">Account Hub</h1>
              <div className="mt-2 space-y-1 text-sm text-gray-300">
                <p className="flex items-center gap-2"><User className="w-4 h-4 text-red-400" /> {profile?.displayName || 'Viewer'}</p>
                <p className="flex items-center gap-2"><Mail className="w-4 h-4 text-red-400" /> {profile?.email}</p>
              </div>
            </div>
            <Badge variant="blue">{profile?.role || 'viewer'}</Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {walletAddress ? (
              <>
                <Badge variant="purple"><Wallet className="w-3 h-3" /> {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)} {balance !== null ? `(${balance.toFixed(3)} SOL)` : ''}</Badge>
                <Button variant="ghost" size="sm" onClick={disconnect}>Disconnect Phantom</Button>
              </>
            ) : (
              <Button variant="primary" size="sm" onClick={connect} isLoading={isConnecting}>Connect Phantom Wallet</Button>
            )}
            <div className="flex items-center gap-2">
              <Twitter className="w-4 h-4 text-gray-400" />
              <input value={xHandle} onChange={(e) => setXHandle(e.target.value)} placeholder="Connect X (@handle)" className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white" />
            </div>
          </div>
          {error && <p className="text-xs text-red-300 mt-2">{error}</p>}
        </Card>

        {/* Notifications */}
        {notifications.length > 0 && (
          <Card hover={false} className="p-5">
            <h3 className="text-white font-semibold flex items-center gap-2 mb-4">
              <Bell className="w-4 h-4 text-amber-400" />
              Notifications
              {unreadCount > 0 && <Badge variant="red">{unreadCount} new</Badge>}
            </h3>
            <div className="space-y-2">
              {notifications.slice(0, 8).map((n) => (
                <div key={n.id} className={`rounded-xl border p-3 text-sm ${n.read ? 'border-white/5 bg-white/[0.01]' : 'border-primary-500/20 bg-primary-500/5'}`}>
                  <div className="flex items-start gap-2">
                    {n.type === 'auction_won' && <Trophy className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />}
                    {n.type === 'lottery_selected' && <Ticket className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />}
                    {n.type === 'prime_assigned' && <CalendarCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />}
                    <div className="flex-1">
                      <p className="text-gray-300">{n.message}</p>
                      {n.depositRequired && n.depositDeadline && (
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant="gold"><Clock className="w-3 h-3" /> Deposit {n.depositRequired} SOL by {new Date(n.depositDeadline).toLocaleTimeString()}</Badge>
                        </div>
                      )}
                      <p className="text-xs text-gray-600 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <Card hover={false} className="p-5">
            <h3 className="text-white font-semibold flex items-center gap-2"><Trophy className="w-4 h-4 text-red-400" /> My Bids</h3>
            <div className="mt-3 space-y-2">
              {bids.length === 0 ? <p className="text-sm text-gray-500">No bids yet. Place bids from Queue.</p> : bids.slice(0, 6).map((bid) => (
                <div key={bid.id} className="text-sm text-gray-300 border border-white/10 rounded-lg p-2">
                  <p className="text-white">{bid.slotLabel}</p>
                  <p>{bid.amount.toFixed(3)} SOL · {bid.status}</p>
                </div>
              ))}
            </div>
            <Link to="/queue" className="inline-block mt-3"><Button variant="secondary" size="sm">Go to Queue</Button></Link>
          </Card>

          <Card hover={false} className="p-5">
            <h3 className="text-white font-semibold flex items-center gap-2"><Ticket className="w-4 h-4 text-purple-400" /> Lottery Entries</h3>
            <div className="mt-3 space-y-2">
              {lottery.length === 0 ? <p className="text-sm text-gray-500">No lottery entries yet.</p> : lottery.slice(0, 6).map((entry) => (
                <div key={entry.id} className="text-sm text-gray-300 border border-white/10 rounded-lg p-2">
                  <p className="text-white">{entry.slotLabel}</p>
                  <p>{entry.status} · {new Date(entry.slotStart).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card hover={false} className="p-5">
            <h3 className="text-white font-semibold flex items-center gap-2"><CalendarCheck className="w-4 h-4 text-emerald-400" /> Assigned by Admin</h3>
            <div className="mt-3 space-y-2">
              {assigned.length === 0 ? <p className="text-sm text-gray-500">No assigned slots yet.</p> : assigned.slice(0, 6).map((slot) => (
                <div key={slot.id} className="text-sm text-gray-300 border border-white/10 rounded-lg p-2">
                  <p className="text-white">{slot.slotLabel}</p>
                  <p>{new Date(slot.slotStart).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
