import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { getXReturnTo, resolveXUserFromSearch } from '@/lib/xAuth'

export default function XCallback() {
  const { user, refreshProfile } = useAuth()
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
        await refreshProfile()
        localStorage.setItem('oauth_notice', 'X connected successfully.')
        navigate(getXReturnTo(), { replace: true })
      } catch (err) {
        const message = err instanceof Error ? err.message : JSON.stringify(err)
        setError(message)
      }
    })()
  }, [navigate, refreshProfile, user])

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
              Translation: we got a technical response from X that we couldn't complete automatically. We're taking you back to Watch so you can retry from a clean state.
            </p>
            <p className="text-sm text-amber-300">Redirecting to /watch in {countdown}…</p>
          </div>
        )}
      </div>
    </div>
  )
}
