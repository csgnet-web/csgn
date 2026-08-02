import { useEffect, useState, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendEmailVerification,
  type User,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/config/firebase'
import { logAuthEvent } from '@/lib/authEvents'
import { api } from '@/lib/api'
import { AuthContext, type UserProfile } from './AuthContextCore'
export type { UserNotification, UserProfile } from './AuthContextCore'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (uid: string) => {
    const docRef = doc(db, 'users', uid)
    const docSnap = await getDoc(docRef)
    const data = docSnap.exists() ? (docSnap.data() as UserProfile) : null
    setProfile(data)
    return data
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        try {
          await fetchProfile(firebaseUser.uid)
        } catch (err) {
          console.warn('Failed to fetch user profile from Firestore:', err)
          setProfile(null)
        }
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const signIn = async (email: string, password: string) => {
    void logAuthEvent('signin-start', { meta: { identifierKind: 'email' } })
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password)
      await fetchProfile(user.uid)
      void logAuthEvent('signin-success', { uid: user.uid })
    } catch (err) {
      void logAuthEvent('signin-failure', { errorMessage: err instanceof Error ? err.message : String(err) })
      throw err
    }
  }

  /**
   * Wallet login: the caller has already proven control of the wallet (challenge
   * → Phantom signature → server verification), so all that's left is trading
   * that proof for a Firebase custom token and exchanging it for a session.
   * Only signs in a wallet already linked to an account — the server 404s
   * otherwise, and no account is ever created here.
   */
  const signInWithPhantom = async (phantomProofToken: string) => {
    void logAuthEvent('signin-start', { meta: { identifierKind: 'phantom' } })
    try {
      const { customToken } = await api.loginWithPhantom(phantomProofToken)
      const { user } = await signInWithCustomToken(auth, customToken)
      await fetchProfile(user.uid)
      void logAuthEvent('signin-success', { uid: user.uid, meta: { identifierKind: 'phantom' } })
    } catch (err) {
      void logAuthEvent('signin-failure', { errorMessage: err instanceof Error ? err.message : String(err) })
      throw err
    }
  }

  /**
   * Create an account from a wallet alone. The signature over a server nonce is
   * the credential — no email, no password, no Twitch. Email (to claim a slot)
   * and Twitch (to go on air) are attached later from the profile.
   */
  const signUpWithPhantom = async (phantomProofToken: string, username: string) => {
    void logAuthEvent('signup-phantom-start')
    try {
      const { customToken } = await api.signUpWithPhantom(phantomProofToken, username)
      const { user } = await signInWithCustomToken(auth, customToken)
      await fetchProfile(user.uid)
      void logAuthEvent('signup-phantom-success', { uid: user.uid })
    } catch (err) {
      void logAuthEvent('signup-phantom-failure', { errorMessage: err instanceof Error ? err.message : String(err) })
      throw err
    }
  }

  const signUp = async (email: string, password: string, username: string, proofs: { phantomProofToken: string; twitchProofToken?: string }) => {
    void logAuthEvent('signup-email-start')
    let createdUid: string | null = null
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password)
      createdUid = user.uid
      try { await sendEmailVerification(user) } catch (err) { console.warn('Failed to send email verification:', err) }
      await user.getIdToken(true)
      await api.finalizeCreateAccount({ username, ...proofs })
      await fetchProfile(user.uid)
      void logAuthEvent('signup-email-success', { uid: user.uid })
    } catch (err) {
      void logAuthEvent('signup-email-failure', { uid: createdUid, errorMessage: err instanceof Error ? err.message : String(err) })
      throw err
    }
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
    setProfile(null)
  }

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.uid)
  }

  const resendVerification = async () => {
    if (user && !user.emailVerified) await sendEmailVerification(user)
  }

  return <AuthContext.Provider value={{ user, profile, loading, signIn, signInWithPhantom, signUpWithPhantom, signUp, signOut, refreshProfile, resendVerification }}>{children}</AuthContext.Provider>
}
