import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { startTwitchOAuth } from '@/lib/twitchAuth'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode: 'login' | 'signup'
}

export function AuthModal({ isOpen, onClose, initialMode }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [verificationSent, setVerificationSent] = useState(false)
  const { signIn, resendVerification } = useAuth()
  const TwitchIcon = (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4.286 0 0 4.286v15.428H5.143V24l4.286-4.286h3.429L24 8.571V0H4.286zm18 7.714-5.143 5.143h-3.428L10.714 15.86v-3.003H7.286V1.714h15v6z" />
    </svg>
  )

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn(email, password)
      onClose()
      setEmail('')
      setPassword('')
    } catch (err: unknown) {
      const code = err instanceof Error && 'code' in err ? String((err as { code?: string }).code || '') : ''
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Invalid email/username or password')
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
                  <p className="text-sm text-gray-400 mt-1">
                    {mode === 'login'
                      ? 'Sign in with email or username + password'
                      : 'Sign up with Twitch — pick a username and password after connecting'}
                  </p>
                </div>

                {mode === 'login' ? (
                  <form onSubmit={handleLogin} className="px-8 pb-8 space-y-4">
                    {error && (
                      <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {error}
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">Email or Username</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                          type="text"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50"
                          placeholder="you@example.com or twitch username"
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
                          placeholder="Enter password"
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
                      Sign In
                    </Button>

                    <div className="text-center text-sm text-gray-400">
                      Don't have an account?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setMode('signup')
                          setError('')
                        }}
                        className="text-primary-400 hover:text-primary-300 font-medium transition-colors cursor-pointer"
                      >
                        Sign up with Twitch
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="px-8 pb-8 space-y-4">
                    <p className="text-sm text-gray-300">
                      Connect your Twitch account to continue. After connecting, you'll choose a CSGN username and password.
                    </p>

                    <Button
                      variant="twitch"
                      size="lg"
                      className="w-full"
                      type="button"
                      onClick={() => startTwitchOAuth('/auth/twitch/complete')}
                      leftIcon={TwitchIcon}
                    >
                      CONNECT WITH TWITCH
                    </Button>

                    <p className="text-xs text-gray-500 text-center">
                      We only read your public Twitch username. No streaming permissions are requested.
                    </p>

                    <div className="text-center text-sm text-gray-400">
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setMode('login')
                          setError('')
                        }}
                        className="text-primary-400 hover:text-primary-300 font-medium transition-colors cursor-pointer"
                      >
                        Sign in
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
