import { useEffect, useState, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  createUserWithEmailAndPassword,
  linkWithCredential,
  EmailAuthProvider,
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

  /**
   * Wallet-only sign-up. The server mints the account documents and hands back
   * a custom token; exchanging it here is what creates the Firebase Auth user,
   * so there is no window where an auth user exists without a profile — the
   * failure mode the email path has to guard against with `createdUid`.
   */
  const signUpWithPhantom = async (username: string, proofs: { phantomProofToken: string; twitchProofToken?: string }) => {
    void logAuthEvent('signup-phantom-start')
    try {
      const { customToken } = await api.signupWithPhantom({ username, ...proofs })
      const { user } = await signInWithCustomToken(auth, customToken)
      await fetchProfile(user.uid)
      void logAuthEvent('signup-phantom-success', { uid: user.uid })
    } catch (err) {
      void logAuthEvent('signup-phantom-failure', { errorMessage: err instanceof Error ? err.message : String(err) })
      throw err
    }
  }

  /**
   * Add an email + password to an account that was created from a wallet.
   *
   * The recovery path wallet-only sign-up owes its members: a seed phrase is the
   * one credential nobody can reset for you, so an account with nothing else on
   * it is one lost phrase away from gone. Firebase does the actual linking (only
   * it can attach a password to an existing user, and only it can enforce one
   * address per auth user); the server call afterwards records the address on
   * the profile and takes the uniqueness lock.
   *
   * Order matters: link first, then refresh the ID token so it CARRIES the new
   * email, then call the server — which reads the address off that verified
   * token rather than trusting anything we send.
   */
  const addEmailPassword = async (email: string, password: string) => {
    const current = auth.currentUser
    if (!current) throw new Error('Please sign in first.')
    await linkWithCredential(current, EmailAuthProvider.credential(email, password))
    await current.getIdToken(true)
    await api.linkEmail()
    try { await sendEmailVerification(current) } catch (err) { console.warn('Failed to send email verification:', err) }
    await current.reload()
    setUser(auth.currentUser)
    await fetchProfile(current.uid)
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

  return <AuthContext.Provider value={{ user, profile, loading, signIn, signInWithPhantom, signUp, signUpWithPhantom, addEmailPassword, signOut, refreshProfile, resendVerification }}>{children}</AuthContext.Provider>
}
