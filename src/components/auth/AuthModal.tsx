import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
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
  const [socialError, setSocialError] = useState('')

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
    setSocialError('')
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
        await signUp(identifier, password, displayName.trim(), {
          photoURL: photoURL.trim() || null,
          twitchUsername: twitchUsername.trim().replace(/^@/, ''),
          walletAddress: connectedWallet || walletAddress || '',
        })
      } else {
        await signIn(identifier, password)
      }
      if (isRegister) {
        handleClose()
        navigate('/watch', { state: { accountCreated: true } })
      } else {
        handleClose()
      }
    } catch (err: unknown) {
      const code = err instanceof Error && 'code' in err ? String((err as { code?: string }).code || '') : ''
      if (err instanceof Error && err.message.includes('confirmation')) {
        setError('Passwords do not match.')
      } else if (err instanceof Error && err.message.includes('Display name')) {
        setError('Please add a display name.')
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
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
            className="relative w-full max-w-md max-h-[92vh] bg-[#0c0c1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="relative px-6 sm:px-8 pt-6 sm:pt-8 pb-4">
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
              {!isRegister && (
                <p className="text-sm text-gray-400 mt-1">
                  Sign in with your email/username and password.
                </p>
              )}
            </div>

            <div className="px-6 sm:px-8 pb-8 sm:pb-10 space-y-4 overflow-y-auto max-h-[calc(92vh-120px)]">
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
                    <input type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-base sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50" placeholder={isRegister ? 'you@example.com' : 'you@example.com or username'} required disabled={loading} />
                  </div>
                </div>
                {isRegister && (
                  <>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Display Name</label>
                        <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-base sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50" placeholder="Your name" required disabled={loading} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Profile Picture</label>
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                          className="w-full h-12 px-3 bg-white/5 border border-white/10 rounded-xl text-base sm:text-sm text-gray-300 file:mr-2 file:h-8 file:px-2 file:rounded-lg file:border-0 file:bg-white/10 file:text-white"
                          disabled={loading}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            const allowed = ['image/jpeg', 'image/png']
                            if (!allowed.includes(file.type) || file.size > 4 * 1024 * 1024) {
                              setSocialError('Profile image must be JPG/PNG and up to 4MB.')
                              e.currentTarget.value = ''
                              setPhotoURL('')
                              return
                            }
                            setSocialError('')
                            const reader = new FileReader()
                            reader.onload = () => setPhotoURL(typeof reader.result === 'string' ? reader.result : '')
                            reader.readAsDataURL(file)
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="flex-1 h-11 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 bg-white/5 border-white/10 text-white hover:bg-white/10"
                          onClick={() => {}}
                        >
                          <Twitch className="w-4 h-4" /> Connect Twitch
                        </button>
                        <button type="button" className={`flex-1 h-11 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 ${connectedWallet || walletAddress ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`} onClick={async () => {
                          const addr = await connect()
                          if (addr) setConnectedWallet(addr)
                        }} disabled={loading || isConnecting}>
                          <Wallet className="w-4 h-4" /> {connectedWallet || walletAddress ? 'Phantom Connected' : 'Connect Phantom'}
                        </button>
                      </div>
                      {socialError && <p className="text-xs text-red-300 mt-1">{socialError}</p>}
                      {walletError && <p className="text-xs text-red-300 mt-1">{walletError}</p>}
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-base sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50" placeholder="Enter password" required minLength={6} disabled={loading} />
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
                      <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-base sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50" placeholder="Confirm password" required minLength={6} disabled={loading} />
                      <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer">
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
                <div className="sticky bottom-0 pt-2 pb-1 bg-gradient-to-t from-[#0c0c1a] via-[#0c0c1a] to-transparent">
                  <Button variant="primary" size="lg" className="w-full" type="submit" isLoading={loading}>
                    {isRegister ? 'Create Account' : 'Sign In'}
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
