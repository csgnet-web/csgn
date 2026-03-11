import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  User, Mail, Wallet, LogIn, UserPlus, Trophy,
  CalendarCheck, Bell, AlertTriangle, CheckCircle2, Clock, Crown, X as XIcon,
} from 'lucide-react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { useAuth, type UserNotification } from '@/contexts/AuthContext'
import { usePhantomWallet } from '@/hooks/usePhantomWallet'
import { queueStore } from '@/lib/queue'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export default function Dashboard() {
  const { user, profile, signIn, signUp, resendVerification, refreshProfile } = useAuth()
  const { walletAddress, balance, connect, disconnect, isConnecting, error } = usePhantomWallet()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [authError, setAuthError] = useState('')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [xHandle, setXHandle] = useState(profile?.socialLinks?.twitter || '')
  const [verificationSent, setVerificationSent] = useState(false)
  const [resending, setResending] = useState(false)
  const [savingWallet, setSavingWallet] = useState(false)
  const [savingHandle, setSavingHandle] = useState(false)

  const bids = useMemo(() => user ? queueStore.getBids().filter((bid) => bid.uid === user.uid) : [], [user])
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

  const handleSaveWallet = async () => {
    if (!user || !walletAddress) return
    setSavingWallet(true)
    try {
      await updateDoc(doc(db, 'users', user.uid), { walletAddress })
      await refreshProfile()
    } catch (err) {
      console.warn('Failed to save wallet address:', err)
    }
    setSavingWallet(false)
  }

  const handleConnectAndSave = async () => {
    await connect()
    // wallet address will be set after connect — save happens via useEffect below
  }

  const handleSaveHandle = async () => {
    if (!user) return
    setSavingHandle(true)
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        'socialLinks.twitter': xHandle.replace(/^@/, ''),
      })
      await refreshProfile()
    } catch (err) {
      console.warn('Failed to save X handle:', err)
    }
    setSavingHandle(false)
  }

  const handleDismissNotification = async (notifId: string) => {
    if (!user) return
    const updatedNotifs = notifications.filter((n) => n.id !== notifId)
    try {
      await updateDoc(doc(db, 'users', user.uid), { notifications: updatedNotifs })
      await refreshProfile()
    } catch (err) {
      console.warn('Failed to dismiss notification:', err)
    }
  }

  const handleMarkAllRead = async () => {
    if (!user) return
    const updatedNotifs = notifications.map((n) => ({ ...n, read: true }))
    try {
      await updateDoc(doc(db, 'users', user.uid), { notifications: updatedNotifs })
      await refreshProfile()
    } catch (err) {
      console.warn('Failed to mark notifications read:', err)
    }
  }

  // Notification icon mapping
  const notifIcon = (type: UserNotification['type']) => {
    switch (type) {
      case 'auction_won': return <Trophy className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
      case 'prime_assigned': return <CalendarCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
      case 'slot_request_accepted': return <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
      case 'slot_request_declined': return <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
      case 'fee_paid': return <Wallet className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
      case 'fee_declined': return <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
      default: return <Bell className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
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
                <p className="text-xs text-gray-500 mb-5">You can browse CSGN while unverified, but verification is required to bid and submit requests.</p>
                <Button variant="primary" size="md" className="w-full" onClick={() => setVerificationSent(false)}>
                  Sign in to continue
                </Button>
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-display font-bold text-white mb-1">Account</h1>
                <p className="text-sm text-gray-400 mb-5">Sign in to access bidding, CEO Schedule requests, and slot management.</p>
                <div className="flex gap-2 mb-4">
                  <Button variant={mode === 'login' ? 'primary' : 'secondary'} size="sm" onClick={() => setMode('login')}>
                    <LogIn className="w-3.5 h-3.5" /> Sign In
                  </Button>
                  <Button variant={mode === 'signup' ? 'primary' : 'secondary'} size="sm" onClick={() => setMode('signup')}>
                    <UserPlus className="w-3.5 h-3.5" /> Create Account
                  </Button>
                </div>
                <form onSubmit={onSubmit} className="space-y-3">
                  {mode === 'signup' && (
                    <input type="text" placeholder="Display name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                  )}
                  <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                  <input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                  {authError && <p className="text-xs text-red-300">{authError}</p>}
                  <Button variant="primary" size="md" className="w-full" isLoading={loading}>
                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                  </Button>
                </form>
              </>
            )}
          </Card>
        </div>
      </div>
    )
  }

  const savedWallet = profile?.walletAddress
  const walletMismatch = savedWallet && walletAddress && savedWallet !== walletAddress

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
                <p className="text-xs text-gray-400">Please verify your email to bid on auction slots and submit CEO Schedule requests.</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                isLoading={resending}
                onClick={async () => {
                  setResending(true)
                  try { await resendVerification() } catch {}
                  setResending(false)
                }}
              >
                Resend
              </Button>
            </div>
          </Card>
        )}

        {/* Profile card */}
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

          {/* Wallet connection */}
          <div className="mt-4 space-y-3">
            {walletAddress ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="purple">
                  <Wallet className="w-3 h-3" /> {walletAddress.slice(0, 6)}...{walletAddress.slice(-6)}{' '}
                  {balance !== null ? `(${balance.toFixed(3)} SOL)` : ''}
                </Badge>
                <Button variant="ghost" size="sm" onClick={disconnect}>Disconnect</Button>
                {(!savedWallet || walletMismatch) && (
                  <Button
                    variant="secondary"
                    size="sm"
                    isLoading={savingWallet}
                    onClick={handleSaveWallet}
                  >
                    {walletMismatch ? 'Update Wallet' : 'Save Wallet'}
                  </Button>
                )}
                {savedWallet && !walletMismatch && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Wallet saved
                  </span>
                )}
              </div>
            ) : (
              <Button variant="primary" size="sm" onClick={handleConnectAndSave} isLoading={isConnecting}>
                Connect Phantom Wallet
              </Button>
            )}

            {savedWallet && (
              <p className="text-xs text-gray-500 font-mono flex items-center gap-1">
                <Wallet className="w-3 h-3" /> Saved: {savedWallet.slice(0, 8)}...{savedWallet.slice(-6)}
              </p>
            )}

            {/* X / Twitter connection */}
            <div className="space-y-2">
              {profile?.socialLinks?.twitter ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-2 px-3 py-1.5 bg-black border border-white/20 rounded-lg text-sm text-white">
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    @{profile.socialLinks.twitter}
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      value={xHandle}
                      onChange={(e) => setXHandle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveHandle()}
                      placeholder="Update handle"
                      className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-white w-32"
                    />
                    <Button variant="secondary" size="sm" isLoading={savingHandle} onClick={handleSaveHandle}>
                      Update
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    disabled
                    title="X OAuth coming soon — enter your handle manually below"
                    className="flex items-center gap-2 px-4 py-2 bg-black border border-white/10 rounded-lg text-sm font-semibold text-gray-500 cursor-not-allowed opacity-50"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    Connect X Account
                    <span className="text-[10px] font-normal bg-white/10 px-1.5 py-0.5 rounded">Coming Soon</span>
                  </button>
                  <span className="text-xs text-gray-500">enter handle manually:</span>
                  <input
                    value={xHandle}
                    onChange={(e) => setXHandle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveHandle()}
                    placeholder="@handle"
                    className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white w-36"
                  />
                  <Button variant="secondary" size="sm" isLoading={savingHandle} onClick={handleSaveHandle}>
                    Save
                  </Button>
                </div>
              )}
            </div>
          </div>

          {error && <p className="text-xs text-red-300 mt-2">{error}</p>}
        </Card>

        {/* Notifications */}
        {notifications.length > 0 && (
          <Card hover={false} className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" />
                Notifications
                {unreadCount > 0 && <Badge variant="red">{unreadCount} new</Badge>}
              </h3>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white text-xs" onClick={handleMarkAllRead}>
                  Mark all read
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {notifications.slice(0, 10).map((n) => (
                <div key={n.id} className={`rounded-xl border p-3 text-sm ${n.read ? 'border-white/5 bg-white/[0.01]' : 'border-primary-500/20 bg-primary-500/5'}`}>
                  <div className="flex items-start gap-2">
                    {notifIcon(n.type)}
                    <div className="flex-1">
                      <p className="text-gray-300">{n.message}</p>
                      {n.depositDeadline && (
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant="gold"><Clock className="w-3 h-3" /> Deadline: {new Date(n.depositDeadline).toLocaleTimeString()}</Badge>
                        </div>
                      )}
                      <p className="text-xs text-gray-600 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                    </div>
                    <button
                      onClick={() => handleDismissNotification(n.id)}
                      className="ml-1 p-1 text-gray-600 hover:text-gray-300 rounded transition-colors cursor-pointer shrink-0"
                      title="Dismiss"
                    >
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* My Bids */}
          <Card hover={false} className="p-5">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Trophy className="w-4 h-4 text-red-400" /> My Bids (CSGN)
            </h3>
            <div className="mt-3 space-y-2">
              {bids.length === 0 ? (
                <p className="text-sm text-gray-500">No bids yet. Place bids from Queue.</p>
              ) : (
                bids.slice(0, 6).map((bid) => (
                  <div key={bid.id} className="text-sm text-gray-300 border border-white/10 rounded-lg p-2">
                    <p className="text-white">{bid.slotLabel}</p>
                    <p>{bid.amount.toLocaleString()} CSGN · {bid.status}</p>
                  </div>
                ))
              )}
            </div>
            <Link to="/queue" className="inline-block mt-3">
              <Button variant="secondary" size="sm">Go to Queue</Button>
            </Link>
          </Card>

          {/* CEO Schedule / Assigned Slots */}
          <Card hover={false} className="p-5">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Crown className="w-4 h-4 text-yellow-400" /> CEO Schedule Slots
            </h3>
            <div className="mt-3 space-y-2">
              {assigned.length === 0 ? (
                <p className="text-sm text-gray-500">No assigned slots. Submit a CEO Schedule request from Queue.</p>
              ) : (
                assigned.slice(0, 6).map((slot) => (
                  <div key={slot.id} className="text-sm text-gray-300 border border-white/10 rounded-lg p-2">
                    <p className="text-white">{slot.slotLabel}</p>
                    <p>{new Date(slot.slotStart).toLocaleString()}</p>
                  </div>
                ))
              )}
            </div>
            <Link to="/queue" className="inline-block mt-3">
              <Button variant="secondary" size="sm">Request a Slot</Button>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  )
}
