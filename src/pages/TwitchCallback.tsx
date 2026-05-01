import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { OAuthProvider, signInWithCredential } from 'firebase/auth'
import { auth, db } from '@/config/firebase'
import { useAuth } from '@/contexts/AuthContext'
import {
  clearTwitchAuthFlowState,
  getTwitchReturnTo,
  resolveTwitchUserFromHash,
} from '@/lib/twitchAuth'
import { logAuthEvent } from '@/lib/authEvents'

async function signInFirebaseWithTwitch(accessToken: string) {
  const provider = new OAuthProvider('oidc.twitch')
  const credential = provider.credential({ accessToken })
  await signInWithCredential(auth, credential)
}

export default function TwitchCallback() {
  const { user, loading, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(5)
  const processedRef = useRef(false)

  useEffect(() => {
    if (loading) return
    if (processedRef.current) return
    processedRef.current = true

    ;(async () => {
      void logAuthEvent('twitch-callback-start', { uid: user?.uid ?? null })
      try {
        const resolved = await resolveTwitchUserFromHash(window.location.hash)
        const returnTo = getTwitchReturnTo()
        void logAuthEvent('twitch-callback-resolved', {
          twitchUsername: resolved.username,
          uid: user?.uid ?? null,
        })

        if (!user) {
          await signInFirebaseWithTwitch(resolved.accessToken)
          const authUser = auth.currentUser
          if (!authUser) throw new Error('Unable to initialize Firebase session for Twitch user.')

          await setDoc(
            doc(db, 'users', authUser.uid),
            {
              uid: authUser.uid,
              email: resolved.email || authUser.email || '',
              authEmail: resolved.email || authUser.email || '',
              displayName: authUser.displayName || resolved.username,
              photoURL: authUser.photoURL || null,
              role: 'viewer',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              authProvider: 'twitch',
              twitchUsername: resolved.username,
              socialLinks: {
                twitch: resolved.username,
              },
            },
            { merge: true },
          )

          await refreshProfile()
          clearTwitchAuthFlowState()
          localStorage.setItem('oauth_notice', `Twitch connected: @${resolved.username}`)
          navigate(returnTo === '/auth/twitch/complete' ? '/account' : returnTo, { replace: true })
          return
        }

        await setDoc(
          doc(db, 'users', user.uid),
          {
            uid: user.uid,
            email: user.email || resolved.email || '',
            authEmail: user.email || resolved.email || '',
            displayName: user.displayName || resolved.username,
            photoURL: user.photoURL || null,
            role: 'viewer',
            updatedAt: serverTimestamp(),
            twitchUsername: resolved.username,
            socialLinks: {
              twitch: resolved.username,
            },
          },
          { merge: true },
        )
        await refreshProfile()
        void logAuthEvent('twitch-link-merged', { uid: user.uid, twitchUsername: resolved.username })
        localStorage.setItem('oauth_notice', 'Twitch connected successfully.')
        clearTwitchAuthFlowState()
        navigate(returnTo === '/auth/twitch/complete' ? '/account' : returnTo, { replace: true })
      } catch (err) {
        const message = err instanceof Error ? err.message : JSON.stringify(err)
        void logAuthEvent('twitch-link-failure', {
          uid: user?.uid ?? null,
          errorMessage: message,
        })
        setError(message)
      }
    })()
  }, [loading, navigate, refreshProfile, user])

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

  return <div className="min-h-screen pt-28 px-4"><div className="max-w-2xl mx-auto rounded-xl border border-white/10 bg-white/5 p-5"><h1 className="text-white font-semibold">Connecting Twitch…</h1>{!error ? <p className="text-sm text-gray-400 mt-2">Please wait while we verify your Twitch account.</p> : <div className="mt-3 space-y-3"><div className="text-xs font-mono text-red-200 bg-black/70 border border-red-400/30 rounded-lg p-3 whitespace-pre-wrap break-all">ERROR_REPORT::TWITCH_OAUTH_CALLBACK\n{error}</div><p className="text-sm text-gray-300">Translation: Twitch sent us a response we couldn't complete automatically. We'll send you back to Watch so you can retry from a clean slate.</p><p className="text-sm text-amber-300">Redirecting to /watch in {countdown}…</p></div>}</div></div>
}
