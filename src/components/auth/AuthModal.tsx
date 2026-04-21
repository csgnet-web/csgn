import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Mail, Lock, User, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { startTwitchOAuth, setTwitchSignupPending } from '@/lib/twitchAuth'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode: 'login' | 'signup'
}

export function AuthModal({ isOpen, onClose, initialMode }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [verificationSent, setVerificationSent] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const { signIn, signUp, resendVerification } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'login') {
        await signIn(email, password)
        onClose()
        setEmail('')
        setPassword('')
        setDisplayName('')
      } else {
        if (!displayName.trim()) {
          setError('Display name is required')
          setLoading(false)
          return
        }
        if (!acceptedTerms) {
          setError('Please accept the Terms & Conditions to continue')
          setLoading(false)
          return
        }
        await signUp(email, password, displayName)
        setVerificationSent(true)
      }
    } catch (err: unknown) {
      const code = err instanceof Error && 'code' in err ? String((err as { code?: string }).code || '') : ''
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Invalid email/username or password')
      } else if (code === 'auth/email-already-in-use') {
        setError('An account with this email already exists')
      } else if (code === 'auth/weak-password') {
        setError('Password should be at least 6 characters')
      } else if (code === 'auth/invalid-email') {
        setError('Please enter a valid email address')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setVerificationSent(false)
    setError('')
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-[#0c0c1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            {verificationSent ? (
              <div className="px-8 py-10 text-center">
                <button onClick={handleClose} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold font-display text-white mb-2">Check Your Email</h2>
                <p className="text-sm text-gray-400 mb-6">
                  We sent a verification link to <span className="text-white font-medium">{email}</span>.
                  Click the link to verify your account.
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  You can use CSGN while unverified, but verification is required to bid on slots and enter lotteries.
                </p>
                <div className="flex flex-col gap-3">
                  <Button variant="primary" size="md" className="w-full" onClick={handleClose}>
                    Got it, continue
                  </Button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await resendVerification()
                      } catch { /* ignore */ }
                    }}
                    className="text-sm text-primary-400 hover:text-primary-300 font-medium transition-colors cursor-pointer"
                  >
                    Resend verification email
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="relative px-8 pt-8 pb-4">
                  <button onClick={handleClose} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5 cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                  <img src="https://pbs.twimg.com/profile_images/1966988305255276544/3Qz3tNAa_200x200.jpg" alt="CSGN" className="w-12 h-12 rounded-xl object-cover mb-4 shadow-lg" />
                  <h2 className="text-2xl font-bold font-display text-white">{mode === 'login' ? 'Welcome back' : 'Join CSGN'}</h2>
                  <p className="text-sm text-gray-400 mt-1">{mode === 'login' ? 'Sign in with email or username + password' : 'Create an account with email/password or Twitch'}</p>
                </div>

                <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-4">
                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {error}
                    </div>
                  )}

                  {mode === 'signup' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Display Name</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                          <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50"
                            placeholder="Your streamer name"
                            disabled={loading}
                          />
                        </div>
                      </div>
                      <label className="flex items-start gap-2 text-xs text-gray-400">
                        <input
                          type="checkbox"
                          checked={acceptedTerms}
                          onChange={(e) => setAcceptedTerms(e.target.checked)}
                          className="mt-0.5"
                          disabled={loading}
                        />
                        <span>
                          I agree to the{' '}
                          <a href="/terms" target="_blank" rel="noreferrer" className="text-primary-400 hover:text-primary-300">
                            Terms & Conditions
                          </a>
                          .
                        </span>
                      </label>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">{mode === 'login' ? 'Email or Username' : 'Email'}</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input
                        type={mode === 'login' ? 'text' : 'email'}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50"
                        placeholder={mode === 'login' ? 'you@example.com or twitch username' : 'you@example.com'}
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50"
                        placeholder={mode === 'signup' ? 'Min. 6 characters' : 'Enter password'}
                        required
                        minLength={6}
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <Button variant="primary" size="lg" className="w-full" type="submit" isLoading={loading}>
                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                  </Button>

                  {mode === 'signup' && (
                    <Button
                      variant="secondary"
                      size="lg"
                      className="w-full"
                      type="button"
                      onClick={() => {
                        if (!displayName.trim()) {
                          setError('Display name is required for Twitch signup')
                          return
                        }
                        if (password.length < 6) {
                          setError('Password should be at least 6 characters')
                          return
                        }
                        if (!acceptedTerms) {
                          setError('Please accept the Terms & Conditions to continue')
                          return
                        }
                        setTwitchSignupPending({ displayName: displayName.trim(), password })
                        startTwitchOAuth('/account')
                      }}
                      disabled={loading}
                    >
                      Sign up with Twitch (no email)
                    </Button>
                  )}

                  <div className="text-center text-sm text-gray-400">
                    {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode(mode === 'login' ? 'signup' : 'login')
                        setError('')
                      }}
                      className="text-primary-400 hover:text-primary-300 font-medium transition-colors cursor-pointer"
                    >
                      {mode === 'login' ? 'Sign up' : 'Sign in'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
