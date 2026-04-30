import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { startTwitchOAuth } from '@/lib/twitchAuth'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: 'login' | 'signup'
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const TwitchIcon = (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4.286 0 0 4.286v15.428H5.143V24l4.286-4.286h3.429L24 8.571V0H4.286zm18 7.714-5.143 5.143h-3.428L10.714 15.86v-3.003H7.286V1.714h15v6z" />
    </svg>
  )

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-[#0c0c1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="relative px-8 pt-8 pb-4">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src="https://pbs.twimg.com/profile_images/1966988305255276544/3Qz3tNAa_200x200.jpg"
                alt="CSGN"
                className="w-12 h-12 rounded-xl object-cover mb-4 shadow-lg"
              />
              <h2 className="text-2xl font-bold font-display text-white">Sign in to CSGN</h2>
              <p className="text-sm text-gray-400 mt-1">
                CSGN runs on Twitch. Connect your Twitch account to sign in or create a new account.
              </p>
            </div>

            <div className="px-8 pb-8 space-y-4">
              <Button
                size="lg"
                className="w-full bg-[#9146FF] hover:bg-[#7d33ea] text-white shadow-lg shadow-[#9146FF]/30"
                type="button"
                onClick={() => startTwitchOAuth('/auth/twitch/complete')}
                leftIcon={TwitchIcon}
              >
                CONTINUE WITH TWITCH
              </Button>

              <p className="text-[11px] text-gray-500 text-center leading-relaxed">
                New here? After Twitch you'll choose a username, set an email, connect your Phantom wallet, and pick a password.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
