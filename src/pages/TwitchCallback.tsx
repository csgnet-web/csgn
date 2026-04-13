import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { getTwitchReturnTo, resolveTwitchUserFromHash } from '@/lib/twitchAuth'

export default function TwitchCallback() {
  const { user, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return

    ;(async () => {
      try {
        const username = await resolveTwitchUserFromHash(window.location.hash)
        await updateDoc(doc(db, 'users', user.uid), {
          'socialLinks.twitch': username,
        })
        await refreshProfile()
        localStorage.setItem('oauth_notice', 'Twitch connected successfully.')
        navigate(getTwitchReturnTo(), { replace: true })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to connect Twitch account.'
        setError(message)
      }
    })()
  }, [navigate, refreshProfile, user])

  if (!user) return <Navigate to="/account" replace />

  return (
    <div className="min-h-screen pt-28 px-4">
      <div className="max-w-md mx-auto rounded-xl border border-white/10 bg-white/5 p-5">
        <h1 className="text-white font-semibold">Connecting Twitch…</h1>
        <p className="text-sm text-gray-400 mt-2">
          {error || 'Please wait while we verify your Twitch account.'}
        </p>
      </div>
    </div>
  )
}
