import { createContext } from 'react'
import type { User } from 'firebase/auth'

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
  acceptedTosAt?: unknown
  tosVersion?: string
}

export interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, username: string, proofs: { phantomProofToken: string; twitchProofToken: string; tosVersion: string }) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  resendVerification: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | null>(null)
