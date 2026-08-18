import { createContext } from 'react'

export interface AuthModalContextType {
  /** Open the sign-in sheet from anywhere — a nav tab, a locked page, a CTA. */
  openAuth: () => void
  closeAuth: () => void
  isOpen: boolean
}

export const AuthModalContext = createContext<AuthModalContextType | null>(null)
