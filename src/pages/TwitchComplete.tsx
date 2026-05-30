import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { storeTwitchProof } from '@/lib/twitchProof'
import { CSGNMark } from '@/components/ui/Logo'

// Full-page redirect landing for the mobile-safe Twitch OAuth flow.
// twitchOAuthCallback redirects the browser here with a one-time handoffId;
// we exchange it for the Twitch proof, stash it in sessionStorage, and bounce
// back into the register flow. No window.opener, popups, or third-party cookies.
export default function TwitchComplete() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const handoffId = params.get('handoffId')
    if (!handoffId) {
      navigate('/?auth=register&twitchError=oauth_failed', { replace: true })
      return
    }

    api.consumeTwitchOAuthResult(handoffId)
      .then((result) => {
        storeTwitchProof({
          proofToken: result.twitchProofToken,
          twitch: {
            twitchUserId: result.twitchUserId,
            username: result.username,
            displayName: result.displayName,
            profileImageUrl: result.profileImageUrl,
          },
          // The proof token is minted with a 15-minute TTL server-side.
          expiresAt: Date.now() + 15 * 60 * 1000,
        })
        navigate('/?auth=register&twitch=connected', { replace: true })
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Could not complete Twitch verification.')
        setTimeout(() => navigate('/?auth=register&twitchError=oauth_failed', { replace: true }), 1800)
      })
  }, [params, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        {error ? (
          <>
            <AlertCircle className="w-10 h-10 text-red-400" />
            <p className="text-sm text-red-300 max-w-sm">{error}</p>
            <p className="text-xs text-gray-500">Returning you to sign up…</p>
          </>
        ) : (
          <>
            <CSGNMark className="w-12 h-12 animate-pulse" />
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Finishing Twitch verification…</p>
          </>
        )}
      </div>
    </div>
  )
}
