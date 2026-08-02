import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Mail, Wallet, Trophy, Lock,
  CalendarCheck, Bell, AlertTriangle, CheckCircle2, Clock, Twitch, X as XIcon, Info,
  ChevronLeft, ChevronRight, Radio,
} from 'lucide-react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { useAuth } from '@/contexts/useAuth'
import type { UserNotification } from '@/contexts/AuthContext'
import { fetchSlotsByAssignee, type Slot } from '@/lib/slots'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import MemeVoteCard from '@/components/MemeVoteCard'
import GamesPanel from '@/components/account/GamesPanel'
import HolderPanel from '@/components/account/HolderPanel'
import RecommendedProfiles from '@/components/account/RecommendedProfiles'
import { Notice, EmailNotice, TwitchNotice } from '@/components/ui/Notice'
import { api } from '@/lib/api'
import { readTwitchProof, clearTwitchProof } from '@/lib/twitchProof'
import { Modal } from '@/components/ui/Modal'

/** One connection row. Renders the real state — a missing wallet reads as
 *  "Not connected", not as another green chip claiming otherwise. */
function Connection({
  Icon, label, value, connected, mono,
}: {
  Icon: typeof Mail
  label: string
  value?: string
  connected: boolean
  mono?: boolean
}) {
  return (
    <div className="flex items-center gap-2.5 min-w-0 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <Icon className={`w-4 h-4 shrink-0 ${connected ? 'text-gray-400' : 'text-gray-600'}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.14em] text-gray-500 leading-none">{label}</p>
        <p className={`mt-1 text-xs leading-snug truncate ${connected ? 'text-gray-200' : 'text-gray-600'} ${mono ? 'font-mono' : ''}`}>
          {connected ? (value || 'Connected') : 'Not connected'}
        </p>
      </div>
      {connected && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400/80" />}
    </div>
  )
}

export default function Dashboard() {
  const { user, profile, signIn, resendVerification, refreshProfile } = useAuth()
  const [resending, setResending] = useState(false)
  const [signInIdentifier, setSignInIdentifier] = useState('')
  const [signInPassword, setSignInPassword] = useState('')
  const [signInLoading, setSignInLoading] = useState(false)
  const [signInError, setSignInError] = useState('')
  const [slotHistory, setSlotHistory] = useState<Slot[]>([])
  const [liveEstimateSOL, setLiveEstimateSOL] = useState(0)
  const [liveEstimateUSD, setLiveEstimateUSD] = useState(0)
  const [liveVolumeSOL, setLiveVolumeSOL] = useState(0)
  const [slotInfo, setSlotInfo] = useState<Slot | null>(null)
  const [feePage, setFeePage] = useState(0)
  const [linking, setLinking] = useState(false)
  const [linkMsg, setLinkMsg] = useState('')
  const [linkErr, setLinkErr] = useState('')
  const upcomingSlots = useMemo(
    () => slotHistory.filter((s) => new Date(s.endTime).getTime() > Date.now()).slice(0, 6),
    [slotHistory],
  )

  const notifications: UserNotification[] = profile?.notifications || []
  const unreadCount = notifications.filter((n) => !n.read).length
  const payoutEstimateSOL = useMemo(
    () => slotHistory
      .filter((s) => s.assignedUid === user?.uid)
      .reduce((sum, s) => sum + (s.creatorFees?.feeOwedSOL || 0), 0),
    [slotHistory, user?.uid],
  )
  const liveAssignedSlot = useMemo(
    () => slotHistory.find((s) => Date.now() >= new Date(s.startTime).getTime() && Date.now() < new Date(s.endTime).getTime()) ?? null,
    [slotHistory],
  )

  // Creator Fee History — newest first, paginated 10 at a time so the page
  // stays clean; the back arrow walks toward older history.
  const FEE_PAGE_SIZE = 10
  const feeHistory = useMemo(
    () => slotHistory.slice().sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()),
    [slotHistory],
  )
  const feePageCount = Math.max(1, Math.ceil(feeHistory.length / FEE_PAGE_SIZE))
  const safeFeePage = Math.min(feePage, feePageCount - 1)
  const pagedFees = feeHistory.slice(safeFeePage * FEE_PAGE_SIZE, safeFeePage * FEE_PAGE_SIZE + FEE_PAGE_SIZE)

  // Social-profile stats (derived from the same slot history).
  const totalFeesUSD = useMemo(() => feeHistory.reduce((s, x) => s + (x.creatorFees?.feeOwedUSD || 0), 0), [feeHistory])
  const totalLiveMinutes = useMemo(() => feeHistory.reduce((s, x) => s + (x.streamActivity?.liveCheckCount || 0), 0), [feeHistory])


  // Finish a Twitch link started from this page. The OAuth callback drops a
  // proof in sessionStorage and returns here; we exchange it once and clear it,
  // so a refresh can't replay a spent proof.
  useEffect(() => {
    if (!user) return
    if (!sessionStorage.getItem('csgn:linkTwitchReturn')) return
    const proof = readTwitchProof()
    if (!proof) { sessionStorage.removeItem('csgn:linkTwitchReturn'); return }
    sessionStorage.removeItem('csgn:linkTwitchReturn')
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.linkTwitch(proof.proofToken)
        clearTwitchProof()
        if (cancelled) return
        setLinkMsg(res.alreadyLinked
          ? `Twitch already connected as ${res.twitch.displayName}.`
          : `Twitch connected as ${res.twitch.displayName}. You can claim slots now.`)
        await refreshProfile()
      } catch (err) {
        clearTwitchProof()
        if (!cancelled) setLinkErr(err instanceof Error ? err.message : 'Could not connect Twitch.')
      }
    })()
    return () => { cancelled = true }
  }, [user, refreshProfile])

  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        // Indexed query for just this user's slots (was: scan every slot
        // since 2020 and filter client-side). Newest 50 is plenty for the
        // 10-per-page fee history; keep the old "history + next 2 days" cap.
        const slots = await fetchSlotsByAssignee(user.uid, 50)
        const cutoff = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
        setSlotHistory(slots.filter((s) => s.startTime <= cutoff))
      } catch {
        setSlotHistory([])
      }
    })()
  }, [user])

  useEffect(() => {
    setLiveEstimateSOL(liveAssignedSlot?.creatorFees?.feeOwedSOL || 0)
    setLiveVolumeSOL(liveAssignedSlot?.creatorFees?.tradingVolumeSOL || 0)
    setLiveEstimateUSD(liveAssignedSlot?.creatorFees?.feeOwedUSD || 0)
  }, [liveAssignedSlot])


  const handleResend = async () => {
    setResending(true)
    try { await resendVerification(); setLinkMsg('Verification email sent — check your inbox.') }
    catch { setLinkErr('Could not send the verification email. Try again in a moment.') }
    finally { setResending(false) }
  }

  /**
   * Start the Twitch link. Full-page redirect, never a popup: Twitch's login
   * page offers "Sign in with Apple", and Apple refuses OAuth inside popups and
   * embedded webviews. A redirect is the only flow that survives every entry
   * point we actually see, including Phantom's in-app browser.
   */
  const handleConnectTwitch = async () => {
    setLinking(true); setLinkErr(''); setLinkMsg('')
    try {
      const { authUrl } = await api.startTwitchOAuth()
      sessionStorage.setItem('csgn:linkTwitchReturn', '1')
      window.location.href = authUrl
    } catch {
      setLinking(false)
      setLinkErr('Could not open Twitch. Please try again.')
    }
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
    const handleEmailSignIn = async (e: React.FormEvent) => {
      e.preventDefault()
      setSignInLoading(true)
      setSignInError('')
      try {
        await signIn(signInIdentifier, signInPassword)
      } catch (err: unknown) {
        const code = err instanceof Error && 'code' in err ? String((err as { code?: string }).code || '') : ''
        if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
          setSignInError('Invalid email/username or password.')
        } else if (code === 'auth/invalid-email') {
          setSignInError('Please enter a valid email address.')
        } else {
          setSignInError('Sign in failed. Please try again.')
        }
      } finally {
        setSignInLoading(false)
      }
    }

    return (
      <div className="min-h-screen pt-24 lg:pt-32 pb-24">
        <div className="max-w-md mx-auto px-4 space-y-4">
          <Card hover={false} className="p-6 border-red-500/25 bg-white/[0.03]">
            <h1 className="text-3xl font-display font-bold text-white mb-1">Sign in</h1>
            <p className="text-sm text-gray-400 mb-4">
Use your email/username and password to access your account.
            </p>

            <form onSubmit={handleEmailSignIn} className="space-y-3">
              {signInError && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {signInError}
                </div>
              )}
              <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" /><input type="text" value={signInIdentifier} onChange={(e) => setSignInIdentifier(e.target.value)} className="w-full pl-10 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50" placeholder="Email" required disabled={signInLoading} /></div>
              <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" /><input type="password" value={signInPassword} onChange={(e) => setSignInPassword(e.target.value)} className="w-full pl-10 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50" placeholder="Password" required minLength={6} disabled={signInLoading} /></div>
              <Button variant="primary" size="md" className="w-full" isLoading={signInLoading}>Sign In</Button>
            </form>
          </Card>
        </div>
      </div>
    )
  }

  const twitchLinked = Boolean(profile?.twitch?.verified)
  const savedWallet = profile?.phantom?.walletAddress || profile?.walletAddress
  const twitchDisplay = profile?.twitch?.displayName || profile?.twitch?.username || profile?.twitchUsername
  const displayName = profile?.displayName || profile?.username || 'CSGN Member'
  const handle = profile?.username || (profile?.email ? profile.email.split('@')[0] : 'member')
  const avatarUrl = profile?.twitch?.profileImageUrl || ''
  const initial = (displayName || '?').trim().charAt(0).toUpperCase() || '?'
  const role = profile?.role || 'viewer'
  const xp = profile?.xp ?? 0
  const stats: Array<[string, string]> = [
    ['XP', xp.toLocaleString()],
    ['Slots played', String(feeHistory.length)],
    ['Live minutes', totalLiveMinutes.toLocaleString()],
    ['Fees earned', `$${totalFeesUSD.toFixed(totalFeesUSD >= 100 ? 0 : 2)}`],
  ]

  return (
    <div className="min-h-screen pt-24 lg:pt-32 pb-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

        {/* ── Status notices ──
            The two things that gate the product, in the app's ONE notice shape.
            Both carry their own action: a notice that tells you to do something
            without a way to do it is a complaint. */}
        {(!user.emailVerified || !twitchLinked || linkMsg) && (
          <div className="space-y-3">
            {linkMsg && <Notice tone="success" compact>{linkMsg}</Notice>}
            {linkErr && <Notice tone="error" compact>{linkErr}</Notice>}
            {!user.emailVerified && (
              <EmailNotice
                action={
                  <Button variant="secondary" size="sm" isLoading={resending} onClick={handleResend}>
                    Resend email
                  </Button>
                }
              />
            )}
            {!twitchLinked && (
              <TwitchNotice
                action={
                  <Button variant="secondary" size="sm" isLoading={linking} onClick={handleConnectTwitch}>
                    Connect Twitch
                  </Button>
                }
              />
            )}
          </div>
        )}

        {/* ── Identity ──
            Flat surface, one hairline border, no gradient wash and no avatar
            overhanging a banner. The old header floated a 96px avatar up over a
            112px gradient strip, which collided with the name on narrow screens
            and read as decoration standing in for hierarchy. Everything here is
            in normal flow: it cannot overlap at any width, because nothing is
            positioned on top of anything. */}
        <section className="rounded-xl border border-white/[0.08] bg-white/[0.02]">
          <div className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-5">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover bg-white/[0.04] border border-white/[0.08] shrink-0" />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-2xl sm:text-3xl font-semibold text-gray-300 shrink-0">
                  {initial}
                </div>
              )}

              <div className="min-w-0 flex-1">
                {/* break-words, not truncate: a long display name should wrap
                    onto a second line rather than vanish into an ellipsis. */}
                <h1 className="text-xl sm:text-2xl font-semibold text-white leading-tight break-words">{displayName}</h1>
                <p className="text-sm text-gray-500 mt-0.5 break-all">@{handle}</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-md border border-white/[0.1] bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-gray-400">
                    {role}
                  </span>
                  {user.emailVerified && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                      <CheckCircle2 className="w-3 h-3" /> Verified
                    </span>
                  )}
                </div>
              </div>

              <div className="shrink-0 sm:pt-1">
                <Link to="/schedule" className="block"><Button size="sm" variant="secondary">Claim a slot</Button></Link>
              </div>
            </div>

            {/* Stats. `tabular-nums` keeps the columns from jittering, and the
                label sits under the value so a long label wraps into its own
                cell instead of pushing the number out of alignment. */}
            <dl className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-px rounded-lg overflow-hidden bg-white/[0.06]">
              {stats.map(([k, v]) => (
                <div key={k} className="bg-[#0a0a11] px-4 py-3">
                  <dd className="text-lg sm:text-xl font-semibold font-mono tabular-nums text-white leading-none">{v}</dd>
                  <dt className="mt-1.5 text-[11px] uppercase tracking-[0.12em] text-gray-500 leading-snug">{k}</dt>
                </div>
              ))}
            </dl>
          </div>

          {/* Connections — one row, each with an honest connected/missing state
              instead of three identical green chips regardless of reality. */}
          {/* Connections, including the member's own email.
              PRIVATE BY CONSTRUCTION: /account only ever renders the signed-in
              user's own profile, and the public projection
              (netlify/functions/publicProfiles.ts -> toPublicProfile) has no
              email field at all. So this address is visible here and nowhere
              else — not on /u/:username, not in the discovery rail, not in any
              API response another member can reach. */}
          <div className="border-t border-white/[0.06] px-5 sm:px-6 pt-4 pb-3 grid gap-2.5 sm:grid-cols-3">
            <Connection Icon={Twitch} label="Twitch" value={twitchDisplay} connected={twitchLinked} />
            <Connection Icon={Wallet} label="Wallet" value={savedWallet ? `${savedWallet.slice(0, 4)}…${savedWallet.slice(-4)}` : ''} connected={Boolean(savedWallet)} mono />
            <Connection Icon={Mail} label="Email" value={profile?.email} connected={Boolean(user.emailVerified)} />
          </div>
          <p className="px-5 sm:px-6 pb-4 text-[11px] text-gray-600 leading-relaxed">
            Only you can see your email address. It never appears on your public profile.
          </p>
        </section>

        {/* ── Games + holdings ──
            Side by side on desktop, stacked on mobile. This is the gamification
            surface: what you've won, and what your bag entitles you to next. */}
        <div className="grid gap-6 lg:grid-cols-2">
          <GamesPanel stats={profile?.gameStats} />
          <HolderPanel walletAddress={savedWallet} />
        </div>

        {/* Change your Meme-100 token vote from your profile, any time */}
        <MemeVoteCard />

        <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-white">Estimated creator-fee payout</h2>
          <p className="mt-2 text-2xl font-semibold font-mono tabular-nums text-white">
            {payoutEstimateSOL.toFixed(6)} <span className="text-sm font-sans font-normal text-gray-500">SOL</span>
          </p>
          {liveAssignedSlot && (
            <p className="mt-2 text-sm text-emerald-300 leading-snug">
              Live now ({new Date(liveAssignedSlot.startTime).toLocaleTimeString()}–{new Date(liveAssignedSlot.endTime).toLocaleTimeString()}):
              {' '}${liveEstimateUSD.toFixed(2)} ({liveEstimateSOL.toFixed(6)} SOL)
            </p>
          )}
          {liveAssignedSlot && liveVolumeSOL > 0 && (
            <p className="mt-1.5 text-xs text-gray-500 leading-relaxed break-words">
              {liveVolumeSOL.toFixed(4)} SOL × tier creator fee × 30% = {liveEstimateSOL.toFixed(6)} SOL
              {liveAssignedSlot.creatorFees?.marketCapTierLabel ? ` (${liveAssignedSlot.creatorFees.marketCapTierLabel})` : ''}
            </p>
          )}
          <p className="mt-3 text-xs text-gray-500 leading-relaxed">
            Estimate only. The final amount depends on post-slot volume and fee-tier assignment, is paid in
            equivalent $CSGN, and is subject to review — treat it as an indication, not a guaranteed transfer.
          </p>
        </section>

        <Card hover={false} className="p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-sm font-semibold text-white">Creator fee history</h2>
            {feeHistory.length > FEE_PAGE_SIZE && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <button
                  onClick={() => setFeePage((p) => Math.min(feePageCount - 1, p + 1))}
                  disabled={safeFeePage >= feePageCount - 1}
                  className="p-1 rounded border border-white/10 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Older"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono">Page {safeFeePage + 1} / {feePageCount}</span>
                <button
                  onClick={() => setFeePage((p) => Math.max(0, p - 1))}
                  disabled={safeFeePage <= 0}
                  className="p-1 rounded border border-white/10 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Newer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          <div className="mt-3 space-y-2">
            {feeHistory.length === 0 ? (
              <p className="text-sm text-gray-500">No assigned slot history yet.</p>
            ) : (
              pagedFees.map((slot) => {
                const activity = slot.streamActivity
                const liveMinutes = activity?.liveCheckCount ?? 0
                return (
                  <div key={slot.id} className="border border-white/[0.08] rounded-lg p-3">
                    {/* min-w-0 on both columns is what stops a long slot label
                        from shoving the figures off the card on a narrow phone. */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-white leading-snug break-words">{slot.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                          {new Date(slot.startTime).toLocaleString()} – {new Date(slot.endTime).toLocaleString()}
                        </p>
                        {activity && (
                          <p className={`text-[11px] mt-1.5 flex items-start gap-1 leading-snug ${liveMinutes > 0 ? 'text-emerald-400' : 'text-gray-500'}`}>
                            <Radio className="w-3 h-3 shrink-0 mt-px" />
                            <span>
                              {liveMinutes > 0
                                ? `Streamed ~${liveMinutes} min live${activity.lastLiveAt ? ` (last ${new Date(activity.lastLiveAt).toLocaleTimeString()})` : ''}`
                                : 'No live activity detected'}
                            </span>
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono tabular-nums text-sm text-white">{(slot.creatorFees?.feeOwedSOL || 0).toFixed(6)}</p>
                        <p className="font-mono tabular-nums text-xs text-gray-400 mt-0.5">${(slot.creatorFees?.feeOwedUSD || 0).toFixed(2)}</p>
                        {slot.creatorFees?.marketCapTierLabel && (
                          <p className="text-[11px] text-gray-600 mt-0.5">{slot.creatorFees.marketCapTierLabel}</p>
                        )}
                        <button onClick={() => setSlotInfo(slot)} className="mt-1 text-xs text-primary-400 hover:text-primary-300 inline-flex items-center gap-1 cursor-pointer">
                          <Info className="w-3 h-3" /> Details
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Card>

        {/* Notifications */}
        {notifications.length > 0 && (
          <Card hover={false} className="p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-gray-400" />
                Notifications
                {unreadCount > 0 && <Badge variant="red">{unreadCount} new</Badge>}
              </h2>
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

        {/* Your claimed slots — real data, straight from the schedule. This
            replaced two dead cards (auction bids, "CEO Schedule requests") that
            described mechanics the network no longer has. */}
        <Card hover={false} className="p-5">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Radio className="w-4 h-4 text-gray-400" /> Your upcoming slots
          </h2>
          <div className="mt-3 space-y-2">
            {upcomingSlots.length === 0 ? (
              <p className="text-sm text-gray-500 leading-relaxed">
                You don't have a slot booked. Every hour from 3 AM to 7 PM ET is open — claim one and you
                earn 30% of $CSGN's trading fees the whole time you're on air.
              </p>
            ) : (
              upcomingSlots.map((slot) => (
                <div key={slot.id} className="border border-white/[0.08] rounded-lg px-3 py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-white font-medium min-w-0 break-words">{slot.label}</span>
                    <span className="text-xs text-gray-500 shrink-0">{new Date(slot.startTime).toLocaleDateString()}</span>
                  </div>
                  {slot.streamTitle && (
                    <p className="text-xs text-gray-400 mt-1 leading-snug break-words">"{slot.streamTitle}"</p>
                  )}
                </div>
              ))
            )}
          </div>
          <Link to="/schedule" className="inline-block mt-3">
            <Button variant="secondary" size="sm">{upcomingSlots.length === 0 ? 'Claim a slot' : 'Claim another'}</Button>
          </Link>
        </Card>

        {/* Discovery — who else is here, and who can actually go live. */}
        <RecommendedProfiles excludeUsername={profile?.username} />
      </div>
      {slotInfo && (
        <Modal open onClose={() => setSlotInfo(null)} title="Fee Calculation">
          <div>
            <p className="text-xs text-gray-400 mt-2">Slot: {slotInfo.label}</p>
            <p className="text-xs text-gray-400">Volume (SOL): {(slotInfo.creatorFees?.tradingVolumeSOL || 0).toFixed(6)}</p>
            <p className="text-xs text-gray-400">Volume (USD): ${(slotInfo.creatorFees?.tradingVolumeUSD || 0).toFixed(2)}</p>
            <p className="text-xs text-gray-400">Latest market cap (SOL): {(slotInfo.creatorFees?.marketCapSOL || 0).toFixed(2)}</p>
            <p className="text-xs text-gray-400">Active tier: {slotInfo.creatorFees?.marketCapTierLabel || 'n/a'}</p>
            <p className="text-xs text-gray-400">Estimated streamer payout (SOL): {(slotInfo.creatorFees?.feeOwedSOL || 0).toFixed(6)}</p>
            <p className="text-xs text-gray-400">Estimated creator fee (USD): ${(slotInfo.creatorFees?.feeOwedUSD || 0).toFixed(2)}</p>
            {slotInfo.creatorFees?.tierFeeBreakdown && slotInfo.creatorFees.tierFeeBreakdown.length > 0 && (
              <div className="mt-2 border-t border-white/10 pt-2 space-y-1">
                <p className="text-xs text-gray-400">Tier breakdown</p>
                {slotInfo.creatorFees.tierFeeBreakdown.map((tier, idx) => (
                  <p key={`${slotInfo.id}-tier-${idx}`} className="text-[11px] text-gray-500">
                    {tier.marketCapRange}: volume {tier.volumeSOL.toFixed(4)} SOL, creator {(tier.creatorFeeRate * 100).toFixed(3)}%, streamer {tier.streamerFeeSOL.toFixed(6)} SOL
                  </p>
                ))}
              </div>
            )}
            {slotInfo.creatorFees?.marketCapCheckpoints && slotInfo.creatorFees.marketCapCheckpoints.length > 0 && (
              <p className="text-[11px] text-gray-500 mt-2">
                Market cap checks captured: {slotInfo.creatorFees.marketCapCheckpoints.length} (target cadence: every 15s during live slot).
              </p>
            )}
            <p className="text-xs text-gray-500 mt-2">
              Estimate derived from DexScreener pool-volume deltas and fee tiers. Final transfer is reviewed and paid in equivalent CSGN.
            </p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={() => setSlotInfo(null)}>Close</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
