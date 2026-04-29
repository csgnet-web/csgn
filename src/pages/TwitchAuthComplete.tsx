import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AlertCircle, User, Lock, Mail } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { clearTwitchAuthFlowState, getTwitchAuthFlowState } from '@/lib/twitchAuth'

export default function TwitchAuthComplete() {
  const flowState = useMemo(() => getTwitchAuthFlowState(), [])
  const navigate = useNavigate()
  const { signIn, signUpWithTwitch } = useAuth()

  const [username, setUsername] = useState(flowState?.twitchUsername || '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!flowState?.twitchUsername) return <Navigate to="/account" replace />

  const isExisting = Boolean(flowState.existingUid && flowState.existingAuthEmail)

  const complete = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (isExisting) {
        await signIn(flowState.twitchUsername, password)
      } else {
        if (!username.trim()) throw new Error('Username is required.')
        if (!email.trim()) throw new Error('Email is required.')
        if (password.length < 6) throw new Error('Password must be at least 6 characters.')
        if (!acceptedTerms) throw new Error('Please accept the Terms & Conditions.')
        await signUpWithTwitch({
          twitchUsername: flowState.twitchUsername,
          email: email.trim(),
          password,
          displayName: username.trim(),
        })
      }
      clearTwitchAuthFlowState()
      navigate('/account', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to continue with Twitch.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen pt-24 lg:pt-32 pb-24">
      <div className="max-w-md mx-auto px-4">
        <Card className="p-6" hover={false}>
          <h1 className="text-2xl font-bold font-display text-white mb-2">
            {isExisting ? 'Welcome back' : 'Almost there'}
          </h1>
          <p className="text-sm text-gray-300 mb-5">
            Twitch connected as <span className="text-white font-semibold">@{flowState.twitchUsername}</span>.
            {isExisting
              ? ' Enter your password to sign in.'
              : ' Pick a CSGN username and password to finish creating your account.'}
          </p>
          <form onSubmit={complete} className="space-y-3">
            {!isExisting && (
              <>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    className="w-full pl-10 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    className="w-full pl-10 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    placeholder="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </>
            )}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                className="w-full pl-10 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                placeholder={isExisting ? 'Enter password to sign in' : 'Choose password (min. 6 characters)'}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            {!isExisting && (
              <label className="flex items-start gap-2 text-xs text-gray-400">
                <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="mt-0.5" />
                <span>I agree to the <a href="/terms" className="text-primary-400 hover:text-primary-300">Terms & Conditions</a>.</span>
              </label>
            )}
            {error && (
              <p className="text-xs text-red-300 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {error}
              </p>
            )}
            <Button variant="primary" size="md" className="w-full" isLoading={loading}>
              {isExisting ? 'Sign In with Twitch' : 'Finish Sign Up'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
