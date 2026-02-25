import { useState } from 'react'
import { motion } from 'framer-motion'
import { Send, User, CheckCircle, AlertCircle, Mic, Gamepad2, Tv, FileText } from 'lucide-react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SectionHeading } from '@/components/ui/SectionHeading'

const contentTypes = [
  { value: 'crypto-news', label: 'Crypto News & Drama', icon: Mic },
  { value: 'sports-gaming', label: 'Sports Gaming', icon: Gamepad2 },
  { value: 'esports', label: 'Esports / Competitive', icon: Tv },
  { value: 'market-analysis', label: 'Market Analysis', icon: FileText },
  { value: 'entertainment', label: 'Entertainment', icon: User },
]

export default function Apply() {
  const { user, profile } = useAuth()
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    displayName: profile?.displayName || '',
    email: user?.email || '',
    twitterHandle: '',
    twitchChannel: '',
    youtubeChannel: '',
    contentType: '',
    experience: '',
    whyCSGN: '',
    sampleContent: '',
    preferredSlot: 'any',
    weeklyHours: '5-10',
  })

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
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
          description="Join the network. Get your own time slot. Earn 50% of token trading fees while you broadcast to the CSGN community."
        />

        {/* Benefits */}
        <div className="grid sm:grid-cols-3 gap-4 mb-12">
          {[
            { title: '50% Revenue Share', desc: 'Earn half of all trading fees during your slot', icon: '💰' },
            { title: 'Built-in Audience', desc: 'Tap into CSGN\'s growing viewer base from day one', icon: '👥' },
            { title: 'Network Support', desc: 'Production tools, promotion, and a professional platform', icon: '🚀' },
          ].map((benefit) => (
            <Card key={benefit.title} className="p-5 text-center" hover={false}>
              <span className="text-2xl mb-3 block">{benefit.icon}</span>
              <h3 className="font-semibold text-white text-sm mb-1">{benefit.title}</h3>
              <p className="text-xs text-gray-500">{benefit.desc}</p>
            </Card>
          ))}
        </div>

        {/* Application Form */}
        <Card hover={false} className="overflow-hidden">
          <div className="p-6 border-b border-white/[0.06]">
            <h3 className="text-lg font-semibold font-display text-white">Streamer Application</h3>
            <p className="text-sm text-gray-400 mt-1">Fill out the form below. All fields marked with * are required.</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
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
                    onChange={(e) => updateField('displayName', e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20 transition-all"
                    placeholder="Your streamer name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20 transition-all"
                    placeholder="you@example.com"
                  />
                </div>
              </div>
            </div>

            {/* Social Links */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Social & Content Links</h4>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Twitter / X</label>
                  <input
                    type="text"
                    value={form.twitterHandle}
                    onChange={(e) => updateField('twitterHandle', e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20 transition-all"
                    placeholder="@handle"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Twitch</label>
                  <input
                    type="text"
                    value={form.twitchChannel}
                    onChange={(e) => updateField('twitchChannel', e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20 transition-all"
                    placeholder="channel name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">YouTube</label>
                  <input
                    type="text"
                    value={form.youtubeChannel}
                    onChange={(e) => updateField('youtubeChannel', e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20 transition-all"
                    placeholder="channel URL"
                  />
                </div>
              </div>
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
                  <option value="auction">Auction (3AM-2PM)</option>
                  <option value="lottery">Lottery (2PM-6PM)</option>
                  <option value="prime">Prime Time (6PM-3AM)</option>
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
