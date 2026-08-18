import { useMemo, useState, type ReactNode } from 'react'
import { AuthModal } from '@/components/auth/AuthModal'
import { AuthModalContext } from './AuthModalCore'

/**
 * ONE sign-in sheet for the whole app.
 *
 * It used to live inside Header, which meant only Header could open it — so
 * every other surface that needed a signed-in user (Studio, a claim button, a
 * nav tab) had to either render a second copy or send the person somewhere else
 * and hope they came back. Both are how you lose someone who was one tap from
 * an account.
 *
 * Now it is mounted once at the root and opened from anywhere.
 */
export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const value = useMemo(() => ({
    isOpen,
    openAuth: () => setIsOpen(true),
    closeAuth: () => setIsOpen(false),
  }), [isOpen])

  return (
    <AuthModalContext.Provider value={value}>
      {children}
      <AuthModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </AuthModalContext.Provider>
  )
}
