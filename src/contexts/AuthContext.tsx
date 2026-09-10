import { useEffect, useState, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  createUserWithEmailAndPassword,
  linkWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  TwitterAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut as firebaseSignOut,
  sendEmailVerification,
  type User,
  type AuthProvider as FirebaseAuthProvider,
} from 'firebase/auth'
import { isEmbeddedBrowser } from '@/lib/webview'
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

  /* ── One-tap sign-in ────────────────────────────────────────────────────
   *
   * Google, X, and an email link. No password to invent, no wallet to install,
   * and — the part that matters — no decision about whether this is a sign-UP
   * or a sign-IN. The provider knows. If a profile already exists we load it;
   * if not, `finalizeSocialAccount` mints one with a handle nobody had to think
   * of. That is the whole reason this replaced a five-step form.
   *
   * A wallet is still offered, and still required to be PAID — just not to
   * exist here.
   */
  const socialSignIn = async (provider: FirebaseAuthProvider, label: string) => {
    await logAuthEvent('signin-start', { meta: { method: label } })
    try {
      // A popup is better UX where it works, and is silently killed inside
      // Phantom's / Instagram's in-app browser — so those get a full-page
      // redirect instead. Same reasoning as the Twitch handoff in
      // useTwitchLink: never hand an embedded webview a popup.
      if (isEmbeddedBrowser()) {
        await signInWithRedirect(auth, provider)
        return
      }
      const { user: firebaseUser } = await signInWithPopup(auth, provider)
      await ensureProfile(firebaseUser)
      await logAuthEvent('signin-success', { uid: firebaseUser.uid, meta: { method: label } })
    } catch (err) {
      await logAuthEvent('signin-failure', {
        errorMessage: err instanceof Error ? err.message : String(err),
        meta: { method: label },
      })
      throw err
    }
  }

  /** Create the CSGN profile if this Firebase user does not have one yet.
   *  Safe to call on every sign-in — the function answers `created: false` for
   *  an account that already exists rather than erroring. */
  const ensureProfile = async (firebaseUser: User) => {
    try {
      await api.finalizeSocialAccount()
    } catch (err) {
      console.warn('Could not finalize social account:', err)
    }
    await fetchProfile(firebaseUser.uid)
  }

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider()
    // Always ask which account — a shared device that silently reuses the last
    // Google session is how somebody ends up posting from someone else's name.
    provider.setCustomParameters({ prompt: 'select_account' })
    await socialSignIn(provider, 'google')
  }

  const signInWithX = async () => {
    await socialSignIn(new TwitterAuthProvider(), 'x')
  }

  /** Email link ("magic link") — no password ever created, so none can be
   *  forgotten, reused or leaked. The link returns to /auth/email/complete. */
  const sendEmailLink = async (email: string) => {
    const clean = email.trim().toLowerCase()
    await logAuthEvent('signup-email-start', { meta: { method: 'email-link' } })
    await sendSignInLinkToEmail(auth, clean, {
      url: `${window.location.origin}/auth/email/complete`,
      handleCodeInApp: true,
    })
    // Kept so the completion page can finish without asking for the address
    // again — Firebase requires the original email to redeem the link.
    window.localStorage.setItem('csgn:emailForSignIn', clean)
  }

  /** Finish an email-link sign-in on the landing page. */
  const completeEmailLink = async (href: string, fallbackEmail?: string) => {
    if (!isSignInWithEmailLink(auth, href)) throw new Error('That link is not a valid sign-in link.')
    const stored = window.localStorage.getItem('csgn:emailForSignIn') || fallbackEmail || ''
    if (!stored) throw new Error('Enter the email address the link was sent to.')
    const { user: firebaseUser } = await signInWithEmailLink(auth, stored, href)
    window.localStorage.removeItem('csgn:emailForSignIn')
    await ensureProfile(firebaseUser)
    await logAuthEvent('signup-email-success', { uid: firebaseUser.uid, meta: { method: 'email-link' } })
  }

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
   * TikTok as the credential. The account already exists by the time we get
   * here — `tiktokOAuthCallback` created it (or recognised a returning one) and
   * minted this token — so there is nothing to create and nothing to ask for.
   */
  const signInWithTikTok = async (customToken: string) => {
    void logAuthEvent('signin-start', { meta: { identifierKind: 'tiktok' } })
    try {
      const { user } = await signInWithCustomToken(auth, customToken)
      await fetchProfile(user.uid)
      void logAuthEvent('signin-success', { uid: user.uid, meta: { identifierKind: 'tiktok' } })
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

  return <AuthContext.Provider value={{ user, profile, loading, signIn, signInWithPhantom, signInWithTikTok, signInWithGoogle, signInWithX, sendEmailLink, completeEmailLink, signUp, signUpWithPhantom, addEmailPassword, signOut, refreshProfile, resendVerification }}>{children}</AuthContext.Provider>
}
