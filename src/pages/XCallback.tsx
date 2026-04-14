import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { getXReturnTo, resolveXUserFromSearch } from '@/lib/xAuth'

export default function XCallback() {
  const { user, profile, setProfileFields } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(5)
  const processedRef = useRef(false)

  useEffect(() => {
    if (!user || processedRef.current) return
    processedRef.current = true

    ;(async () => {
      try {
        const username = await resolveXUserFromSearch(window.location.search)
        await updateDoc(doc(db, 'users', user.uid), {
          'socialLinks.twitter': username,
          twitterUsername: username,
        })
        setProfileFields({ socialLinks: { ...profile?.socialLinks, twitter: username } })
        localStorage.setItem('oauth_notice', 'X connected successfully.')
        navigate(getXReturnTo(), { replace: true })
      } catch (err) {
        const message = err instanceof Error ? err.message : JSON.stringify(err)
        setError(message)
      }
    })()
  }, [navigate, profile?.socialLinks, setProfileFields, user])

  useEffect(() => {
    if (!error) return

    setCountdown(5)
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          navigate('/watch', { replace: true })
          return 0
        }

        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [error, navigate])

  if (!user) return <Navigate to="/account" replace />

  return (
    <div className="min-h-screen pt-28 px-4">
      <div className="max-w-2xl mx-auto rounded-xl border border-white/10 bg-white/5 p-5">
        <h1 className="text-white font-semibold">Connecting X…</h1>
        {!error ? (
          <p className="text-sm text-gray-400 mt-2">Please wait while we verify your X account.</p>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="text-xs font-mono text-red-200 bg-black/70 border border-red-400/30 rounded-lg p-3 whitespace-pre-wrap break-all">
              ERROR_REPORT::X_OAUTH_CALLBACK\n{error}
            </div>
            <p className="text-sm text-gray-300">
              Translation: X rejected part of the authorization handoff, so we couldn't verify which X account belongs to you. We&apos;ll send you back to Watch and you can retry with a clean auth state.
            </p>
            <p className="text-sm text-amber-300">Redirecting to /watch in {countdown}…</p>
          </div>
        )}
      </div>
    </div>
  )
}
