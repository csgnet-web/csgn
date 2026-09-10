import { useCallback, useMemo, useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Mail, Wallet, Trophy, Lock,
  CalendarCheck, Bell, AlertTriangle, CheckCircle2, Clock, Twitch, X as XIcon, Info,
  ChevronLeft, ChevronRight, Radio, Pencil,
} from 'lucide-react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { useAuth } from '@/contexts/useAuth'
import type { UserNotification } from '@/contexts/AuthContext'
import { fetchSlotsByAssignee, type Slot } from '@/lib/slots'
import { airtimeLabel, airtimeNote, airtimeTone, liveDuration, readAirtime } from '@/lib/airtime'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import MemeVoteCard from '@/components/MemeVoteCard'
import HolderPanel from '@/components/account/HolderPanel'
import RecommendedProfiles from '@/components/account/RecommendedProfiles'
import { Notice, EmailNotice, TwitchNotice } from '@/components/ui/Notice'
import { api } from '@/lib/api'
import { readTwitchProof, clearTwitchProof } from '@/lib/twitchProof'
import { storeAuthReturn } from '@/lib/authReturn'
import { useTwitchLink } from '@/hooks/useTwitchLink'
import { TwitchHandoffPanel } from '@/components/auth/TwitchHandoffPanel'
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

/** Survives the redirect to Twitch and back. See handleConnectTwitch. */
const FORWARD_CONSENT_KEY = 'csgn:twitchForwardConsent'

/**
 * THE FORWARDING GRANT, on screen.
 *
 * Worth stating plainly rather than burying in the terms, because it is the
 * single thing that makes CSGN worth a streamer's time: tick it once and you
 * never touch the schedule again. It is also a real permission over their work,
 * so the copy says exactly what it allows and the control to withdraw it sits
 * in the same place as the control to grant it.
 *
 * Defaults to ON at link time but is never silently applied — the box is
 * visible above the button that triggers the link, and the server stores
 * `false` unless the client actually sent `true`.
 */
function ForwardConsentBox({
  checked, onChange, busy, linked,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  busy?: boolean
  linked?: boolean
}) {
  return (
    <label className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-colors ${
      checked ? 'border-primary-500/30 bg-primary-500/[0.06]' : 'border-white/[0.09] bg-white/[0.02] hover:bg-white/[0.04]'
    }`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={busy}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-primary-500 cursor-pointer"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-white">
          Let CSGN put my stream on the channel
        </span>
        <span className="mt-1 block text-[11px] text-gray-400">
          Stream as you normally would. You earn 30% of the fees for the minutes we carry you.
          {linked && ' Turn it off any time.'}
        </span>
      </span>
    </label>
  )
}

export default function Dashboard() {
  const { user, profile, signIn, resendVerification, refreshProfile, addEmailPassword } = useAuth()
  const [resending, setResending] = useState(false)
  // Adding a recovery email to a wallet-only account.
  const [addEmailOpen, setAddEmailOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newEmailPassword, setNewEmailPassword] = useState('')
  const [addingEmail, setAddingEmail] = useState(false)
  const [addEmailError, setAddEmailError] = useState('')
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
  const [linkMsg, setLinkMsg] = useState('')
  const [linkErr, setLinkErr] = useState('')
  // Ticked BEFORE the Twitch hop, so the grant is captured in the same gesture
  // that links the channel rather than as a second thing to come back for.
  const [forwardConsent, setForwardConsent] = useState(true)
  const [consentBusy, setConsentBusy] = useState(false)

  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameErr, setNameErr] = useState('')
  const [nameMsg, setNameMsg] = useState('')
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
  // The server's verdict for the hour on the clock, read never recomputed.
  const liveAirtime = readAirtime(liveAssignedSlot?.creatorFees?.airtime)
  const liveAirtimeLabel = airtimeLabel(liveAirtime)
  const liveAirtimeNote = airtimeNote(liveAirtime)

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


  const [searchParams, setSearchParams] = useSearchParams()

  // A Twitch round trip that FAILED comes back here too, carrying its reason.
  // Surfacing it on the page the member started from is the whole point of
  // routing every outcome through one landing page — an error that only ever
  // rendered on the home sign-up modal was invisible to someone linking Twitch
  // from their profile.
  useEffect(() => {
    const code = searchParams.get('twitchError')
    if (!code && !searchParams.has('twitch')) return
    if (code) {
      setLinkErr(code === 'duplicate_twitch'
        ? 'That Twitch account is already linked to another CSGN account.'
        : 'Could not finish Twitch verification. Please try again.')
    }
    const next = new URLSearchParams(searchParams)
    next.delete('twitch'); next.delete('twitchError')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  // Finish a Twitch link started from this page. The OAuth round trip drops a
  // proof in sessionStorage and returns the user HERE (see lib/authReturn.ts);
  // we exchange it once and clear it, so a refresh can't replay a spent proof.
  //
  // The presence of the proof is the trigger. It used to also require a separate
  // 'csgn:linkTwitchReturn' flag, which meant the two halves could disagree —
  // and did: the callback always returned to the home page, so this effect never
  // ran and the link silently never completed.
  useEffect(() => {
    if (!user) return
    const proof = readTwitchProof()
    if (!proof) return
    let cancelled = false
    ;(async () => {
      try {
        // The tick made before the redirect, recovered on the way back.
        const consented = localStorage.getItem(FORWARD_CONSENT_KEY) === '1'
        localStorage.removeItem(FORWARD_CONSENT_KEY)
        const res = await api.linkTwitch(proof.proofToken, consented)
        clearTwitchProof()
        if (cancelled) return
        setLinkMsg(res.alreadyLinked
          ? `Twitch already connected as ${res.twitch.displayName}.`
          : `Twitch connected as ${res.twitch.displayName}.${consented ? ' Just stream as usual — we will pick you up.' : ''}`)
        setForwardConsent(Boolean(res.forwardConsent))
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
   * Attach an email + password to a wallet-only account.
   *
   * This is the recovery path, and it is the reason sign-up can leave email out
   * without leaving members stranded: a seed phrase is the one credential nobody
   * can reset for you, so an account with nothing else on it is one lost phrase
   * away from gone. Everything here is additive — the wallet keeps working as a
   * sign-in exactly as before.
   */
  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddingEmail(true); setAddEmailError(''); setLinkMsg('')
    try {
      await addEmailPassword(newEmail.trim(), newEmailPassword)
      setAddEmailOpen(false); setNewEmail(''); setNewEmailPassword('')
      setLinkMsg('Email added — check your inbox for the verification link.')
    } catch (err: unknown) {
      const code = err instanceof Error && 'code' in err ? String((err as { code?: string }).code || '') : ''
      if (code === 'auth/email-already-in-use' || code === 'auth/credential-already-in-use') {
        setAddEmailError('That email is already on another CSGN account.')
      } else if (code === 'auth/invalid-email') {
        setAddEmailError('Please enter a valid email address.')
      } else if (code === 'auth/weak-password') {
        setAddEmailError('Pick a password of at least 6 characters.')
      } else if (code === 'auth/requires-recent-login') {
        setAddEmailError('For security, sign in again with your wallet and then add the email.')
      } else {
        setAddEmailError(err instanceof Error ? err.message : 'Could not add the email. Try again.')
      }
    } finally { setAddingEmail(false) }
  }

  /**
   * Start the Twitch link.
   *
   * Never a popup, and — inside an in-app browser — not even a redirect. Twitch
   * offers "Sign in with Apple / Google / Amazon", and every one of those
   * refuses to run in an embedded webview, which is where most of our members
   * are standing when they tap this. `useTwitchLink` therefore hands those users
   * a door into Safari and polls for the result while they stay on this page;
   * a real browser gets the full-page redirect it always got, and comes back
   * here because of the 'link' intent below ('signup' would greet a member with
   * a "Join CSGN" modal on the way back from linking to the account they are
   * already signed into).
   */
  const twitchLink = useTwitchLink({
    beforeRedirect: () => storeAuthReturn({ path: '/account', intent: 'link' }),
    onLinked: async (result) => {
      setLinkErr('')
      try {
        const consented = localStorage.getItem(FORWARD_CONSENT_KEY) === '1'
        localStorage.removeItem(FORWARD_CONSENT_KEY)
        const res = await api.linkTwitch(result.twitchProofToken, consented)
        setLinkMsg(res.alreadyLinked
          ? `Twitch already connected as ${res.twitch.displayName}.`
          : `Twitch connected as ${res.twitch.displayName}.${consented ? ' Just stream as usual — we will pick you up.' : ''}`)
        setForwardConsent(Boolean(res.forwardConsent))
        await refreshProfile()
      } catch (err) {
        setLinkErr(err instanceof Error ? err.message : 'Could not connect Twitch.')
      }
    },
  })

  const handleConnectTwitch = () => {
    setLinkErr(''); setLinkMsg('')
    // Forwarding is granted AFTER the channel exists, from the Connections
    // list — see ForwardConsentBox's placement. The flag still rides through
    // the redirect so the default survives it, but nothing is decided here.
    localStorage.setItem(FORWARD_CONSENT_KEY, forwardConsent ? '1' : '0')
    void twitchLink.start()
  }

  /**
   * Turn forwarding on or off after the channel is already linked.
   *
   * Straight to the server, no OAuth: they have already proved they own the
   * channel, and a permission that costs a five-step round trip to withdraw is
   * not a permission anybody would actually withdraw.
   */
  const saveUsername = useCallback(async () => {
    const next = nameDraft.trim()
    if (next.length < 3) { setNameErr('At least 3 characters, letters, numbers and underscores.'); return }
    setSavingName(true)
    setNameErr(''); setNameMsg('')
    try {
      const res = await api.changeUsername(next)
      setNameMsg(res.unchanged ? 'That is already your username.' : `You are now @${res.username}.`)
      setEditingName(false)
      await refreshProfile()
    } catch (err) {
      setNameErr(err instanceof Error ? err.message : 'Could not change your username.')
    }
    setSavingName(false)
  }, [nameDraft, refreshProfile])

  const toggleForwardConsent = useCallback(async (next: boolean) => {
    setConsentBusy(true)
    setLinkErr('')
    try {
      await api.setForwardConsent(next)
      setForwardConsent(next)
      setLinkMsg(next
        ? 'Forwarding is on. Stream whenever you like — you will show up on the operator board and can be put on the channel.'
        : 'Forwarding is off. We will stop checking your channel within a minute.')
      await refreshProfile()
    } catch (err) {
      setLinkErr(err instanceof Error ? err.message : 'Could not save that.')
    }
    setConsentBusy(false)
  }, [refreshProfile])

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
              Your wallet is your sign-in — one signature, no password to remember.
            </p>

            {/* Same hierarchy as the header modal: the wallet leads, because the
                signature over a server nonce IS the credential and most members
                have no password at all. Opens the shared AuthModal rather than
                duplicating the challenge/sign/verify sequence, so there is one
                implementation of the wallet flow in the app, not two. */}
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              leftIcon={<Wallet className="w-4 h-4" aria-hidden />}
              onClick={() => window.dispatchEvent(new Event('csgn:openLogin'))}
            >
              Sign in with Phantom
            </Button>

            <div className="flex items-center gap-3 py-4">
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-[11px] uppercase tracking-widest text-gray-500">or use email</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <form onSubmit={handleEmailSignIn} className="space-y-3">
              {signInError && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {signInError}
                </div>
              )}
              <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" /><input type="text" value={signInIdentifier} onChange={(e) => setSignInIdentifier(e.target.value)} className="w-full pl-10 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50" placeholder="Email" required disabled={signInLoading} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} /></div>
              <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" /><input type="password" value={signInPassword} onChange={(e) => setSignInPassword(e.target.value)} className="w-full pl-10 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50" placeholder="Password" required minLength={6} disabled={signInLoading} autoComplete="current-password" /></div>
              <Button variant="secondary" size="md" className="w-full" isLoading={signInLoading}>Sign in with email</Button>
            </form>
          </Card>
        </div>
      </div>
    )
  }

  const twitchLinked = Boolean(profile?.twitch?.verified)
  // The stored grant wins over the local tick once a channel is actually
  // linked — the tick only ever described an intent for a link that had not
  // happened yet.
  const consentOn = twitchLinked ? Boolean(profile?.twitch?.forwardConsent) : forwardConsent
  // Wallet-only accounts (signupWithPhantom) have no email, so there is nothing
  // to verify and nothing to nag about — the old unconditional check told them
  // to go check an inbox they never gave us. Adding an address later turns the
  // notice back on for exactly the accounts it applies to.
  const accountEmail = profile?.email || user.email || ''
  const needsEmailVerification = Boolean(accountEmail) && !user.emailVerified
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
        {(needsEmailVerification || !twitchLinked || linkMsg) && (
          <div className="space-y-3">
            {linkMsg && <Notice tone="success" compact>{linkMsg}</Notice>}
            {linkErr && <Notice tone="error" compact>{linkErr}</Notice>}
            {needsEmailVerification && (
              <EmailNotice
                action={
                  <Button variant="secondary" size="sm" isLoading={resending} onClick={handleResend}>
                    Resend email
                  </Button>
                }
              />
            )}
            {!twitchLinked && !twitchLink.handoff && (
              <div className="space-y-3">
                <TwitchNotice
                  action={
                    <Button
                      variant="secondary"
                      size="sm"
                      isLoading={twitchLink.phase === 'starting' || twitchLink.phase === 'redirecting'}
                      onClick={handleConnectTwitch}
                    >
                      Connect Twitch
                    </Button>
                  }
                />
                {/* NOT SHOWN HERE ANY MORE.
                    A "let CSGN put my stream on the channel" box above a
                    "Connect Twitch" button is a permission over a channel that
                    does not exist yet — it reads as a second thing to decide
                    before you can do the first. The grant now appears in the
                    Connections list, next to the linked channel it governs, and
                    only once there is one. Connecting is the whole ask here. */}
              </div>
            )}
            {/* In-app browser: the Twitch hop cannot happen here, so the panel
                takes the notice's place and waits for Safari to finish it. */}
            {!twitchLinked && twitchLink.handoff && (
              <TwitchHandoffPanel
                href={twitchLink.handoff.href}
                rawUrl={twitchLink.handoff.rawUrl}
                browserName={twitchLink.handoff.browserName}
                onCancel={twitchLink.cancel}
              />
            )}
            {twitchLink.error && <Notice tone="error" compact>{twitchLink.error}</Notice>}
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
                {/* Editable in place. A username you cannot change is a typo
                    you live with forever, and this one is public — it is what
                    appears on the schedule and under your clips on air. */}
                {editingName ? (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-sm text-gray-500">@</span>
                    <input
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value.replace(/[^A-Za-z0-9_]/g, '').slice(0, 20))}
                      onKeyDown={(e) => { if (e.key === 'Enter') void saveUsername(); if (e.key === 'Escape') setEditingName(false) }}
                      autoFocus
                      className="min-w-0 flex-1 rounded-lg bg-white/[0.05] border border-white/[0.14] focus:border-primary-500/60 outline-none px-2.5 py-1 text-sm font-mono text-white"
                    />
                    <Button size="sm" isLoading={savingName} onClick={() => void saveUsername()}>Save</Button>
                    <button
                      type="button"
                      onClick={() => { setEditingName(false); setNameErr('') }}
                      className="text-xs text-gray-500 hover:text-gray-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  /* The pencil is ALWAYS VISIBLE. It was hover-only, which
                     means it did not exist at all on a phone and was invisible
                     on desktop until you happened to mouse over a line of grey
                     text — so nobody knew the username could be changed. An
                     affordance you have to discover is not an affordance. */
                  <button
                    type="button"
                    onClick={() => { setNameDraft(handle); setNameErr(''); setNameMsg(''); setEditingName(true) }}
                    aria-label="Change your username"
                    className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] bg-white/[0.03] px-2.5 py-1 text-sm text-gray-400 hover:text-white hover:bg-white/[0.07] hover:border-white/[0.16] transition-colors cursor-pointer"
                  >
                    <span className="break-all">@{handle}</span>
                    <Pencil className="w-3 h-3 shrink-0 text-gray-500" />
                  </button>
                )}
                {nameErr && <p className="mt-1 text-[11px] text-red-300">{nameErr}</p>}
                {nameMsg && <p className="mt-1 text-[11px] text-emerald-400">{nameMsg}</p>}
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
                <Link to="/schedule" className="block"><Button size="sm" variant="secondary">See who's on</Button></Link>
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
            {/* The grant lives next to the connection it governs, and is
                withdrawable from the same place it was given. */}
            {twitchLinked && (
              <div className="pt-1">
                <ForwardConsentBox
                  checked={consentOn}
                  busy={consentBusy}
                  linked
                  onChange={(next) => void toggleForwardConsent(next)}
                />
              </div>
            )}
            <Connection Icon={Wallet} label="Wallet" value={savedWallet ? `${savedWallet.slice(0, 4)}…${savedWallet.slice(-4)}` : ''} connected={Boolean(savedWallet)} mono />
            <Connection Icon={Mail} label="Email" value={accountEmail} connected={Boolean(accountEmail) && Boolean(user.emailVerified)} />
          </div>
          <div className="px-5 sm:px-6 pb-4 space-y-2">
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Only you can see your email address. It never appears on your public profile.
            </p>
            {/* A wallet account has no way back in if the seed phrase is lost —
                nobody can reset that for you. Offered, not demanded: the account
                works completely without it. */}
            {!accountEmail && (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-[11px] text-gray-500 flex-1 min-w-[16rem]">
                  No email on this account. Add one to get back in without your seed phrase.
                </p>
                <Button variant="secondary" size="sm" onClick={() => { setAddEmailOpen(true); setAddEmailError('') }}>
                  Add email
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* ── Holdings ── what the bag entitles you to. */}
        <HolderPanel walletAddress={savedWallet} />

        {/* The bag's most concrete use: minutes of television. Linked rather
            than duplicated — /studio reads the live allocation and this page
            should never render a second, staler copy of that number. */}
        <Link
          to="/studio"
          className="flex items-center justify-between gap-3 rounded-xl border border-primary-500/20 bg-primary-500/[0.06] px-5 py-4 hover:bg-primary-500/[0.1] transition-colors"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Your studio</p>
            <p className="mt-0.5 text-xs text-gray-400">Post a clip. It airs between the live blocks.</p>
          </div>
          <span className="text-primary-300 text-sm shrink-0">Open →</span>
        </Link>

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
              {liveAirtimeLabel && <span className="text-emerald-400/80"> · {liveAirtimeLabel}</span>}
            </p>
          )}
          {/* Same figure, same wording as /watch — the payable amount and the
              airtime behind it, so the two surfaces can never disagree. */}
          {liveAssignedSlot && liveAirtimeNote && (
            <p className={`mt-1 text-xs leading-snug ${airtimeTone(liveAirtime)}`}>{liveAirtimeNote}</p>
          )}
          {liveAssignedSlot && liveVolumeSOL > 0 && (
            <p className="mt-1.5 text-xs text-gray-500 leading-relaxed break-words">
              {liveVolumeSOL.toFixed(4)} SOL × tier creator fee × 30%
              {liveAirtime && liveAirtime.fraction < 1 ? ` × ${Math.round(liveAirtime.fraction * 100)}% airtime` : ''}
              {' '}= {liveEstimateSOL.toFixed(6)} SOL
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
                // Samples, not minutes — the poller's cadence varies, so this
                // only answers "did we ever see them live", never "for how long".
                const liveSamples = activity?.liveCheckCount ?? 0
                const onAir = liveDuration(activity)
                const airtime = readAirtime(slot.creatorFees?.airtime)
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
                        {/* A settled hour shows the verdict that decided the
                            amount; anything else shows the measured duration
                            when we have one, and says plainly that we only have
                            a check count when we do not. */}
                        {airtime ? (
                          <p className={`text-[11px] mt-1.5 flex items-start gap-1 leading-snug ${airtimeTone(airtime)}`}>
                            <Radio className="w-3 h-3 shrink-0 mt-px" />
                            <span>{airtimeLabel(airtime) ?? 'No live checks recorded'} — {airtimeNote(airtime)}</span>
                          </p>
                        ) : activity && (
                          <p className={`text-[11px] mt-1.5 flex items-start gap-1 leading-snug ${liveSamples > 0 ? 'text-emerald-400' : 'text-gray-500'}`}>
                            <Radio className="w-3 h-3 shrink-0 mt-px" />
                            <span>
                              {onAir
                                ? `Live ${onAir}${activity.lastLiveAt ? ` (last ${new Date(activity.lastLiveAt).toLocaleTimeString()})` : ''}`
                                : liveSamples > 0
                                  ? `Seen live on ${liveSamples} check${liveSamples === 1 ? '' : 's'}`
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

        {/* Hours the network has you booked on — real data, straight from the
            schedule. Members no longer book these themselves; an operator assigns
            the current hour when you go live, and guests are added by hand. The
            card stays because seeing your own name on a schedule is the payoff. */}
        <Card hover={false} className="p-5">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Radio className="w-4 h-4 text-gray-400" /> Your upcoming slots
          </h2>
          <div className="mt-3 space-y-2">
            {/* "Nothing booked" is the NORMAL state — nobody books anything any
                more — so it must not read as a warning. One line, no apology, no
                re-explanation of the forwarding model underneath it. */}
            {upcomingSlots.length === 0 ? (
              <p className="text-sm text-gray-500">Nothing booked. We carry you whenever you go live.</p>
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
            <Button variant="secondary" size="sm">See the schedule</Button>
          </Link>
        </Card>

        {/* Discovery — who else is here, and who can actually go live. */}
        <RecommendedProfiles excludeUsername={profile?.username} />
      </div>
      {addEmailOpen && (
        <Modal open onClose={() => setAddEmailOpen(false)} title="Add an email and password">
          <form onSubmit={handleAddEmail} className="space-y-3 mt-2">
            <p className="text-xs text-gray-400">
              A way back in without your seed phrase. Your wallet keeps working.
            </p>
            {addEmailError && <Notice tone="error" compact>{addEmailError}</Notice>}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50"
                placeholder="you@example.com"
                required
                disabled={addingEmail}
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="password"
                value={newEmailPassword}
                onChange={(e) => setNewEmailPassword(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50"
                placeholder="Choose a password"
                required
                minLength={6}
                disabled={addingEmail}
                autoComplete="new-password"
              />
            </div>
            <Button variant="primary" size="md" className="w-full" isLoading={addingEmail}>Add email</Button>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              We'll send a verification link. It never appears on your public profile.
            </p>
          </form>
        </Modal>
      )}
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
