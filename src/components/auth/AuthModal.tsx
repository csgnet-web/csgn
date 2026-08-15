import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, CheckCircle2, Eye, EyeOff, Lock, Mail, PlayCircle, Radio, Twitch, User, Wallet, X } from 'lucide-react'
import { Notice } from '@/components/ui/Notice'
import { Button } from '@/components/ui/Button'
import { TwitchHandoffPanel } from '@/components/auth/TwitchHandoffPanel'
import { useAuth } from '@/contexts/useAuth'
import { getPhantomProvider, usePhantomWallet } from '@/hooks/usePhantomWallet'
import { useTwitchLink } from '@/hooks/useTwitchLink'
import { api } from '@/lib/api'
import { storeAuthReturn } from '@/lib/authReturn'
import { suggestUsername } from '@/lib/username'
import { isMobile } from '@/lib/webview'
import { useScrollLock } from '@/hooks/useScrollLock'

interface AuthModalProps { isOpen: boolean; onClose: () => void; initialMode?: 'login' | 'signup' }

/**
 * Three taps to an account.
 *
 *   1. Continue with Phantom
 *   2. Approve the signature in Phantom
 *   3. Create account   ← the name is already filled in
 *
 * Everything that used to sit between those taps has been moved to where it is
 * actually needed, or deleted:
 *
 *  • **Sign in and sign up are one door.** The wallet already knows which one
 *    applies. A registered wallet is signed in on tap 2 and never sees a
 *    username field; a new one lands on it. Making a stranger choose the right
 *    button first was asking them to know something we know.
 *  • **The username arrives filled in.** A valid, stable, wallet-derived handle
 *    (lib/username.ts) means the primary button is live on arrival. Typing is
 *    now opt-in.
 *  • **Twitch is out of sign-up entirely.** It gates going on air, not having
 *    an account (see netlify/functions/claimSlot.ts), and it was the single
 *    biggest way to fail this form: inside Phantom's in-app browser, Twitch's
 *    "Continue with Google / Apple / Amazon" buttons return "Something went
 *    wrong" by design. It now lives one step past the finish line, on a screen
 *    that can hand the user out to Safari and wait for them (useTwitchLink).
 *  • **Email and password are out of the happy path.** They were never the
 *    credential here — `loginWithPhantom` has always let a holder in on a
 *    signature — and they cost three fields and a round trip. They stay
 *    reachable for the accounts that have them, and they appear automatically
 *    for the one case that needs them: a wallet too new to clear the on-chain
 *    sign-up check.
 */

type Step =
  /** The single button. Sign-in and sign-up both start here. */
  | 'connect'
  /** New wallet: name it and go. */
  | 'name'
  /** Account exists. One question: watch, or go on air? */
  | 'done'
  /** Email + password — legacy sign-in, and the new-wallet fallback. */
  | 'email'

export function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const { signIn, signUp, signUpWithPhantom, signInWithPhantom, refreshProfile } = useAuth()
  const { connect, signMessage, isConnecting, error: walletError, needsPhantom, deeplink } = usePhantomWallet()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('connect')
  const [intent, setIntent] = useState<'login' | 'signup'>(initialMode)
  const [phantomProofToken, setPhantomProofToken] = useState('')
  const [verifiedWallet, setVerifiedWallet] = useState('')
  const [username, setUsername] = useState('')
  const [createdName, setCreatedName] = useState('')
  const [twitchName, setTwitchName] = useState('')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  /** True once a wallet has been rejected as too new — the only case where the
   *  email + password sign-up is a genuinely better answer than "try again". */
  const [emailSignupFallback, setEmailSignupFallback] = useState(false)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  /** Phantom is not injected on this device — offer the door, don't make them
   *  discover it by waiting three seconds for a failure. */
  const [providerMissing, setProviderMissing] = useState(false)

  useScrollLock(isOpen)

  const reset = useCallback(() => {
    setStep('connect'); setError(''); setLoading(false); setVerifying(false)
    setPhantomProofToken(''); setVerifiedWallet(''); setUsername(''); setCreatedName(''); setTwitchName('')
    setEmail(''); setPassword(''); setConfirmPassword(''); setEmailSignupFallback(false)
  }, [])

  useEffect(() => {
    if (isOpen) { reset(); setIntent(initialMode) }
  }, [isOpen, initialMode, reset])

  // Mobile browsers have no extension, so a missing provider means the user is
  // not in Phantom's in-app browser. Checked after a beat because injection is
  // asynchronous and a flash of "Open in Phantom" for someone who IS in Phantom
  // is worse than showing it a moment late.
  useEffect(() => {
    if (!isOpen) return
    const id = setTimeout(() => setProviderMissing(!getPhantomProvider()), 1200)
    return () => clearTimeout(id)
  }, [isOpen])

  const handleClose = () => { reset(); onClose() }

  /**
   * Link Twitch to the account that now exists. On a real browser this is a
   * full-page redirect that lands on /account; inside an in-app browser the
   * hook keeps us here and polls while the user approves in Safari.
   */
  const twitchLink = useTwitchLink({
    beforeRedirect: () => storeAuthReturn({ path: '/account', intent: 'link' }),
    onLinked: async (result) => {
      try {
        const res = await api.linkTwitch(result.twitchProofToken)
        setTwitchName(res.twitch.displayName || res.twitch.username)
        await refreshProfile()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not connect Twitch.')
      }
    },
  })

  /**
   * The one button. Prove the wallet, then let the wallet decide what happens:
   * a registered one is signed straight in, a new one goes to the name step.
   * `loginWithPhantom` 404s for an unlinked wallet and never creates anything,
   * so a failure there is information, not an error.
   */
  const continueWithPhantom = async () => {
    setError(''); setVerifying(true)
    try {
      // ALWAYS through connect(): a cached address is not a live provider
      // session, and signing against one that was never connected is what used
      // to make the signature prompt silently never appear.
      const address = await connect()
      if (!address) return
      const challenge = await api.createPhantomChallenge(address)
      const signature = await signMessage(challenge.message)
      if (!signature) return
      const verified = await api.verifyPhantomSignature(address, signature, challenge.challengeToken)
      setPhantomProofToken(verified.proofToken)
      setVerifiedWallet(verified.walletAddress)

      try {
        await signInWithPhantom(verified.proofToken)
        handleClose()
        return
      } catch {
        /* no account on this wallet yet — that's a sign-up */
      }
      setIntent('signup')
      setUsername((current) => current || suggestUsername(verified.walletAddress))
      setStep('name')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify your Phantom wallet.')
    } finally { setVerifying(false) }
  }

  const createAccount = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      await signUpWithPhantom(username.trim(), { phantomProofToken })
      setCreatedName(username.trim())
      setStep('done')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign up failed. Please try again.'
      // A brand-new wallet with no on-chain history is refused by the sybil
      // gate (signupWithPhantom.ts). That is the one rejection where "try
      // again" is useless advice, so the email route opens itself instead of
      // hiding behind a link the user has no reason to look for.
      if (/no Solana activity/i.test(message)) {
        setEmailSignupFallback(true)
        setStep('email')
        setError('This wallet has no Solana activity yet, so we can\'t use it on its own. Create your account with an email and password — the wallet stays attached.')
      } else {
        setError(message)
      }
    } finally { setLoading(false) }
  }

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      if (emailSignupFallback) {
        if (password !== confirmPassword) throw new Error('Those passwords do not match.')
        await signUp(email.trim(), password, username.trim(), { phantomProofToken })
        setCreatedName(username.trim())
        setStep('done')
      } else {
        await signIn(email.trim(), password)
        handleClose()
      }
    } catch (err: unknown) {
      const code = err instanceof Error && 'code' in err ? String((err as { code?: string }).code || '') : ''
      if (code === 'auth/invalid-credential') setError('That email and password do not match an account.')
      else if (err instanceof Error && err.message) setError(err.message)
      else setError('Sign in failed. Please try again.')
    } finally { setLoading(false) }
  }

  const inputClass = 'w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary-500/50'
  const showPhantomDoor = needsPhantom || providerMissing
  const usernameValid = /^[A-Za-z0-9_]{3,20}$/.test(username.trim())

  const heading =
    step === 'name' ? 'Pick your name'
      : step === 'done' ? "You're on CSGN"
        : step === 'email' ? (emailSignupFallback ? 'Create your account' : 'Sign in with email')
          : intent === 'signup' ? 'Join CSGN' : 'Welcome back'

  const subheading =
    step === 'name' ? 'One field, already filled in. Change it or keep it.'
      : step === 'done' ? 'Your account is live. What do you want to do first?'
        : step === 'email' ? (emailSignupFallback ? 'Your wallet stays attached — this just gives it a way in.' : 'For accounts created before wallet sign-in.')
          : 'One signature. No email, no password, about ten seconds.'

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4" style={{ height: '100dvh' }}>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="relative w-full max-w-md max-h-[92vh] bg-[#0c0c1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="relative px-6 sm:px-8 pt-6 sm:pt-8 pb-4">
              <button type="button" onClick={handleClose} aria-label="Close" className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5 cursor-pointer"><X className="w-5 h-5" aria-hidden /></button>
              <img src="/csgn-logo.jpg" alt="" className="w-12 h-12 rounded-xl object-cover mb-4 shadow-lg" />
              <h2 className="text-2xl font-bold font-display text-white">{heading}</h2>
              <p className="text-sm text-gray-400 mt-1">{subheading}</p>
            </div>

            <div className="px-6 sm:px-8 pb-8 sm:pb-10 space-y-4 overflow-y-auto max-h-[calc(100dvh-13rem)] overscroll-contain">
              {error && <Notice tone="error" compact>{error}</Notice>}

              {/* ── Step 1: the only button ─────────────────────────────── */}
              {step === 'connect' && (
                <div className="space-y-3">
                  {showPhantomDoor ? (
                    <>
                      <a
                        href={isMobile() ? deeplink : 'https://phantom.app/download'}
                        target={isMobile() ? undefined : '_blank'}
                        rel="noopener noreferrer"
                        className="w-full h-14 rounded-xl bg-[#ab9ff2] hover:bg-[#bcb0f5] text-black text-base font-bold flex items-center justify-center gap-2 transition-colors"
                      >
                        <Wallet className="w-5 h-5" aria-hidden />
                        {isMobile() ? 'Continue in Phantom' : 'Install Phantom'}
                      </a>
                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        {isMobile()
                          ? 'This reopens CSGN inside Phantom, where your wallet can sign. Takes one tap and you land right back here.'
                          : 'Phantom is the wallet CSGN pays creator fees to. Install it, reload, and this becomes a one-click sign-in.'}
                      </p>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={continueWithPhantom}
                        disabled={isConnecting || verifying}
                        className="w-full h-14 rounded-xl bg-[#ab9ff2] hover:bg-[#bcb0f5] text-black text-base font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
                      >
                        <Wallet className="w-5 h-5" aria-hidden />
                        {verifying ? 'Check Phantom…' : 'Continue with Phantom'}
                      </button>
                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        You'll sign a one-line message to prove the wallet — no transaction, no fee, nothing approved.
                        Already have an account on this wallet? This signs you in.
                      </p>
                    </>
                  )}
                  {walletError && <Notice tone="error" compact>{walletError}</Notice>}

                  <button
                    type="button"
                    onClick={() => { setError(''); setEmailSignupFallback(false); setStep('email') }}
                    className="w-full text-xs text-gray-500 hover:text-gray-300 underline cursor-pointer pt-1"
                  >
                    Sign in with an email and password instead
                  </button>
                </div>
              )}

              {/* ── Step 2: the one field, pre-answered ─────────────────── */}
              {step === 'name' && (
                <form onSubmit={createAccount} className="space-y-3">
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-emerald-200">Wallet verified</p>
                      <p className="text-[11px] font-mono text-emerald-300/80 truncate">{verifiedWallet}</p>
                    </div>
                  </div>

                  <label htmlFor="csgn-username" className="block text-sm font-medium text-gray-300">Your name on the network</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden />
                    <input
                      id="csgn-username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onFocus={(e) => e.currentTarget.select()}
                      className={inputClass}
                      required minLength={3} maxLength={20}
                      disabled={loading}
                      autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                    />
                  </div>
                  <p className="text-[11px] text-gray-500">3–20 characters. Letters, numbers and underscores.</p>

                  <Button variant="primary" size="lg" className="w-full" type="submit" isLoading={loading} disabled={!usernameValid}>
                    Create account
                  </Button>
                </form>
              )}

              {/* ── Step 3: one question, not a checklist ───────────────── */}
              {step === 'done' && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3">
                    <p className="text-sm font-semibold text-emerald-100">Welcome, {createdName}.</p>
                    <p className="text-xs text-emerald-300/80 mt-0.5">Your wallet is your sign-in from now on — one tap, every time.</p>
                  </div>

                  <Button
                    variant="primary" size="lg" className="w-full"
                    leftIcon={<PlayCircle className="w-4 h-4" aria-hidden />}
                    onClick={() => { handleClose(); navigate('/watch') }}
                  >
                    Watch what's live
                  </Button>

                  {twitchName ? (
                    <Notice tone="success" compact>Twitch connected as {twitchName}. You can claim an hour on the schedule.</Notice>
                  ) : twitchLink.handoff ? (
                    <TwitchHandoffPanel
                      href={twitchLink.handoff.href}
                      rawUrl={twitchLink.handoff.rawUrl}
                      browserName={twitchLink.handoff.browserName}
                      onCancel={twitchLink.cancel}
                    />
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => void twitchLink.start()}
                        disabled={twitchLink.phase === 'starting' || twitchLink.phase === 'redirecting'}
                        className="w-full h-12 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
                      >
                        <Radio className="w-4 h-4" aria-hidden />
                        {twitchLink.phase === 'starting' || twitchLink.phase === 'redirecting' ? 'Opening Twitch…' : 'I want to go on air — connect Twitch'}
                      </button>
                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        Only streamers need this. Connect the channel you broadcast from and every open hour on
                        the schedule becomes claimable — you can also do it later from your account.
                      </p>
                    </>
                  )}
                  {twitchLink.error && <Notice tone="error" compact>{twitchLink.error}</Notice>}

                  <button type="button" onClick={handleClose} className="w-full text-xs text-gray-500 hover:text-gray-300 underline cursor-pointer pt-1">
                    Done for now
                  </button>
                </div>
              )}

              {/* ── The email route: legacy sign-in, and the new-wallet fallback ── */}
              {step === 'email' && (
                <form onSubmit={submitEmail} className="space-y-3">
                  {emailSignupFallback && (
                    <>
                      <label htmlFor="csgn-username-email" className="block text-sm font-medium text-gray-300">Your name on the network</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden />
                        <input id="csgn-username-email" value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} required minLength={3} maxLength={20} disabled={loading} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                      </div>
                    </>
                  )}

                  <label htmlFor="csgn-email" className="block text-sm font-medium text-gray-300">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden />
                    <input id="csgn-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@example.com" required disabled={loading} autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                  </div>

                  <label htmlFor="csgn-password" className="block text-sm font-medium text-gray-300">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden />
                    <input id="csgn-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary-500/50" required minLength={6} disabled={loading} autoComplete={emailSignupFallback ? 'new-password' : 'current-password'} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 cursor-pointer">{showPassword ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}</button>
                  </div>

                  {emailSignupFallback && (
                    <>
                      <label htmlFor="csgn-password-confirm" className="block text-sm font-medium text-gray-300">Confirm password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden />
                        <input id="csgn-password-confirm" type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} required minLength={6} disabled={loading} autoComplete="new-password" />
                      </div>
                    </>
                  )}

                  <Button variant="primary" size="lg" className="w-full" type="submit" isLoading={loading}>
                    {emailSignupFallback ? 'Create account' : 'Sign in'}
                  </Button>

                  <button
                    type="button"
                    onClick={() => { setError(''); setStep(phantomProofToken ? 'name' : 'connect') }}
                    className="w-full text-xs text-gray-500 hover:text-gray-300 underline cursor-pointer pt-1 flex items-center justify-center gap-1"
                  >
                    Use Phantom instead <ArrowRight className="w-3 h-3" aria-hidden />
                  </button>
                </form>
              )}

              {/* One line of orientation, and only where it can still change
                  what the user does. On the done screen it would be noise. */}
              {step === 'connect' && (
                <p className="text-xs text-center text-gray-600 leading-relaxed">
                  <Twitch className="w-3 h-3 inline mb-0.5" aria-hidden /> Streaming on CSGN needs a Twitch channel —
                  you'll connect it after your account exists, not before.
                </p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
