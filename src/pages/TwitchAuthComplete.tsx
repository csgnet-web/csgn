import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { clearTwitchAuthFlowState, getTwitchAuthFlowState } from '@/lib/twitchAuth'

export default function TwitchAuthComplete() {
  const flowState = useMemo(() => getTwitchAuthFlowState(), [])
  const navigate = useNavigate()
  const { signIn, signUpWithTwitch } = useAuth()

  const [displayName, setDisplayName] = useState(flowState?.twitchUsername || '')
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
        if (!displayName.trim()) throw new Error('Username is required.')
        if (!acceptedTerms) throw new Error('Please accept the Terms & Conditions.')
        await signUpWithTwitch({
          twitchUsername: flowState.twitchUsername,
          email,
          password,
          displayName: displayName.trim(),
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
          <h1 className="text-2xl font-bold font-display text-white mb-2">Twitch Connected</h1>
          <p className="text-sm text-gray-300 mb-5">
            Connected Twitch account: <span className="text-white font-semibold">@{flowState.twitchUsername}</span>
          </p>
          <form onSubmit={complete} className="space-y-3">
            {!isExisting && (
              <>
                <input className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" placeholder="Username" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                <input className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </>
            )}
            <input className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" placeholder={isExisting ? 'Enter password to sign in' : 'Choose password'} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
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
              {isExisting ? 'Sign In with Twitch' : 'Finish Twitch Sign Up'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
