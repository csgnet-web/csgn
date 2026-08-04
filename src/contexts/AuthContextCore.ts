import { createContext } from 'react'
import type { User } from 'firebase/auth'
import type { GameStats } from '@/lib/games/profile'

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
  /** Empty string on a wallet-only account until the member adds an address. */
  email: string
  emailLower?: string
  /** How the account was created. 'phantom' accounts have no password to reset,
   *  and nothing should nag them to verify an email they never gave. */
  authMethod?: 'email' | 'phantom'
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
  /** Lifetime Squares / Starting 5 record, written server-side by the game
   *  settlement job. Absent until that job runs, which is why every field of
   *  GameStats is optional and the profile renders defensible zeroes. */
  gameStats?: GameStats
}

export interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  /** Wallet login — exchanges a verified Phantom proof for a Firebase session. */
  signInWithPhantom: (phantomProofToken: string) => Promise<void>
  signUp: (email: string, password: string, username: string, proofs: { phantomProofToken: string; twitchProofToken?: string }) => Promise<void>
  /** Wallet-only sign-up — no email, no password. See
   *  netlify/functions/signupWithPhantom.ts for why the wallet alone is enough. */
  signUpWithPhantom: (username: string, proofs: { phantomProofToken: string; twitchProofToken?: string }) => Promise<void>
  /** Attach an email + password to a wallet-only account — the recovery path. */
  addEmailPassword: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  resendVerification: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | null>(null)
