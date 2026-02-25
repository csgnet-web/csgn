import { motion } from 'framer-motion'
import {
  Coins, ArrowRight, TrendingUp, Users, Tv, Radio,
  Zap, DollarSign, RefreshCw, Gavel, Ticket, Crown,
  Target, Rocket,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SectionHeading } from '@/components/ui/SectionHeading'

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6 },
  }),
}

const revenueStreams = [
  { icon: Coins, label: 'Token Trading Fees (50%)', desc: 'Network share of pump.fun trading fees during live broadcasts', timeline: 'Active Now', active: true },
  { icon: Gavel, label: 'Auction Slot Revenue', desc: 'Streamer bids for 3AM-2PM time slots; bid revenue retained by network', timeline: 'Active Now', active: true },
  { icon: DollarSign, label: 'Sponsorships & Brand Deals', desc: 'On-stream branding, sponsored segments, and crypto partnerships', timeline: 'Q2 2026' },
  { icon: Target, label: 'Daily Grid & Squares Games', desc: 'Free-to-play prediction games with token-gated premium features', timeline: 'Q3 2026' },
  { icon: Crown, label: 'Tournament Entry Fees', desc: 'Gaming tournaments and prediction leagues with prize pools', timeline: 'Q4 2026' },
  { icon: Rocket, label: 'Merchandise & Events', desc: 'Branded merchandise, live meet-ups, and ticketed events', timeline: '2027' },
]

export default function Tokenomics() {
  return (
    <div className="min-h-screen pt-24 lg:pt-32 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="max-w-4xl mx-auto text-center mb-24">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Badge variant="gold" className="mb-6">
              <Coins className="w-3 h-3" /> Token Economics
            </Badge>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-black font-display tracking-tight text-white mb-6"
          >
            Unprecedented{' '}
            <span className="text-gradient-gold">Economics</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-400 leading-relaxed max-w-3xl mx-auto"
          >
            CSGN's token model is the first on pump.fun to implement structured fee-sharing
            tied to content delivery. Streamers earn 50% of all trading fees during their slot.
          </motion.p>
        </div>

        {/* The Fee Split */}
        <section className="mb-24">
          <SectionHeading
            badge="Core Model"
            title="The 50/50"
            highlight="Fee Split"
            description="Every buy and sell of the CSGN token on pump.fun generates trading fees. These fees are split transparently."
          />

          <div className="max-w-3xl mx-auto">
            <Card className="p-8" hover={false} glow>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30">
                    <Users className="w-9 h-9 text-white" />
                  </div>
                  <div className="text-5xl font-black font-display text-white mb-1">50%</div>
                  <p className="text-lg font-semibold text-emerald-400">To the Streamer</p>
                  <p className="text-sm text-gray-400 mt-2">
                    The live streamer earns half of all trading fees generated during their assigned time slot.
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-500/30">
                    <Radio className="w-9 h-9 text-white" />
                  </div>
                  <div className="text-5xl font-black font-display text-white mb-1">50%</div>
                  <p className="text-lg font-semibold text-primary-400">To the Network</p>
                  <p className="text-sm text-gray-400 mt-2">
                    CSGN retains half for operations, development, infrastructure, and growth.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Token Flywheel */}
        <section className="mb-24">
          <SectionHeading
            badge="Flywheel"
            title="Self-Reinforcing"
            highlight="Growth"
            description="Each element of the CSGN model feeds the next, creating compounding returns."
          />

          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Tv, label: 'Compelling Content', desc: 'Great streamers create must-watch programming', color: 'from-blue-500 to-cyan-500' },
                { icon: Users, label: 'Growing Audience', desc: 'Viewership increases as content quality rises', color: 'from-cyan-500 to-emerald-500' },
                { icon: TrendingUp, label: 'Trading Volume', desc: 'More viewers means more token trading activity', color: 'from-emerald-500 to-amber-500' },
                { icon: DollarSign, label: 'Fee Revenue', desc: 'Higher volume generates more fees for everyone', color: 'from-amber-500 to-blue-500' },
              ].map((step, i) => (
                <motion.div
                  key={step.label}
                  custom={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeUp}
                >
                  <Card className="p-5 h-full text-center" hover={false}>
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center mx-auto mb-3 shadow-lg`}>
                      <step.icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="font-semibold text-white text-sm mb-1">{step.label}</h3>
                    <p className="text-xs text-gray-500">{step.desc}</p>
                    {i < 3 && (
                      <div className="hidden md:flex items-center justify-center mt-3 text-gray-600">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    )}
                    {i === 3 && (
                      <div className="hidden md:flex items-center justify-center mt-3 text-primary-400">
                        <RefreshCw className="w-4 h-4" />
                      </div>
                    )}
                  </Card>
                </motion.div>
              ))}
            </div>

            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-center text-sm text-gray-400 mt-8 max-w-xl mx-auto"
            >
              Revenue scales <strong className="text-white">non-linearly</strong> with audience growth.
              More viewers means more trading activity, which means disproportionately more fee revenue
              for both streamers and the network.
            </motion.p>
          </div>
        </section>

        {/* Revenue Streams */}
        <section className="mb-24">
          <SectionHeading
            badge="Revenue"
            title="Multiple"
            highlight="Revenue Streams"
            description="Token trading fees are just the beginning. CSGN is building a diversified revenue model."
          />

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {revenueStreams.map((stream, i) => (
              <motion.div
                key={stream.label}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
              >
                <Card className={`p-5 h-full ${stream.active ? 'border-emerald-500/20 bg-emerald-500/[0.02]' : ''}`} hover={false}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                      <stream.icon className="w-5 h-5 text-primary-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white text-sm">{stream.label}</h3>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">{stream.desc}</p>
                      <Badge variant={stream.active ? 'green' : 'default'}>
                        {stream.timeline}
                      </Badge>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Slot Economics */}
        <section className="mb-24">
          <SectionHeading
            badge="Slot System"
            title="Three Tiers."
            highlight="One Network."
            description="Different access methods for different parts of the broadcast day. Each creates its own economic dynamic."
          />

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Gavel,
                title: 'Auction Slots',
                time: '3 AM – 2 PM EST',
                desc: 'Highest bidder wins. Bid revenue goes to the network. Competitive pricing ensures streamers who value the slot most get access.',
                color: 'from-cyan-500 to-blue-500',
                deadline: 'Bids close 1 hour before slot',
              },
              {
                icon: Ticket,
                title: 'Lottery Slots',
                time: '2 PM – 6 PM EST',
                desc: 'Random selection from all entries. Democratic access for emerging talent. Low barrier, high upside.',
                color: 'from-accent-500 to-pink-500',
                deadline: 'Enter by 1:00 PM daily',
              },
              {
                icon: Crown,
                title: 'Prime Time',
                time: '6 PM – 3 AM EST',
                desc: 'CEO-curated programming. The flagship block where brand-defining content airs. Reserved for proven talent.',
                color: 'from-amber-500 to-orange-500',
                deadline: 'Assigned by 6:00 PM daily',
              },
            ].map((slot, i) => (
              <motion.div
                key={slot.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
              >
                <Card className="p-6 h-full" hover={false}>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${slot.color} flex items-center justify-center mb-4 shadow-lg`}>
                    <slot.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold font-display text-white mb-1">{slot.title}</h3>
                  <p className="text-sm text-primary-400 font-mono mb-3">{slot.time}</p>
                  <p className="text-sm text-gray-400 mb-4 leading-relaxed">{slot.desc}</p>
                  <Badge variant="default">{slot.deadline}</Badge>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Competitive Edge */}
        <section>
          <Card className="p-8 lg:p-10" hover={false} glow>
            <div className="text-center max-w-3xl mx-auto">
              <Badge variant="gold" className="mb-4">
                <Zap className="w-3 h-3" /> First Mover Advantage
              </Badge>
              <h2 className="text-3xl font-bold font-display text-white mb-4">
                No Other Project Has Done This
              </h2>
              <p className="text-gray-400 leading-relaxed mb-6">
                CSGN is the first project on pump.fun to implement a structured fee-sharing model tied to
                specific content delivery. This isn't arbitrary tokenomics—it's purpose-built protocol economics
                that creates real utility and unprecedented streamer incentives.
              </p>
              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">1st</div>
                  <p className="text-xs text-gray-500">Fee-split on pump.fun</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">50%</div>
                  <p className="text-xs text-gray-500">Direct to streamers</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">24/7</div>
                  <p className="text-xs text-gray-500">Never goes dark</p>
                </div>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </div>
  )
}
