import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Eye, EyeOff, Lock, Mail, Twitch, User, Wallet, X } from 'lucide-react'
import { Notice } from '@/components/ui/Notice'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/useAuth'
import { usePhantomWallet } from '@/hooks/usePhantomWallet'
import { api, type TwitchProof } from '@/lib/api'
import { clearTwitchProof, readTwitchProof } from '@/lib/twitchProof'
import { clearRegisterDraft, readRegisterDraft, storeRegisterDraft } from '@/lib/registerDraft'
import { useScrollLock } from '@/hooks/useScrollLock'

interface AuthModalProps { isOpen: boolean; onClose: () => void; initialMode?: 'login' | 'signup' }

type TwitchState = TwitchProof['twitch'] | null

const TWITCH_ERROR_MESSAGES: Record<string, string> = {
  duplicate_twitch: 'This Twitch account is already linked to a CSGN account.',
  oauth_state_expired: 'Twitch verification expired. Please connect Twitch again.',
  oauth_exchange_failed: 'Twitch sign-in failed. Confirm the Twitch redirect URI matches exactly, then try again.',
  oauth_failed: 'Twitch verification failed. Please try again.',
}

export function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const { signIn, signUp, signInWithPhantom, signUpWithPhantom } = useAuth()
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

  const [mode, setMode] = useState<'login' | 'signup'>(initialMode)
  const isRegister = mode === 'signup'
  const [searchParams, setSearchParams] = useSearchParams()

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
      setEmail(draft.email); setUsername(draft.username)
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
    setReturnedFromTwitch(false)
    clearRegisterDraft()
  }

  const switchMode = () => {
    setError(''); setPassword(''); setConfirmPassword('')
    setPhantomProofToken(''); setVerifiedWallet(''); setTwitchProofToken(''); setTwitch(null); setVerifying(null)
    setReturnedFromTwitch(false)
    clearRegisterDraft()
    setMode(m => m === 'login' ? 'signup' : 'login')
  }

  const handleClose = () => { reset(); onClose() }

  /** Login view: prove the wallet, then exchange that proof for a session. */
  /**
   * Wallet-only sign-up. One signature and a username, and you have an account.
   *
   * Falls through to sign-in when the wallet is already registered — someone
   * pressing "sign up" with a known wallet meant to sign in, and an error with
   * no button on it is a dead end.
   */
  const registerWithPhantom = async () => {
    setError(''); setVerifying('phantom')
    try {
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
        throw new Error('Pick a username first — 3–20 letters, numbers or underscores.')
      }
      const address = await connect()
      if (!address) throw new Error('Connect your Phantom wallet to continue.')
      const challenge = await api.createPhantomChallenge(address)
      const signature = await signMessage(challenge.message)
      if (!signature) throw new Error('Signature was declined. Approve it in Phantom to continue.')
      const verified = await api.verifyPhantomSignature(address, signature, challenge.challengeToken)
      await signUpWithPhantom(verified.proofToken, username.trim())
      clearRegisterDraft()
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account.')
    } finally {
      setVerifying(null)
    }
  }

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify Phantom wallet.')
    } finally { setVerifying(null) }
  }

  const connectTwitch = async () => {
    setError(''); setVerifying('twitch')
    try {
      const { authUrl } = await api.startTwitchOAuth()
      // Persist the in-progress form so the user doesn't lose it across the
      // full-page redirect, then redirect (no popup / window.opener) so this
      // works inside mobile in-app browsers like Phantom on iPhone.
      storeRegisterDraft({ email, username, phantomProofToken, verifiedWallet })
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
        if (password !== confirmPassword) throw new Error('Passwords do not match.')
        if (!phantomProofToken) throw new Error('Connect your Phantom wallet to create an account.')
        // Twitch is optional here by design — it gates claiming a slot, not
        // having an account. See finalizeCreateAccount.ts for why that matters
        // (Apple sign-in inside Twitch cannot complete in an embedded webview).
        await signUp(email, password, username, { phantomProofToken, twitchProofToken: twitchProofToken || undefined })
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

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4" style={{ height: '100dvh' }}>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative w-full max-w-md max-h-[92vh] bg-[#0c0c1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="relative px-6 sm:px-8 pt-6 sm:pt-8 pb-4">
              <button onClick={handleClose} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5 cursor-pointer"><X className="w-5 h-5" /></button>
              <img src="https://pbs.twimg.com/profile_images/1966988305255276544/3Qz3tNAa_200x200.jpg" alt="CSGN" className="w-12 h-12 rounded-xl object-cover mb-4 shadow-lg" />
              <h2 className="text-2xl font-bold font-display text-white">{isRegister ? 'Join CSGN' : 'Welcome back'}</h2>
              <p className="text-sm text-gray-400 mt-1">
                {isRegister
                  ? 'Sign up with your wallet in one tap, or use an email and password.'
                  : 'Sign in with your email and password, or straight from your wallet.'}
              </p>
            </div>
            <div className="px-6 sm:px-8 pb-8 sm:pb-10 space-y-4 overflow-y-auto max-h-[calc(100dvh-13rem)] overscroll-contain">
              <form onSubmit={handleSubmit} className="space-y-3">
                {error && <Notice tone="error" compact>{error}</Notice>}
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
                <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary-500/50" placeholder="you@example.com" required disabled={loading} /></div>
                {isRegister && <><label className="block text-sm font-medium text-gray-300 mb-1.5">Username</label><div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" /><input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary-500/50" placeholder="csgn_user" required minLength={3} maxLength={20} disabled={loading} /></div></>}
                {/* WALLET-FIRST SIGN-UP. Placed above the email form because it
                    is the shorter path and the one that works everywhere,
                    including in-app browsers where Twitch's Apple hop cannot
                    complete. Email comes later, from the profile, and is only
                    needed to claim a slot. */}
                {isRegister && (
                  <>
                    <button
                      type="button"
                      onClick={() => void registerWithPhantom()}
                      disabled={loading || isConnecting || verifying === 'phantom'}
                      className="w-full h-12 rounded-xl bg-[#ab9ff2] hover:bg-[#bcb0f5] text-black text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
                    >
                      <Wallet className="w-4 h-4" />
                      {verifying === 'phantom' ? 'Check Phantom…' : 'Sign up with Phantom'}
                    </button>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      One signature and you're in. Add an email later to claim a slot, and Twitch to
                      go on air.
                    </p>
                    <div className="flex items-center gap-3 py-1">
                      <span className="h-px flex-1 bg-white/10" />
                      <span className="text-[11px] uppercase tracking-widest text-gray-500">or use email</span>
                      <span className="h-px flex-1 bg-white/10" />
                    </div>
                  </>
                )}
                {isRegister && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button type="button" onClick={connectPhantom} disabled={loading || isConnecting || verifying === 'phantom'} className={`h-12 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 ${phantomProofToken ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}>{phantomProofToken ? <CheckCircle2 className="w-4 h-4" /> : <Wallet className="w-4 h-4" />} {phantomProofToken ? 'Phantom Verified' : verifying === 'phantom' ? 'Verifying…' : 'Connect Phantom'}</button>
                  <button type="button" onClick={connectTwitch} disabled={loading || verifying === 'twitch'} className={`h-12 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 ${twitchProofToken ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}>{twitchProofToken ? <CheckCircle2 className="w-4 h-4" /> : <Twitch className="w-4 h-4" />} {twitchProofToken ? twitch?.displayName || 'Twitch Connected' : verifying === 'twitch' ? 'Opening Twitch…' : 'Connect Twitch'}</button>
                </div>}
                {/* Required vs. optional, said once, where the decision is made.
                    Without this the two buttons look identical and a user who
                    can't finish Twitch assumes sign-up is broken. */}
                {isRegister && !twitchProofToken && (
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    <span className="text-gray-400">Phantom is required.</span> Twitch is optional now — you'll
                    need it to claim a slot and go on air, and you can connect it any time from your profile.
                  </p>
                )}
                {verifiedWallet && <p className="text-xs text-emerald-300 truncate">Wallet verified: {verifiedWallet}</p>}
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
                    <Wallet className="w-4 h-4" />
                    {isMobile ? 'Open in Phantom browser' : 'Install Phantom'}
                  </a>
                )}
                {isRegister && returnedFromTwitch && !password && (
                  <Notice tone="warning" compact>Twitch connected. Re-enter your password to finish — we never keep it across the redirect.</Notice>
                )}
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
                <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" /><input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary-500/50" placeholder="Enter password" required minLength={6} disabled={loading} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div>
                {isRegister && <><label className="block text-sm font-medium text-gray-300 mb-1.5">Confirm Password</label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" /><input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary-500/50" placeholder="Confirm password" required minLength={6} disabled={loading} /><button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">{showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div></>}
                <Button variant="primary" size="lg" className="w-full" type="submit" isLoading={loading}>{isRegister ? 'Create Account' : 'Sign In'}</Button>
                {/* Wallet login — the signature over a server nonce IS the
                    credential, so a returning holder never needs the password. */}
                {!isRegister && (
                  <>
                    <div className="flex items-center gap-3 py-1">
                      <span className="h-px flex-1 bg-white/10" />
                      <span className="text-[11px] uppercase tracking-widest text-gray-500">or</span>
                      <span className="h-px flex-1 bg-white/10" />
                    </div>
                    <button
                      type="button"
                      onClick={loginWithPhantom}
                      disabled={loading || isConnecting || verifying === 'phantom'}
                      className="w-full h-12 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                    >
                      <Wallet className="w-4 h-4" />
                      {verifying === 'phantom' ? 'Check Phantom…' : 'Sign in with Phantom'}
                    </button>
                  </>
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
