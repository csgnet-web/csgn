import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendEmailVerification,
  updateProfile,
  type User,
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs, limit } from 'firebase/firestore'
import { auth, db } from '@/config/firebase'
import { logAuthEvent } from '@/lib/authEvents'

export interface UserNotification {
  id: string
  type: 'auction_won' | 'prime_assigned' | 'slot_request_accepted' | 'slot_request_declined' | 'fee_paid' | 'fee_declined'
  slotId: string
  slotLabel: string
  slotStart: string
  message: string
  depositRequired?: number
  depositDeadline?: string
  read: boolean
  createdAt: string
}

export interface UserProfile {
  uid: string
  email: string
  authEmail?: string
  displayName: string
  username?: string
  usernameLower?: string
  authProvider?: 'email' | 'twitch'
  photoURL: string | null
  role: 'viewer' | 'streamer' | 'admin'
  createdAt: unknown
  bio?: string
  walletAddress?: string
  twitchUsername?: string
  socialLinks?: { twitter?: string; twitch?: string }
  notifications?: UserNotification[]
  xp?: number
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signIn: (identifier: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<void>
  signUpWithTwitch: (params: { twitchUsername: string; email: string; password: string; displayName: string; walletAddress: string }) => Promise<void>
  getProfileByTwitchUsername: (twitchUsername: string) => Promise<UserProfile | null>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  resendVerification: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (uid: string) => {
    const docRef = doc(db, 'users', uid)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      setProfile(docSnap.data() as UserProfile)
    }
    return docSnap.exists() ? (docSnap.data() as UserProfile) : null
  }

  const createProfile = async (
    user: User,
    displayName: string,
    overrides?: Partial<UserProfile>,
  ) => {
    const profileData: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      authEmail: user.email || '',
      displayName,
      photoURL: user.photoURL,
      role: 'viewer',
      createdAt: serverTimestamp(),
      notifications: [],
      authProvider: 'email',
      ...overrides,
    }
    await setDoc(doc(db, 'users', user.uid), profileData)
    setProfile(profileData)
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user)
      if (user) {
        try {
          await fetchProfile(user.uid)
        } catch (err) {
          console.warn('Failed to fetch user profile from Firestore:', err)
        }
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const resolveSignInEmail = async (identifier: string) => {
    if (identifier.includes('@')) return identifier

    const username = identifier.trim().toLowerCase()
    const usersQ = query(collection(db, 'users'), where('usernameLower', '==', username), limit(1))
    const snap = await getDocs(usersQ)
    const profile = snap.docs[0]?.data() as UserProfile | undefined
    const authEmail = profile?.authEmail || profile?.email
    if (!authEmail) {
      const err = new Error('Invalid username or password') as Error & { code?: string }
      err.code = 'auth/user-not-found'
      throw err
    }
    return authEmail
  }

  const signIn = async (identifier: string, password: string) => {
    void logAuthEvent('signin-start', { meta: { identifierKind: identifier.includes('@') ? 'email' : 'username' } })
    try {
      const email = await resolveSignInEmail(identifier)
      const { user } = await signInWithEmailAndPassword(auth, email, password)
      try {
        await fetchProfile(user.uid)
      } catch (err) {
        console.warn('Failed to fetch profile on sign-in:', err)
        setProfile({
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'User',
          photoURL: user.photoURL,
          role: 'viewer',
          createdAt: null,
        })
      }
      void logAuthEvent('signin-success', { uid: user.uid })
    } catch (err) {
      void logAuthEvent('signin-failure', { errorMessage: err instanceof Error ? err.message : String(err) })
      throw err
    }
  }

  const signUp = async (email: string, password: string, displayName: string) => {
    void logAuthEvent('signup-email-start')
    let createdUid: string | null = null
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password)
      createdUid = user.uid
      await updateProfile(user, { displayName })
      try {
        await sendEmailVerification(user)
      } catch (err) {
        console.warn('Failed to send email verification:', err)
      }
      await createProfile(user, displayName)
      void logAuthEvent('signup-email-success', { uid: user.uid })
    } catch (err) {
      void logAuthEvent('signup-email-failure', {
        uid: createdUid,
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  }

  const getProfileByTwitchUsername = async (twitchUsername: string) => {
    const normalizedUsername = twitchUsername.trim().toLowerCase()
    const byTwitch = query(collection(db, 'users'), where('twitchUsername', '==', normalizedUsername), limit(1))
    const byTwitchSnap = await getDocs(byTwitch)
    if (!byTwitchSnap.empty) return byTwitchSnap.docs[0].data() as UserProfile

    const bySocial = query(collection(db, 'users'), where('socialLinks.twitch', '==', normalizedUsername), limit(1))
    const bySocialSnap = await getDocs(bySocial)
    if (!bySocialSnap.empty) return bySocialSnap.docs[0].data() as UserProfile

    return null
  }

  const signUpWithTwitch = async ({ twitchUsername, email, password, displayName, walletAddress }: { twitchUsername: string; email: string; password: string; displayName: string; walletAddress: string }) => {
    const normalizedTwitch = twitchUsername.trim().toLowerCase()
    void logAuthEvent('signup-twitch-start', { twitchUsername: normalizedTwitch })
    let createdUid: string | null = null
    try {
      if (!walletAddress) throw new Error('A connected Phantom wallet is required to register.')
      const normalizedDisplay = displayName.trim()
      const normalizedUsernameLower = normalizedDisplay.toLowerCase()
      const { user } = await createUserWithEmailAndPassword(auth, email, password)
      createdUid = user.uid
      await updateProfile(user, { displayName: normalizedDisplay })
      try {
        await sendEmailVerification(user)
      } catch (err) {
        console.warn('Failed to send email verification:', err)
      }
      await createProfile(user, normalizedDisplay, {
        email,
        authEmail: email,
        username: normalizedDisplay,
        usernameLower: normalizedUsernameLower,
        authProvider: 'twitch',
        walletAddress,
        twitchUsername: normalizedTwitch,
        socialLinks: { twitch: normalizedTwitch },
      } as Partial<UserProfile>)
      void logAuthEvent('signup-twitch-success', { uid: user.uid, twitchUsername: normalizedTwitch })
    } catch (err) {
      void logAuthEvent('signup-twitch-failure', {
        uid: createdUid,
        twitchUsername: normalizedTwitch,
        errorMessage: err instanceof Error ? err.message : String(err),
      })
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
    if (user && !user.emailVerified) {
      await sendEmailVerification(user)
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signIn, signUp, signUpWithTwitch, getProfileByTwitchUsername, signOut, refreshProfile, resendVerification }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
