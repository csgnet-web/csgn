import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock, Mail, Twitch, User, Wallet, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/useAuth'
import { usePhantomWallet } from '@/hooks/usePhantomWallet'
import { api, type TwitchProof } from '@/lib/api'

interface AuthModalProps { isOpen: boolean; onClose: () => void; initialMode?: 'login' | 'signup' }

type TwitchState = TwitchProof['twitch'] | null

export function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const { signIn, signUp } = useAuth()
  const { connect, signMessage, isConnecting, walletAddress, error: walletError } = usePhantomWallet()
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

  const isRegister = initialMode === 'signup'

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as Partial<TwitchProof> & { type?: string; error?: string }
      if (data?.type !== 'csgn:twitchProof') return
      if (data.error) { setError('Twitch verification failed. Please try again.'); return }
      if (data.proofToken && data.twitch) { setTwitchProofToken(data.proofToken); setTwitch(data.twitch); setVerifying(null) }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const reset = () => {
    setError(''); setEmail(''); setUsername(''); setPassword(''); setConfirmPassword('')
    setPhantomProofToken(''); setVerifiedWallet(''); setTwitchProofToken(''); setTwitch(null); setVerifying(null)
  }

  const handleClose = () => { reset(); onClose() }

  const connectPhantom = async () => {
    setError(''); setVerifying('phantom')
    try {
      const address = walletAddress || await connect()
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
      window.open(authUrl, 'csgn-twitch-oauth', 'width=520,height=720,popup=yes')
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
        if (!phantomProofToken) throw new Error('Verify your Phantom wallet before creating an account.')
        if (!twitchProofToken) throw new Error('Verify your Twitch account before creating an account.')
        await signUp(email, password, username, { phantomProofToken, twitchProofToken })
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

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md max-h-[92vh] bg-[#0c0c1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="relative px-6 sm:px-8 pt-6 sm:pt-8 pb-4">
              <button onClick={handleClose} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5 cursor-pointer"><X className="w-5 h-5" /></button>
              <img src="https://pbs.twimg.com/profile_images/1966988305255276544/3Qz3tNAa_200x200.jpg" alt="CSGN" className="w-12 h-12 rounded-xl object-cover mb-4 shadow-lg" />
              <h2 className="text-2xl font-bold font-display text-white">{isRegister ? 'Join CSGN' : 'Welcome back'}</h2>
              <p className="text-sm text-gray-400 mt-1">{isRegister ? 'Verify Phantom and Twitch, then create your CSGN account.' : 'Sign in with Firebase email/password.'}</p>
            </div>
            <div className="px-6 sm:px-8 pb-8 sm:pb-10 space-y-4 overflow-y-auto max-h-[calc(92vh-120px)]">
              <form onSubmit={handleSubmit} className="space-y-3">
                {error && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-300"><AlertCircle className="w-4 h-4 shrink-0" /> {error}</div>}
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
                <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary-500/50" placeholder="you@example.com" required disabled={loading} /></div>
                {isRegister && <><label className="block text-sm font-medium text-gray-300 mb-1.5">Username</label><div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" /><input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary-500/50" placeholder="csgn_user" required minLength={3} maxLength={20} disabled={loading} /></div></>}
                {isRegister && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button type="button" onClick={connectPhantom} disabled={loading || isConnecting || verifying === 'phantom'} className={`h-12 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 ${phantomProofToken ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}>{phantomProofToken ? <CheckCircle2 className="w-4 h-4" /> : <Wallet className="w-4 h-4" />} {phantomProofToken ? 'Phantom Verified' : verifying === 'phantom' ? 'Verifying…' : 'Connect Phantom'}</button>
                  <button type="button" onClick={connectTwitch} disabled={loading || verifying === 'twitch'} className={`h-12 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 ${twitchProofToken ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}>{twitchProofToken ? <CheckCircle2 className="w-4 h-4" /> : <Twitch className="w-4 h-4" />} {twitchProofToken ? twitch?.displayName || 'Twitch Verified' : verifying === 'twitch' ? 'Waiting…' : 'Connect Twitch'}</button>
                </div>}
                {verifiedWallet && <p className="text-xs text-emerald-300 truncate">Wallet verified: {verifiedWallet}</p>}
                {walletError && <p className="text-xs text-red-300">{walletError}</p>}
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
                <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" /><input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary-500/50" placeholder="Enter password" required minLength={6} disabled={loading} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div>
                {isRegister && <><label className="block text-sm font-medium text-gray-300 mb-1.5">Confirm Password</label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" /><input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary-500/50" placeholder="Confirm password" required minLength={6} disabled={loading} /><button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">{showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div></>}
                <Button variant="primary" size="lg" className="w-full" type="submit" isLoading={loading}>{isRegister ? 'Create Account' : 'Sign In'}</Button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
