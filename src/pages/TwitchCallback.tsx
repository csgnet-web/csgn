import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { useAuth } from '@/contexts/AuthContext'
import {
  clearTwitchAuthFlowState,
  getTwitchReturnTo,
  resolveTwitchUserFromHash,
  setTwitchAuthFlowState,
} from '@/lib/twitchAuth'

export default function TwitchCallback() {
  const { user, refreshProfile, getProfileByTwitchUsername } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(5)
  const processedRef = useRef(false)

  useEffect(() => {
    if (processedRef.current) return
    processedRef.current = true

    ;(async () => {
      try {
        const username = await resolveTwitchUserFromHash(window.location.hash)
        const returnTo = getTwitchReturnTo()

        if (!user && returnTo === '/auth/twitch/complete') {
          const existing = await getProfileByTwitchUsername(username)
          setTwitchAuthFlowState({
            twitchUsername: username,
            existingUid: existing?.uid,
            existingAuthEmail: existing?.authEmail || existing?.email,
          })
          localStorage.setItem('oauth_notice', `Twitch connected: @${username}`)
          navigate('/auth/twitch/complete', { replace: true })
          return
        }

        if (!user) {
          throw new Error('No active user to connect Twitch. Start from Account and try again.')
        }

        await updateDoc(doc(db, 'users', user.uid), {
          'socialLinks.twitch': username,
          username: username,
          usernameLower: username.toLowerCase(),
          authProvider: 'twitch',
        })

        await refreshProfile()
        localStorage.setItem('oauth_notice', 'Twitch connected successfully.')
        clearTwitchAuthFlowState()
        navigate(returnTo, { replace: true })
      } catch (err) {
        const message = err instanceof Error ? err.message : JSON.stringify(err)
        setError(message)
      }
    })()
  }, [getProfileByTwitchUsername, navigate, refreshProfile, user])

  useEffect(() => {
    if (!error) return
    setCountdown(5)
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          navigate('/account', { replace: true })
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [error, navigate])

  return (
    <div className="min-h-screen pt-28 px-4">
      <div className="max-w-2xl mx-auto rounded-xl border border-white/10 bg-white/5 p-5">
        <h1 className="text-white font-semibold">Connecting Twitch…</h1>
        {!error ? (
          <p className="text-sm text-gray-400 mt-2">Please wait while we verify your Twitch account.</p>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="text-xs font-mono text-red-200 bg-black/70 border border-red-400/30 rounded-lg p-3 whitespace-pre-wrap break-all">
              ERROR_REPORT::TWITCH_OAUTH_CALLBACK\n{error}
            </div>
            <p className="text-sm text-gray-300">
              Twitch returned data that could not be completed automatically. We&apos;ll send you back to Account so you can retry.
            </p>
            <p className="text-sm text-amber-300">Redirecting to /account in {countdown}…</p>
          </div>
        )}
      </div>
    </div>
  )
}
