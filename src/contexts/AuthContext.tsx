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
  signUpWithTwitch: (params: { twitchUsername: string; email: string; displayName: string; password?: string }) => Promise<void>
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
  }

  const signUp = async (email: string, password: string, displayName: string) => {
    const { user } = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(user, { displayName })
    await sendEmailVerification(user)
    try {
      await createProfile(user, displayName)
    } catch (err) {
      console.warn('Failed to create Firestore profile (user still created in Auth):', err)
      setProfile({
        uid: user.uid,
        email: user.email || '',
        displayName,
        photoURL: user.photoURL,
        role: 'viewer',
        createdAt: null,
      })
    }
  }

  const getProfileByTwitchUsername = async (twitchUsername: string) => {
    const normalizedUsername = twitchUsername.trim().toLowerCase()
    const usersQ = query(collection(db, 'users'), where('usernameLower', '==', normalizedUsername), limit(1))
    const snap = await getDocs(usersQ)
    return snap.docs[0]?.data() as UserProfile | null
  }

  const signUpWithTwitch = async ({ twitchUsername, email, displayName, password }: { twitchUsername: string; email: string; displayName: string; password?: string }) => {
    const normalizedUsername = twitchUsername.trim().toLowerCase()
    const authPassword = password || `${crypto.randomUUID()}-TwitchAuth9!`
    const { user } = await createUserWithEmailAndPassword(auth, email, authPassword)
    await updateProfile(user, { displayName })
    await sendEmailVerification(user)

    try {
      await createProfile(user, displayName, {
        email,
        authEmail: email,
        username: twitchUsername,
        usernameLower: normalizedUsername,
        authProvider: 'twitch',
        socialLinks: { twitch: normalizedUsername },
      })
    } catch (err) {
      console.warn('Failed to create Firestore profile (user still created in Auth):', err)
      setProfile({
        uid: user.uid,
        email,
        authEmail: email,
        displayName,
        username: twitchUsername,
        usernameLower: normalizedUsername,
        authProvider: 'twitch',
        photoURL: user.photoURL,
        role: 'viewer',
        createdAt: null,
        socialLinks: { twitch: normalizedUsername },
      })
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
