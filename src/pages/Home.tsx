import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Play, Users, Zap, Clock, Trophy,
  ArrowRight, Radio, Coins, Gamepad2, Newspaper, Shield, Star,
  TrendingUp, Tv, Mic2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { LiveIndicator } from '@/components/ui/LiveIndicator'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { RotatingText } from '@/components/ui/RotatingText'

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  }),
}

/* ─── Personalities / Streamers ─── */
const personalities = [
  {
    handle: 'TRAPKINGZ',
    specialty: 'NBA Picks & Analysis',
    category: 'Sports',
    status: 'live' as const,
    viewers: '7,589',
    color: 'from-red-600 to-orange-500',
    accentColor: '#ff2346',
  },
  {
    handle: 'SolanaSteve',
    specialty: 'Crypto Markets & Drama',
    category: 'Crypto',
    status: 'upcoming' as const,
    viewers: '4,200',
    color: 'from-violet-600 to-blue-500',
    accentColor: '#7c3aed',
  },
  {
    handle: 'CEO Show',
    specialty: 'Prime Time Network',
    category: 'Featured',
    status: 'upcoming' as const,
    viewers: '12,000+',
    color: 'from-amber-500 to-yellow-400',
    accentColor: '#ffb020',
  },
  {
    handle: 'YOUR NAME HERE',
    specialty: 'Apply to Join the Network',
    category: '',
    status: 'open' as const,
    viewers: '',
    color: 'from-gray-700 to-gray-600',
    accentColor: '#6b7280',
  },
  {
    handle: 'YOUR NAME HERE',
    specialty: 'Apply to Join the Network',
    category: '',
    status: 'open' as const,
    viewers: '',
    color: 'from-gray-700 to-gray-600',
    accentColor: '#6b7280',
  },
  {
    handle: 'YOUR NAME HERE',
    specialty: 'Apply to Join the Network',
    category: '',
    status: 'open' as const,
    viewers: '',
    color: 'from-gray-700 to-gray-600',
    accentColor: '#6b7280',
  },
]

/* ─── Stats ─── */
const stats = [
  { label: '24/7', sublabel: 'Always Live', icon: Radio },
  { label: '50%', sublabel: 'Fee Split to Streamers', icon: Coins },
  { label: '3-Tier', sublabel: 'Slot System', icon: Clock },
  { label: 'Solana', sublabel: 'Powered by pump.fun', icon: Zap },
]

/* ─── Features ─── */
const features = [
  {
    icon: Tv,
    title: 'Single-Channel Network',
    desc: 'One always-on stream where the entire community watches together. Scarcity creates value—limited slots, appointment viewing, shared experience.',
  },
  {
    icon: Coins,
    title: '50% Revenue to Streamers',
    desc: 'Streamers earn 50% of CSGN token trading fees generated during their time slot. A transparent, unprecedented incentive model.',
  },
  {
    icon: Clock,
    title: '3-Tier Time Slots',
    desc: 'Auction bidding (3AM–2PM), lottery entry (2PM–6PM), and CEO-curated prime time (6PM–3AM). Multiple pathways to air.',
  },
  {
    icon: Shield,
    title: 'Vetted Talent Pipeline',
    desc: 'Every streamer is reviewed and approved. CSGN is a quality-controlled network, not a random open platform.',
  },
  {
    icon: Gamepad2,
    title: 'Gaming Is Sports',
    desc: 'Madden, EA College Football, competitive shooters, esports. We treat gaming as a core sports vertical.',
  },
  {
    icon: Trophy,
    title: 'Coming: Games & Tournaments',
    desc: 'Daily Grid, Squares, prediction games, and entry-fee tournaments with prize pools—all broadcast live on CSGN.',
  },
]

/* ─── Pillars ─── */
const pillars = [
  {
    badge: 'Pillar 1',
    title: 'The TMZ of Crypto',
    desc: 'Daily coverage of crypto drama, market movements, influencer beef, rug pulls, and community narratives. First to every story, every time.',
    icon: Newspaper,
    gradient: 'from-red-500 to-orange-500',
  },
  {
    badge: 'Pillar 2',
    title: 'The ESPN of Crypto',
    desc: 'Sports gaming, esports coverage, competitive tournaments, and CSGN-branded leagues. Gaming is sports for this generation.',
    icon: Trophy,
    gradient: 'from-primary-500 to-cyan-500',
  },
]

/* ─── Personality Card ─── */
function PersonalityCard({ p, index }: { p: typeof personalities[0]; index: number }) {
  const isOpen = p.status === 'open'
  const isLive = p.status === 'live'

  return (
    <motion.div
      custom={index}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      variants={fadeUp}
      className="group relative"
    >
      <div
        className={`relative rounded-2xl overflow-hidden border transition-all duration-500 ${
          isOpen
            ? 'border-white/[0.06] bg-white/[0.02] hover:border-white/10'
            : isLive
            ? 'border-red-500/40 bg-[#0e0a10] hover:border-red-500/70 shadow-[0_0_30px_-8px_rgba(255,35,70,0.35)]'
            : 'border-white/[0.08] bg-[#0b0b18] hover:border-white/[0.15]'
        }`}
        style={{ boxShadow: isLive ? `0 0 40px -10px ${p.accentColor}55` : undefined }}
      >
        {/* Avatar area */}
        <div className="relative aspect-[16/9] lg:aspect-[8/3] overflow-hidden">
          {/* Background gradient */}
          <div className={`absolute inset-0 bg-gradient-to-br ${p.color} opacity-${isOpen ? '10' : '20'}`} />
          {/* Grid pattern */}
          <div className="absolute inset-0 bg-grid opacity-30" />
          {/* Glow overlay for live */}
          {isLive && (
            <div className="absolute inset-0 bg-gradient-to-t from-red-900/40 via-transparent to-transparent" />
          )}

          {/* Avatar silhouette placeholder */}
          <div className="absolute inset-0 flex items-end justify-center">
            {isOpen ? (
              /* Empty slot — invite design */
              <div className="flex flex-col items-center justify-center h-full w-full gap-3">
                <div className="w-20 h-20 rounded-full border-2 border-dashed border-white/15 flex items-center justify-center">
                  <Users className="w-8 h-8 text-white/20" />
                </div>
                <span className="text-xs tracking-widest text-white/20 uppercase">Open Slot</span>
              </div>
            ) : (
              /* Streamer silhouette — top of head touches the upper border */
              <svg viewBox="0 0 200 200" className="w-full h-full opacity-25" preserveAspectRatio="xMidYMax meet" fill="none">
                <defs>
                  <linearGradient id={`avatarGrad${index}`} x1="100" y1="0" x2="100" y2="200" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor={p.accentColor} stopOpacity="0.9" />
                    <stop offset="100%" stopColor={p.accentColor} stopOpacity="0.2" />
                  </linearGradient>
                </defs>
                {/* Head */}
                <ellipse cx="100" cy="50" rx="38" ry="45" fill={`url(#avatarGrad${index})`} />
                {/* Shoulders / body */}
                <path d="M10 200 C10 130, 50 105, 100 100 C150 105, 190 130, 190 200 Z" fill={`url(#avatarGrad${index})`} />
              </svg>
            )}
          </div>

          {/* Status badge top-left */}
          <div className="absolute top-3 left-3">
            {isLive ? (
              <Badge variant="live" pulse className="text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                ON AIR
              </Badge>
            ) : isOpen ? (
              <Badge variant="default" className="text-[10px] border-white/10 text-white/30 bg-white/5">
                OPEN SLOT
              </Badge>
            ) : (
              <Badge variant="blue" className="text-[10px]">
                UP NEXT
              </Badge>
            )}
          </div>

          {/* Viewers badge top-right */}
          {p.viewers && (
            <div className="absolute top-3 right-3">
              <span className="text-[10px] font-mono text-white/60 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-full border border-white/10">
                {p.viewers}
              </span>
            </div>
          )}

          {/* Category */}
          {p.category && (
            <div className="absolute bottom-3 left-3">
              <span className={`text-[10px] tracking-widest uppercase font-mono px-2 py-1 rounded-md bg-black/50 backdrop-blur-sm border border-white/10 text-white/60`}>
                {p.category}
              </span>
            </div>
          )}

          {/* Live glow border animation */}
          {isLive && (
            <div
              className="absolute inset-0 rounded-2xl animate-live-pulse pointer-events-none"
              style={{ boxShadow: `inset 0 0 0 1px ${p.accentColor}50` }}
            />
          )}
        </div>

        {/* Card footer */}
        <div className="p-4">
          {isOpen ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-white/25 uppercase tracking-wider font-mono mb-0.5">Slot Available</p>
                <p className="text-sm font-display font-semibold text-white/30">Apply to Stream</p>
              </div>
              <Link to="/apply">
                <button className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/40 hover:border-primary-500/50 hover:text-primary-400 transition-all font-medium cursor-pointer">
                  Apply →
                </button>
              </Link>
            </div>
          ) : (
            <div>
              <h3 className="text-base font-display font-black text-white tracking-tight leading-none mb-1 group-hover:text-gradient-animate transition-all">
                {p.handle}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">{p.specialty}</p>
              {isLive && (
                <Link to="/watch" className="inline-flex items-center gap-1 mt-2 text-xs text-red-400 hover:text-red-300 font-medium transition-colors">
                  Watch Now <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

/* ─── Page ─── */
export default function Home() {
  return (
    <div className="min-h-screen">

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Layered backgrounds */}
        <div className="absolute inset-0 bg-radial-top" />
        <div className="absolute inset-0 bg-grid" />
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-primary-600/8 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/2 right-1/4 w-[400px] h-[400px] bg-accent-600/6 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <Badge variant="blue" className="mb-6 inline-flex">
              <Zap className="w-3 h-3" /> Built on Solana &middot; Powered by pump.fun
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black font-display tracking-tight leading-[0.88] mb-6"
          >
            <span className="text-white">THE FUTURE OF</span>
            <br />
            <RotatingText
              texts={['SPORTS BROADCASTING', 'CRYPTO MEDIA', 'GAMING NETWORKS', 'LIVE ENTERTAINMENT']}
              interval={7000}
              className="text-gradient"
            />
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="max-w-2xl mx-auto text-lg sm:text-xl text-gray-400 leading-relaxed mb-10"
          >
            CSGN is the 24/7 crypto-native streaming network where streamers earn 50% of token trading fees.
            The ESPN and TMZ of crypto — always live, always curated, always on.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link to="/watch">
              <Button variant="primary" size="lg" leftIcon={<Play className="w-5 h-5" />}>
                Watch Live Now
              </Button>
            </Link>
            <Link to="/apply">
              <Button variant="secondary" size="lg" leftIcon={<Mic2 className="w-5 h-5" />}>
                Apply to Stream
              </Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-12 inline-flex items-center gap-3 px-5 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-full"
          >
            <LiveIndicator />
            <span className="text-sm text-gray-300">CSGN is live right now</span>
            <Link to="/watch" className="text-sm text-primary-400 hover:text-primary-300 font-medium flex items-center gap-1">
              Tune in <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Meet The Network ── */}
      <section className="relative py-24 lg:py-32 border-t border-white/[0.04]">
        {/* Subtle section glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary-600/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge="The Roster"
            title="Meet The"
            highlight="Network."
            description="These are the faces of CSGN — vetted personalities bringing crypto drama, sports analysis, and live entertainment to one always-on channel. Think you belong here?"
          />

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
            {personalities.map((p, i) => (
              <PersonalityCard key={`${p.handle}-${i}`} p={p} index={i} />
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mt-10 text-center"
          >
            <Link to="/apply">
              <Button variant="ghost" size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Apply to Join the Roster
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section className="relative border-y border-white/[0.06] bg-white/[0.015]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary-500/10 border border-primary-500/15 mb-3">
                  <stat.icon className="w-5 h-5 text-primary-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold font-display text-white">{stat.label}</div>
                <div className="text-sm text-gray-500 mt-1">{stat.sublabel}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Platform Features ── */}
      <section className="relative py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge="Platform"
            title="Built Different."
            highlight="By Design."
            description="CSGN isn't another streaming platform. It's a network — one channel, curated programming, on-chain economics. Everything traditional media can't replicate."
          />

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
              >
                <Card className="p-6 h-full">
                  <div className="w-11 h-11 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center mb-4">
                    <feature.icon className="w-5 h-5 text-primary-400" />
                  </div>
                  <h3 className="text-lg font-semibold font-display text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{feature.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Content Pillars ── */}
      <section className="relative py-24 lg:py-32 border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge="Content"
            title="Two Pillars."
            highlight="One Network."
            description="Crypto drama and sports gaming converge on CSGN. Every story, every match, every moment — live."
          />

          <div className="grid md:grid-cols-2 gap-8">
            {pillars.map((pillar, i) => (
              <motion.div
                key={pillar.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
              >
                <Card className="p-8 h-full" glow>
                  <Badge variant={i === 0 ? 'red' : 'blue'} className="mb-4">
                    <Star className="w-3 h-3" /> {pillar.badge}
                  </Badge>
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${pillar.gradient} flex items-center justify-center mb-5 shadow-lg`}>
                    <pillar.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold font-display text-white mb-3">{pillar.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{pillar.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="relative py-24 lg:py-32 border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge="How It Works"
            title="From Viewer to"
            highlight="Streamer"
            description="Join the network in three simple steps. CSGN is open to everyone with talent and ambition."
          />

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: '01', title: 'Apply', desc: 'Submit your application with your content style, experience, and what you bring to the network.', icon: Users },
              { step: '02', title: 'Get Approved', desc: 'Our team reviews your application for quality and fit. Approved streamers get unique RTMP stream keys.', icon: Shield },
              { step: '03', title: 'Go Live & Earn', desc: 'Bid for slots, enter the lottery, or get CEO-assigned prime time. Earn 50% of trading fees while you stream.', icon: TrendingUp },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="text-center"
              >
                <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-500/10 border border-primary-500/20 mb-5">
                  <item.icon className="w-7 h-7 text-primary-400" />
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-lg bg-primary-500 text-xs font-bold text-white flex items-center justify-center">
                    {item.step}
                  </span>
                </div>
                <h3 className="text-xl font-bold font-display text-white mb-2">{item.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative py-24 lg:py-32 border-t border-white/[0.04] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-600/5 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary-600/8 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black font-display tracking-tight text-white mb-6">
              Ready to Watch?
            </h2>
            <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
              CSGN is live 24/7. Tune in now and join the future of sports broadcasting.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/watch">
                <Button variant="primary" size="lg" leftIcon={<Play className="w-5 h-5" />}>
                  Watch Live
                </Button>
              </Link>
              <Link to="/tokenomics">
                <Button variant="secondary" size="lg" leftIcon={<Coins className="w-5 h-5" />}>
                  View Tokenomics
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
