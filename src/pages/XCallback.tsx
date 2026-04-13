import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { getXReturnTo, resolveXUserFromSearch } from '@/lib/xAuth'

export default function XCallback() {
  const { user, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return

    ;(async () => {
      try {
        const username = await resolveXUserFromSearch(window.location.search)
        await updateDoc(doc(db, 'users', user.uid), {
          'socialLinks.twitter': username,
        })
        await refreshProfile()
        navigate(getXReturnTo(), { replace: true })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to connect X account.'
        setError(message)
      }
    })()
  }, [navigate, refreshProfile, user])

  if (!user) return <Navigate to="/account" replace />

  return (
    <div className="min-h-screen pt-28 px-4">
      <div className="max-w-md mx-auto rounded-xl border border-white/10 bg-white/5 p-5">
        <h1 className="text-white font-semibold">Connecting X…</h1>
        <p className="text-sm text-gray-400 mt-2">
          {error || 'Please wait while we verify your X account.'}
        </p>
      </div>
    </div>
  )
}
