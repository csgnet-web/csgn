import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Send, User, CheckCircle, AlertCircle, Mic, Gamepad2, Tv, FileText } from 'lucide-react'
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { usePhantomWallet } from '@/hooks/usePhantomWallet'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { ConnectionGrid } from '@/components/account/ConnectionGrid'
import { startTwitchOAuth } from '@/lib/twitchAuth'
import { startXOAuth } from '@/lib/xAuth'

const contentTypes = [
  { value: 'crypto-news', label: 'Crypto News & Drama', icon: Mic },
  { value: 'sports-gaming', label: 'Sports Gaming', icon: Gamepad2 },
  { value: 'esports', label: 'Esports / Competitive', icon: Tv },
  { value: 'market-analysis', label: 'Market Analysis', icon: FileText },
  { value: 'entertainment', label: 'Entertainment', icon: User },
]

export default function Apply() {
  const { user, profile, refreshProfile } = useAuth()
  const { connect, disconnect, isConnecting } = usePhantomWallet()

  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [oauthNotice, setOauthNotice] = useState('')
  const [form, setForm] = useState({
    displayName: profile?.displayName || '',
    email: user?.email || '',
    twitterConnected: false,
    twitchConnected: false,
    contentType: '',
    experience: '',
    whyCSGN: '',
    sampleContent: '',
    preferredSlot: 'any',
    weeklyHours: '5-10',
  })


  if (!user) return <Navigate to="/account" replace />

  useEffect(() => {
    const msg = localStorage.getItem('oauth_notice')
    if (!msg) return
    setOauthNotice(msg)
    localStorage.removeItem('oauth_notice')
  }, [])

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }


  const clearSocial = async (platform: 'twitter' | 'twitch') => {
    if (!user) return
    await updateDoc(doc(db, 'users', user.uid), { [`socialLinks.${platform}`]: '' })
    await refreshProfile()
  }

  const connectX = async () => {
    await startXOAuth('/apply')
  }

  const connectTwitch = () => {
    startTwitchOAuth('/apply')
  }

  const connectPhantom = async () => {
    if (!user) return
    const wallet = await connect()
    if (!wallet) return
    await updateDoc(doc(db, 'users', user.uid), { walletAddress: wallet })
    await refreshProfile()
  }

  const disconnectPhantom = async () => {
    if (!user) return
    await disconnect()
    await updateDoc(doc(db, 'users', user.uid), { walletAddress: '' })
    await refreshProfile()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      setError('Please sign in to submit your application.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await addDoc(collection(db, 'applications'), {
        ...form,
        uid: user.uid,
        status: 'pending',
        createdAt: serverTimestamp(),
      })
      setSubmitted(true)
    } catch {
      setError('Failed to submit application. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen pt-24 lg:pt-32 pb-24 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md mx-auto text-center px-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-3xl font-bold font-display text-white mb-3">Application Submitted!</h2>
          <p className="text-gray-400 leading-relaxed mb-6">
            Thank you for applying to stream on CSGN. Our team will review your application and reach out via email within 48 hours.
          </p>
          <Badge variant="green">Application #pending</Badge>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-24 lg:pt-32 pb-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Apply"
          title="Become a"
          highlight="CSGN Streamer"
          description="Join the network. Get your own time slot. Earn 30% of creator fees while you broadcast to the CSGN community."
        />

        {/* Application Form */}
        <Card hover={false} className="overflow-hidden">
          <div className="p-6 border-b border-white/[0.06]">
            <h3 className="text-lg font-semibold font-display text-white">Streamer Application</h3>
            <p className="text-sm text-gray-400 mt-1">Fill out the form below. All fields marked with * are required.</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {oauthNotice && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-sm text-emerald-300">
                {oauthNotice}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Personal Info */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Personal Info</h4>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Display Name *</label>
                  <input
                    type="text"
                    value={form.displayName}
                    readOnly
                    required
                    className="w-full px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl text-sm text-gray-400 cursor-not-allowed"
                    placeholder="Your streamer name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    readOnly
                    required
                    className="w-full px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl text-sm text-gray-400 cursor-not-allowed"
                    placeholder="you@example.com"
                  />
                </div>
              </div>
            </div>

            {/* Platform Connections */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Platform Connections</h4>
              <ConnectionGrid
                items={[
                  {
                    id: 'x',
                    label: 'X',
                    connected: Boolean(profile?.socialLinks?.twitter),
                    username: profile?.socialLinks?.twitter ? `@${profile.socialLinks.twitter}` : undefined,
                    onConnect: () => void connectX(),
                    onDisconnect: () => void clearSocial('twitter'),
                    icon: (
                      <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                    ),
                  },
                  {
                    id: 'twitch',
                    label: 'Twitch',
                    connected: Boolean(profile?.socialLinks?.twitch),
                    username: profile?.socialLinks?.twitch ? `@${profile.socialLinks.twitch}` : undefined,
                    onConnect: () => connectTwitch(),
                    onDisconnect: () => void clearSocial('twitch'),
                    icon: <span className="text-lg font-black tracking-tight">Tw</span>,
                  },
                  {
                    id: 'phantom',
                    label: 'Phantom',
                    connected: Boolean(profile?.walletAddress),
                    username: profile?.walletAddress ? `${profile.walletAddress.slice(0, 6)}...${profile.walletAddress.slice(-4)}` : undefined,
                    onConnect: () => void connectPhantom(),
                    onDisconnect: () => void disconnectPhantom(),
                    loading: isConnecting,
                    icon: <span className="text-lg font-bold">◎</span>,
                  },
                ]}
              />
            </div>

            {/* Content Type */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Content Details</h4>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Primary Content Type *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {contentTypes.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => updateField('contentType', type.value)}
                      className={`flex items-center gap-2 px-3 py-2.5 text-sm rounded-xl border transition-all cursor-pointer ${
                        form.contentType === type.value
                          ? 'bg-primary-500/20 border-primary-500/30 text-primary-400'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <type.icon className="w-4 h-4" />
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Preferences */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Preferred Slot Type</label>
                <select
                  value={form.preferredSlot}
                  onChange={(e) => updateField('preferredSlot', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20 transition-all appearance-none cursor-pointer"
                >
                  <option value="any">No Preference</option>
                  <option value="auction">Auction (3AM-7PM ET)</option>
                  <option value="lottery">CEO Schedule (7PM-3AM ET)</option>
                  <option value="prime">CEO Schedule (7PM-3AM ET)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Available Hours/Week</label>
                <select
                  value={form.weeklyHours}
                  onChange={(e) => updateField('weeklyHours', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20 transition-all appearance-none cursor-pointer"
                >
                  <option value="1-5">1-5 hours</option>
                  <option value="5-10">5-10 hours</option>
                  <option value="10-20">10-20 hours</option>
                  <option value="20+">20+ hours</option>
                </select>
              </div>
            </div>

            {/* Text Areas */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Streaming Experience *</label>
              <textarea
                value={form.experience}
                onChange={(e) => updateField('experience', e.target.value)}
                required
                rows={3}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20 transition-all resize-none"
                placeholder="Tell us about your streaming experience, audience size, and platforms you've streamed on..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Why CSGN? *</label>
              <textarea
                value={form.whyCSGN}
                onChange={(e) => updateField('whyCSGN', e.target.value)}
                required
                rows={3}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20 transition-all resize-none"
                placeholder="What excites you about CSGN? What would you bring to the network?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Sample Content Link</label>
              <input
                type="url"
                value={form.sampleContent}
                onChange={(e) => updateField('sampleContent', e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20 transition-all"
                placeholder="Link to a VOD, clip, or portfolio"
              />
            </div>

            <div className="pt-4 border-t border-white/[0.06]">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full sm:w-auto"
                isLoading={loading}
                leftIcon={<Send className="w-4 h-4" />}
              >
                Submit Application
              </Button>
              <p className="text-xs text-gray-500 mt-3">
                By submitting, you agree to CSGN's streamer guidelines and code of conduct.
              </p>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
