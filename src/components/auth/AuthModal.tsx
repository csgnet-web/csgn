import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, Eye, EyeOff, Lock, Mail, Twitch, Wallet, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { usePhantomWallet } from '@/hooks/usePhantomWallet'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: 'login' | 'signup'
}

export function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const { signIn, signUp } = useAuth()
  const { connect, isConnecting, walletAddress, error: walletError } = usePhantomWallet()
  const [identifier, setIdentifier] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [photoURL, setPhotoURL] = useState('')
  const [twitchUsername, setTwitchUsername] = useState('')
  const [connectedWallet, setConnectedWallet] = useState<string>('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isRegister = initialMode === 'signup'


  const handleClose = () => {
    setError('')
    setIdentifier('')
    setDisplayName('')
    setPhotoURL('')
    setTwitchUsername('')
    setConnectedWallet('')
    setPassword('')
    setConfirmPassword('')
    onClose()
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (isRegister) {
        if (password !== confirmPassword) throw new Error('Password confirmation does not match.')
        if (!displayName.trim()) throw new Error('Display name is required.')
        if (!twitchUsername.trim()) throw new Error('Connect your Twitch username to continue.')
        await signUp(identifier, password, displayName.trim(), {
          photoURL: photoURL.trim() || null,
          twitchUsername: twitchUsername.trim().replace(/^@/, ''),
          walletAddress: connectedWallet || walletAddress || '',
        })
      } else {
        await signIn(identifier, password)
      }
      handleClose()
    } catch (err: unknown) {
      const code = err instanceof Error && 'code' in err ? String((err as { code?: string }).code || '') : ''
      if (err instanceof Error && err.message.includes('confirmation')) {
        setError('Passwords do not match.')
      } else if (err instanceof Error && err.message.includes('Display name')) {
        setError('Please add a display name.')
      } else if (err instanceof Error && err.message.includes('Twitch')) {
        setError('Please connect your Twitch username.')
      } else if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Invalid email/username or password.')
      } else if (code === 'auth/invalid-email') {
        setError('Please enter a valid email address.')
      } else if (code === 'auth/email-already-in-use') {
        setError('That email is already in use.')
      } else {
        setError(isRegister ? 'Sign up failed. Please try again.' : 'Sign in failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
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
            <div className="relative px-8 pt-8 pb-4">
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src="https://pbs.twimg.com/profile_images/1966988305255276544/3Qz3tNAa_200x200.jpg"
                alt="CSGN"
                className="w-12 h-12 rounded-xl object-cover mb-4 shadow-lg"
              />
              <h2 className="text-2xl font-bold font-display text-white">
                {isRegister ? 'Join CSGN' : 'Welcome back'}
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                {isRegister
                  ? 'Create your CSGN account with email & password.'
                  : 'Sign in with your email/username and password.'}
              </p>
            </div>

            <div className="px-8 pb-8 space-y-4">
              <form onSubmit={handleEmailSubmit} className="space-y-3">
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-300">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">{isRegister ? 'Email' : 'Email or Username'}</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50" placeholder={isRegister ? 'you@example.com' : 'you@example.com or username'} required disabled={loading} />
                  </div>
                </div>
                {isRegister && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">Display Name</label>
                      <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50" placeholder="How should we show your name?" required disabled={loading} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">Profile Picture URL (optional)</label>
                      <input type="url" value={photoURL} onChange={(e) => setPhotoURL(e.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50" placeholder="https://..." disabled={loading} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">Twitch Username</label>
                      <div className="relative">
                        <Twitch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input type="text" value={twitchUsername} onChange={(e) => setTwitchUsername(e.target.value.replace(/\s+/g, ''))} className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50" placeholder="@yourchannel" required disabled={loading} />
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-gray-300 flex items-center gap-2"><Wallet className="w-4 h-4 text-cyan-400" /> Phantom Wallet</p>
                        <Button type="button" variant="secondary" size="sm" isLoading={isConnecting} onClick={async () => {
                          const addr = await connect()
                          if (addr) setConnectedWallet(addr)
                        }}>Connect</Button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        {(connectedWallet || walletAddress) ? `Connected: ${(connectedWallet || walletAddress || '').slice(0, 8)}...${(connectedWallet || walletAddress || '').slice(-6)}` : 'Optional now, but required before payout.'}
                      </p>
                      {walletError && <p className="text-xs text-red-300 mt-1">{walletError}</p>}
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50" placeholder="Enter password" required minLength={6} disabled={loading} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {isRegister && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50" placeholder="Confirm password" required minLength={6} disabled={loading} />
                      <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer">
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
                <Button variant="primary" size="lg" className="w-full" type="submit" isLoading={loading}>
                  {isRegister ? 'Create Account' : 'Sign In'}
                </Button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
