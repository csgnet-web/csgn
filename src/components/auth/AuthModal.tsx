import { useEffect, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Eye, EyeOff, Lock, Mail, Twitch, User, Wallet, X } from 'lucide-react'
import { Notice } from '@/components/ui/Notice'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/useAuth'
import { usePhantomWallet } from '@/hooks/usePhantomWallet'
import { api, type TwitchProof } from '@/lib/api'
import { clearTwitchProof, readTwitchProof } from '@/lib/twitchProof'
import { clearRegisterDraft, readRegisterDraft, storeRegisterDraft } from '@/lib/registerDraft'
import { storeAuthReturn } from '@/lib/authReturn'
import { useScrollLock } from '@/hooks/useScrollLock'

interface AuthModalProps { isOpen: boolean; onClose: () => void; initialMode?: 'login' | 'signup' }

type TwitchState = TwitchProof['twitch'] | null

const TWITCH_ERROR_MESSAGES: Record<string, string> = {
  duplicate_twitch: 'This Twitch account is already linked to a CSGN account.',
  oauth_state_expired: 'Twitch verification expired. Please connect Twitch again.',
  oauth_exchange_failed: 'Twitch sign-in failed. Confirm the Twitch redirect URI matches exactly, then try again.',
  oauth_failed: 'Twitch verification failed. Please try again.',
}

/**
 * The sign-up flow, shortest path first.
 *
 * Signing up is one wallet signature and a username. Not because email is
 * unimportant, but because on this product it was never the credential:
 * Phantom has always been mandatory (creator fees are paid to that wallet) and
 * `loginWithPhantom` has always let a returning holder in on a signature alone,
 * so the email and password were a second, weaker key that stopped being used
 * after the first sign-in. What they DID reliably do was cost accounts — three
 * extra fields, a verification round trip that gated slot claims, and a Twitch
 * redirect that came back demanding the password again because it's the one
 * thing we refuse to persist.
 *
 * So the wallet button here is not "social login". It is the account:
 *
 *   1. Connect Phantom → the signature over a single-use server nonce proves
 *      the wallet. If that wallet already has an account this signs straight
 *      in — one tap, no mode switch, nothing to remember.
 *   2. Pick a username → done.
 *
 * Email and password remain available behind a disclosure, for anyone who wants
 * a credential they can recover without a seed phrase — the one thing a wallet
 * genuinely cannot offer. Both paths land on the same account shape, and the
 * existing email/password sign-in keeps working for every account made before
 * this. See netlify/functions/signupWithPhantom.ts for the security reasoning.
 */
export function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const { signIn, signUp, signUpWithPhantom, signInWithPhantom } = useAuth()
  const { connect, signMessage, isConnecting, error: walletError, needsPhantom, deeplink, isMobile } = usePhantomWallet()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phantomProofToken, setPhantomProofToken] = useState('')
  const [verifiedWallet, setVerifiedWallet] = useState('')
  const [twitchProofToken, setTwitchProofToken] = useState('')
  const [twitch, setTwitch] = useState<TwitchState>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState<'phantom' | 'twitch' | null>(null)
  const [returnedFromTwitch, setReturnedFromTwitch] = useState(false)
  // The classic email + password sign-up, revealed on request. Off by default:
  // the wallet path is both shorter and the stronger credential, so making
  // people opt out of it is the right way round.
  const [emailMode, setEmailMode] = useState(false)

  const [mode, setMode] = useState<'login' | 'signup'>(initialMode)
  const isRegister = mode === 'signup'
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()

  // Sync mode to the initialMode prop whenever the modal opens so that
  // reopening via "Sign In" after previously switching to signup resets correctly.
  useEffect(() => {
    if (isOpen) setMode(initialMode)
  }, [isOpen, initialMode])

  // On open, pick up any Twitch proof handed back by the OAuth redirect flow
  // (stored in sessionStorage) and surface any twitchError carried in the URL.
  useEffect(() => {
    if (!isOpen || !isRegister) return

    // Restore any in-progress register fields saved before a Twitch redirect.
    // Read-once: clear immediately so later effect runs don't clobber edits.
    const draft = readRegisterDraft()
    if (draft) {
      setEmail(draft.email); setUsername(draft.username); setEmailMode(draft.emailMode)
      if (draft.phantomProofToken) {
        setPhantomProofToken(draft.phantomProofToken); setVerifiedWallet(draft.verifiedWallet)
        setReturnedFromTwitch(true)
      }
      clearRegisterDraft()
    }

    const proof = readTwitchProof()
    if (proof) { setTwitchProofToken(proof.proofToken); setTwitch(proof.twitch); setVerifying(null) }

    const twitchError = searchParams.get('twitchError')
    if (twitchError) {
      setError(TWITCH_ERROR_MESSAGES[twitchError] || TWITCH_ERROR_MESSAGES.oauth_failed)
      setVerifying(null)
    }

    // Clean the OAuth flow params so a refresh doesn't re-trigger anything.
    if (searchParams.has('auth') || searchParams.has('twitch') || searchParams.has('twitchError')) {
      const next = new URLSearchParams(searchParams)
      next.delete('auth'); next.delete('twitch'); next.delete('twitchError')
      setSearchParams(next, { replace: true })
    }
  }, [isOpen, isRegister, searchParams, setSearchParams])

  const reset = () => {
    setError(''); setEmail(''); setUsername(''); setPassword(''); setConfirmPassword('')
    setPhantomProofToken(''); setVerifiedWallet(''); setTwitchProofToken(''); setTwitch(null); setVerifying(null)
    setReturnedFromTwitch(false); setEmailMode(false)
    clearRegisterDraft()
  }

  const switchMode = () => {
    setError(''); setPassword(''); setConfirmPassword('')
    setPhantomProofToken(''); setVerifiedWallet(''); setTwitchProofToken(''); setTwitch(null); setVerifying(null)
    setReturnedFromTwitch(false); setEmailMode(false)
    clearRegisterDraft()
    setMode(m => m === 'login' ? 'signup' : 'login')
  }

  const handleClose = () => { reset(); onClose() }

  /** Login view: prove the wallet, then exchange that proof for a session. */
  const loginWithPhantom = async () => {
    setError(''); setVerifying('phantom')
    try {
      const address = await connect()
      if (!address) return
      const challenge = await api.createPhantomChallenge(address)
      const signature = await signMessage(challenge.message)
      if (!signature) return
      const verified = await api.verifyPhantomSignature(address, signature, challenge.challengeToken)
      await signInWithPhantom(verified.proofToken)
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in with Phantom.')
    } finally { setVerifying(null) }
  }

  /**
   * Sign-up view: prove the wallet, then take whichever branch the wallet is
   * already on. A wallet that HAS an account signs straight in rather than
   * being told it's a duplicate — from the member's side "sign up" and "sign
   * in" are the same intent (get me into my account) and the wallet already
   * knows which one applies, so making them pick the right button first was
   * pure friction. A new wallet lands on the username step.
   */
  const connectPhantom = async () => {
    setError(''); setVerifying('phantom')
    try {
      // ALWAYS go through connect() — it guarantees a live provider session.
      // Trusting the cached `walletAddress` here is what silently killed
      // registration: a returning user skipped the connect step and the
      // signature prompt never appeared. Reconnecting an approved wallet is
      // promptless, so this costs nothing.
      const address = await connect()
      if (!address) return
      const challenge = await api.createPhantomChallenge(address)
      const signature = await signMessage(challenge.message)
      if (!signature) return
      const verified = await api.verifyPhantomSignature(address, signature, challenge.challengeToken)
      setPhantomProofToken(verified.proofToken)
      setVerifiedWallet(verified.walletAddress)

      // Already registered? Then this was a sign-in all along. loginWithPhantom
      // 404s for an unlinked wallet and never creates anything, so a failure
      // here just means "new wallet" — fall through to the username step.
      if (!emailMode) {
        try {
          await signInWithPhantom(verified.proofToken)
          handleClose()
        } catch { /* not linked yet — continue registering */ }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify Phantom wallet.')
    } finally { setVerifying(null) }
  }

  const connectTwitch = async () => {
    setError(''); setVerifying('twitch')
    try {
      const { authUrl } = await api.startTwitchOAuth()
      // Persist the in-progress form AND where to come back to, then redirect
      // (no popup / window.opener) so this works inside mobile in-app browsers
      // like Phantom on iPhone. Returning to the page they left — rather than
      // always to the home page — is what makes the round trip feel like one
      // step instead of a detour; the wallet proof survives it, so on the
      // wallet path there is nothing to re-enter at all.
      storeRegisterDraft({ email, username, phantomProofToken, verifiedWallet, emailMode })
      storeAuthReturn({ path: `${location.pathname}${location.search}`, intent: 'signup' })
      window.location.href = authUrl
    } catch (err) {
      setVerifying(null)
      setError(err instanceof Error ? err.message : 'Could not start Twitch verification.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      if (isRegister) {
        if (!phantomProofToken) throw new Error('Connect your Phantom wallet to create an account.')
        // Twitch is optional here by design — it gates claiming a slot, not
        // having an account. See finalizeCreateAccount.ts for why that matters
        // (Apple sign-in inside Twitch cannot complete in an embedded webview).
        const proofs = { phantomProofToken, twitchProofToken: twitchProofToken || undefined }
        if (emailMode) {
          if (password !== confirmPassword) throw new Error('Passwords do not match.')
          await signUp(email, password, username, proofs)
        } else {
          await signUpWithPhantom(username, proofs)
        }
        clearTwitchProof()
        clearRegisterDraft()
      } else {
        await signIn(email, password)
      }
      handleClose()
    } catch (err: unknown) {
      const code = err instanceof Error && 'code' in err ? String((err as { code?: string }).code || '') : ''
      if (err instanceof Error && err.message) setError(err.message)
      else if (code === 'auth/invalid-credential') setError('Invalid email or password.')
      else setError(isRegister ? 'Sign up failed. Please try again.' : 'Sign in failed. Please try again.')
    } finally { setLoading(false) }
  }

  useScrollLock(isOpen)

  // The wallet is proven — the rest of the form is worth showing. Before that,
  // asking for a username is asking someone to fill in a field for an account
  // that may turn out to already exist.
  const walletReady = Boolean(phantomProofToken)
  // The wallet button leads in both modes. It only steps aside on sign-in when
  // the member has explicitly asked for the email form (sign-up always needs the
  // wallet, so there it is never hidden).
  const showWalletFirst = isRegister || !emailMode
  const inputClass = 'w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary-500/50'

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4" style={{ height: '100dvh' }}>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative w-full max-w-md max-h-[92vh] bg-[#0c0c1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="relative px-6 sm:px-8 pt-6 sm:pt-8 pb-4">
              <button type="button" onClick={handleClose} aria-label="Close" className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5 cursor-pointer"><X className="w-5 h-5" aria-hidden /></button>
              <img src="https://pbs.twimg.com/profile_images/1966988305255276544/3Qz3tNAa_200x200.jpg" alt="CSGN" className="w-12 h-12 rounded-xl object-cover mb-4 shadow-lg" />
              <h2 className="text-2xl font-bold font-display text-white">{isRegister ? 'Join CSGN' : 'Welcome back'}</h2>
              <p className="text-sm text-gray-400 mt-1">
                {isRegister
                  ? emailMode
                    ? 'Email, password and a Phantom wallet. Twitch is optional — add it when you want to go on air.'
                    : 'Your wallet and a username. That is the whole sign-up.'
                  : emailMode
                    ? 'Sign in with the email and password on your account.'
                    : 'Your wallet is your sign-in. One signature, no password to remember.'}
              </p>
            </div>
            <div className="px-6 sm:px-8 pb-8 sm:pb-10 space-y-4 overflow-y-auto max-h-[calc(100dvh-13rem)] overscroll-contain">
              <form onSubmit={handleSubmit} className="space-y-3">
                {error && <Notice tone="error" compact>{error}</Notice>}

                {/* ── The wallet is the primary action in BOTH modes. ──
                       Signing in, the Ed25519 signature over a single-use server
                       nonce IS the credential — a returning holder has never
                       needed the password, so burying this under an email field
                       was asking most of our members for the weaker of the two
                       keys they hold. Signing up, it does even more: it proves
                       the wallet, and if that wallet already has an account it
                       just signs them in.

                       Email and password stay reachable one tap below, because a
                       seed phrase is the one credential nobody can reset. ── */}
                {showWalletFirst && (
                  <>
                    <button
                      type="button"
                      onClick={isRegister ? connectPhantom : loginWithPhantom}
                      disabled={loading || isConnecting || verifying === 'phantom'}
                      className={`w-full h-14 rounded-xl border text-base font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 ${
                        walletReady
                          ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                          : 'bg-[#ab9ff2] border-transparent text-black hover:bg-[#bcb0f5]'
                      }`}
                    >
                      {walletReady ? <CheckCircle2 className="w-5 h-5" aria-hidden /> : <Wallet className="w-5 h-5" aria-hidden />}
                      {walletReady
                        ? 'Wallet verified'
                        : verifying === 'phantom'
                          ? 'Check Phantom…'
                          : isRegister ? 'Continue with Phantom' : 'Sign in with Phantom'}
                    </button>
                    {verifiedWallet && <p className="text-xs text-emerald-300 truncate">{verifiedWallet}</p>}
                    {!walletReady && !needsPhantom && (
                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        {isRegister
                          ? "You'll sign a one-line message to prove the wallet — no transaction, no fee, nothing approved. Already have an account on this wallet? This signs you in."
                          : "You'll sign a one-line message to prove the wallet — no transaction, no fee, nothing approved."}
                      </p>
                    )}
                    {walletError && <Notice tone="error" compact>{walletError}</Notice>}
                    {/* Mobile browsers have no extension — the only way to approve a
                        signature is Phantom's in-app browser, so offer the door
                        instead of leaving the user stuck on "not detected". */}
                    {needsPhantom && (
                      <a
                        href={isMobile ? deeplink : 'https://phantom.app/download'}
                        target={isMobile ? undefined : '_blank'}
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 h-11 rounded-xl bg-[#ab9ff2] text-black text-sm font-bold hover:bg-[#bcb0f5] transition-colors"
                      >
                        <Wallet className="w-4 h-4" aria-hidden />
                        {isMobile ? 'Open in Phantom browser' : 'Install Phantom'}
                      </a>
                    )}
                  </>
                )}

                {/* Sign-up: gated on a proven wallet — asking for a username
                    before that is asking someone to fill a field for an account
                    that may already exist. Sign-in: gated on the member choosing
                    the email route, so the default view is one button. */}
                {(isRegister ? walletReady : emailMode) && (
                  <>
                    {isRegister && (
                      <>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5 pt-1">Username</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                          <input value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} placeholder="csgn_user" required minLength={3} maxLength={20} disabled={loading} autoFocus autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                        </div>

                        <button type="button" onClick={connectTwitch} disabled={loading || verifying === 'twitch'} className={`w-full h-12 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 ${twitchProofToken ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}>
                          {twitchProofToken ? <CheckCircle2 className="w-4 h-4" /> : <Twitch className="w-4 h-4" />}
                          {twitchProofToken ? twitch?.displayName || 'Twitch Connected' : verifying === 'twitch' ? 'Opening Twitch…' : 'Connect Twitch (optional)'}
                        </button>
                        {/* Required vs. optional, said once, where the decision is
                            made. Without this the buttons look identical and a
                            user who can't finish Twitch assumes sign-up is broken. */}
                        {!twitchProofToken && (
                          <p className="text-[11px] text-gray-500 leading-relaxed">
                            You'll need Twitch to claim an hour and go on air — but not to have an account.
                            Connect it any time from your profile.
                          </p>
                        )}
                        {returnedFromTwitch && emailMode && !password && (
                          <Notice tone="warning" compact>Twitch connected. Re-enter your password to finish — we never keep it across the redirect.</Notice>
                        )}
                      </>
                    )}

                    {/* Email + password: always on for sign-in, opt-in for sign-up. */}
                    {(!isRegister || emailMode) && (
                      <>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@example.com" required disabled={loading} autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                        </div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                          <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary-500/50" placeholder="Enter password" required minLength={6} disabled={loading} autoComplete={isRegister ? 'new-password' : 'current-password'} />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">{showPassword ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}</button>
                        </div>
                        {isRegister && (
                          <>
                            <label className="block text-sm font-medium text-gray-300 mb-1.5">Confirm Password</label>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                              <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary-500/50" placeholder="Confirm password" required minLength={6} disabled={loading} autoComplete="new-password" />
                              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label={showConfirmPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">{showConfirmPassword ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}</button>
                            </div>
                          </>
                        )}
                      </>
                    )}

                    <Button variant="primary" size="lg" className="w-full" type="submit" isLoading={loading}>{isRegister ? 'Create Account' : 'Sign In'}</Button>
                  </>
                )}

                {/* The escape hatch, stated as the trade-off it is rather than as
                    a second equal option: a password is the only credential here
                    that survives losing a seed phrase. It also stays reachable
                    after a failed submit — a wallet too new to pass the sign-up
                    checks needs a way forward that isn't "come back later" — and
                    it sits below the wallet button because Phantom is required on
                    BOTH paths, so there is never a version of this form that
                    skips it. */}
                {isRegister && walletReady && !emailMode && (
                  <button
                    type="button"
                    onClick={() => setEmailMode(true)}
                    className="w-full text-xs text-gray-500 hover:text-gray-300 underline cursor-pointer pt-1"
                  >
                    Also add an email and password (lets you recover the account without your wallet)
                  </button>
                )}

                {/* Sign-in's secondary route. Every account made before wallet
                    sign-up has a password, and some members will add one for
                    recovery, so this can never go away — it just stops being the
                    thing people see first. */}
                {!isRegister && !emailMode && (
                  <>
                    <div className="flex items-center gap-3 py-1">
                      <span className="h-px flex-1 bg-white/10" />
                      <span className="text-[11px] uppercase tracking-widest text-gray-500">or</span>
                      <span className="h-px flex-1 bg-white/10" />
                    </div>
                    <button
                      type="button"
                      onClick={() => { setError(''); setEmailMode(true) }}
                      className="w-full h-12 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <Mail className="w-4 h-4" aria-hidden />
                      Sign in with email and password
                    </button>
                  </>
                )}

                {/* ...and the way back, so choosing email isn't a one-way door. */}
                {!isRegister && emailMode && (
                  <button
                    type="button"
                    onClick={() => { setError(''); setEmailMode(false) }}
                    className="w-full text-xs text-gray-500 hover:text-gray-300 underline cursor-pointer pt-1"
                  >
                    Sign in with Phantom instead
                  </button>
                )}
                <p className="text-sm text-center text-gray-500 mt-2">
                  {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
                  <button type="button" onClick={switchMode} className="text-primary-400 hover:text-primary-300 underline cursor-pointer">
                    {isRegister ? 'Sign in' : 'Create one'}
                  </button>
                </p>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
