import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2, ChevronRight, Lock, Mail, User, Wallet } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { usePhantomWallet } from '@/hooks/usePhantomWallet'
import { clearTwitchAuthFlowState, getTwitchAuthFlowState } from '@/lib/twitchAuth'

type Step = 'username' | 'email' | 'wallet' | 'password'

export default function TwitchAuthComplete() {
  const flowState = useMemo(() => getTwitchAuthFlowState(), [])
  const navigate = useNavigate()
  const { signIn, signUpWithTwitch } = useAuth()
  const { walletAddress, connect, isConnecting, error: walletError } = usePhantomWallet()

  const isExisting = Boolean(flowState?.existingUid && flowState?.existingAuthEmail)

  const [step, setStep] = useState<Step>(isExisting ? 'password' : 'username')
  const [displayName, setDisplayName] = useState(flowState?.twitchUsername || '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setError('')
  }, [step])

  if (!flowState?.twitchUsername) return <Navigate to="/" replace />

  const proceedFromUsername = (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) return setError('Pick a username to continue.')
    setStep('email')
  }

  const proceedFromEmail = (e: React.FormEvent) => {
    e.preventDefault()
    if (!/.+@.+\..+/.test(email)) return setError('Enter a valid email address.')
    setStep('wallet')
  }

  const handleConnectWallet = async () => {
    setError('')
    const addr = await connect()
    if (!addr) return setError(walletError || 'Phantom is required to register on CSGN.')
    setStep('password')
  }

  const finishSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await signIn(flowState.existingAuthEmail || flowState.twitchUsername, password)
      clearTwitchAuthFlowState()
      navigate('/account', { replace: true })
    } catch {
      setError('Invalid password for this Twitch account.')
    } finally {
      setLoading(false)
    }
  }

  const finishSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (!acceptedTerms) throw new Error('Please accept the Terms & Conditions.')
      if (!walletAddress) throw new Error('Connect your Phantom wallet first.')
      await signUpWithTwitch({
        twitchUsername: flowState.twitchUsername,
        email,
        password,
        displayName: displayName.trim(),
        walletAddress,
      })
      clearTwitchAuthFlowState()
      navigate('/account', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to finish registration.')
    } finally {
      setLoading(false)
    }
  }

  const StepBadge = ({ active, done, label }: { active: boolean; done: boolean; label: string }) => (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
        done
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          : active
            ? 'bg-[#9146FF]/15 border-[#9146FF]/40 text-purple-200'
            : 'bg-white/5 border-white/10 text-gray-500'
      }`}
    >
      {done ? <CheckCircle2 className="w-3 h-3" /> : null}
      {label}
    </div>
  )

  return (
    <div className="min-h-screen pt-24 lg:pt-32 pb-24">
      <div className="max-w-md mx-auto px-4">
        <Card className="p-6" hover={false}>
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#9146FF]/15 text-purple-200 border border-[#9146FF]/40">
              Twitch • @{flowState.twitchUsername}
            </span>
            <span className="text-[11px] text-emerald-300 inline-flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Connected
            </span>
          </div>

          <h1 className="text-2xl font-bold font-display text-white mb-1">
            {isExisting ? 'Welcome back' : 'Finish creating your account'}
          </h1>
          <p className="text-sm text-gray-400 mb-5">
            {isExisting
              ? 'Enter your password to sign in.'
              : 'A few short steps and you\'re live on CSGN.'}
          </p>

          {!isExisting && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              <StepBadge active={step === 'username'} done={['email', 'wallet', 'password'].includes(step)} label="1. Username" />
              <StepBadge active={step === 'email'} done={['wallet', 'password'].includes(step)} label="2. Email" />
              <StepBadge active={step === 'wallet'} done={step === 'password'} label="3. Phantom" />
              <StepBadge active={step === 'password'} done={false} label="4. Password" />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {isExisting && (
            <form onSubmit={finishSignIn} className="space-y-3">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  className="w-full pl-10 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white"
                  placeholder="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoFocus
                />
              </div>
              <Button variant="primary" size="md" className="w-full" isLoading={loading}>
                Sign In with Twitch
              </Button>
            </form>
          )}

          {!isExisting && step === 'username' && (
            <form onSubmit={proceedFromUsername} className="space-y-3">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  className="w-full pl-10 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white"
                  placeholder="Pick a username"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoFocus
                />
              </div>
              <Button variant="primary" size="md" className="w-full" rightIcon={<ChevronRight className="w-4 h-4" />}>
                Continue
              </Button>
            </form>
          )}

          {!isExisting && step === 'email' && (
            <form onSubmit={proceedFromEmail} className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  className="w-full pl-10 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white"
                  placeholder="you@example.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <Button variant="primary" size="md" className="w-full" rightIcon={<ChevronRight className="w-4 h-4" />}>
                Continue
              </Button>
            </form>
          )}

          {!isExisting && step === 'wallet' && (
            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-300">
                <p className="flex items-center gap-2 text-white font-semibold mb-1">
                  <Wallet className="w-4 h-4 text-cyan-300" /> Phantom required
                </p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  CSGN sends payouts and validates participation through your Phantom wallet. Connecting is required to finish registration.
                </p>
                {walletAddress && (
                  <p className="text-xs text-emerald-300 font-mono mt-2 break-all">
                    {walletAddress.slice(0, 6)}…{walletAddress.slice(-6)}
                  </p>
                )}
              </div>
              <Button
                size="md"
                className="w-full bg-[#AB9FF2] hover:bg-[#9d8df0] text-black"
                isLoading={isConnecting}
                onClick={() => void handleConnectWallet()}
              >
                {walletAddress ? 'Reconnect Phantom' : 'Connect Phantom'}
              </Button>
              {walletAddress && (
                <Button variant="primary" size="md" className="w-full" onClick={() => setStep('password')} rightIcon={<ChevronRight className="w-4 h-4" />}>
                  Continue
                </Button>
              )}
            </div>
          )}

          {!isExisting && step === 'password' && (
            <form onSubmit={finishSignUp} className="space-y-3">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  className="w-full pl-10 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white"
                  placeholder="Create a password (min 6 chars)"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoFocus
                />
              </div>
              <label className="flex items-start gap-2 text-xs text-gray-400">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  I agree to the{' '}
                  <a href="/terms" target="_blank" rel="noreferrer" className="text-primary-400 hover:text-primary-300">
                    Terms & Conditions
                  </a>
                  .
                </span>
              </label>
              <Button variant="primary" size="md" className="w-full" isLoading={loading}>
                Finish & Sign In
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
