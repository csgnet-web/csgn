import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendEmailVerification,
  type User,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/config/firebase'
import { logAuthEvent } from '@/lib/authEvents'
import { api } from '@/lib/api'

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
  emailLower?: string
  authEmail?: string
  displayName?: string
  username: string
  usernameLower?: string
  photoURL?: string | null
  role: 'user' | 'viewer' | 'streamer' | 'admin'
  status?: 'active' | 'disabled'
  createdAt: unknown
  updatedAt?: unknown
  phantom?: { verified: boolean; walletAddress: string; verifiedAt: unknown }
  twitch?: { verified: boolean; twitchUserId: string; username: string; displayName: string; profileImageUrl: string; verifiedAt: unknown }
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
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, username: string, proofs: { phantomProofToken: string; twitchProofToken: string }) => Promise<void>
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

  const signUp = async (email: string, password: string, username: string, proofs: { phantomProofToken: string; twitchProofToken: string }) => {
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

  return <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, refreshProfile, resendVerification }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
