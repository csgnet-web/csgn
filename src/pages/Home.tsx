import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Play, Tv, Users, Zap, Clock, Trophy, TrendingUp,
  ArrowRight, Radio, Coins, Gamepad2, Newspaper, Shield, Star,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { LiveIndicator } from '@/components/ui/LiveIndicator'
import { SectionHeading } from '@/components/ui/SectionHeading'

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6 },
  }),
}

const stats = [
  { label: '24/7', sublabel: 'Always Live', icon: Radio },
  { label: '50%', sublabel: 'Fee Split to Streamers', icon: Coins },
  { label: '3-Tier', sublabel: 'Slot System', icon: Clock },
  { label: 'Solana', sublabel: 'Powered by pump.fun', icon: Zap },
]

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
    desc: 'Auction bidding (3AM-2PM), lottery entry (2PM-6PM), and CEO-curated prime time (6PM-3AM). Multiple ways to get on air.',
  },
  {
    icon: Shield,
    title: 'Vetted Talent Pipeline',
    desc: 'Every streamer is reviewed and approved. CSGN is a quality-controlled network, not a random open platform.',
  },
  {
    icon: Gamepad2,
    title: 'Gaming Is Sports',
    desc: 'Madden, EA College Football, competitive shooters, esports. We treat gaming as a core sports vertical because that\'s how our audience lives.',
  },
  {
    icon: Trophy,
    title: 'Coming: Games & Tournaments',
    desc: 'Daily Grid, Squares, prediction games, and entry-fee tournaments with prize pools—all broadcast live on CSGN.',
  },
]

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

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-radial-top" />
        <div className="absolute inset-0 bg-grid" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-600/10 rounded-full blur-[120px]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <Badge variant="blue" className="mb-6">
              <Zap className="w-3 h-3" /> Built on Solana &middot; Powered by pump.fun
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black font-display tracking-tight leading-[0.9] mb-6"
          >
            <span className="text-white">THE FUTURE OF</span>
            <br />
            <span className="text-gradient">SPORTS BROADCASTING</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="max-w-2xl mx-auto text-lg sm:text-xl text-gray-400 leading-relaxed mb-10"
          >
            CSGN is the 24/7 crypto-native streaming network where streamers earn 50% of token trading fees.
            The ESPN and TMZ of crypto—always live, always curated, always on.
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
              <Button variant="secondary" size="lg" leftIcon={<Users className="w-5 h-5" />}>
                Apply to Stream
              </Button>
            </Link>
          </motion.div>

          {/* Live indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
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

      {/* Stats Bar */}
      <section className="relative border-y border-white/[0.06] bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary-500/10 mb-3">
                  <stat.icon className="w-5 h-5 text-primary-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold font-display text-white">{stat.label}</div>
                <div className="text-sm text-gray-500 mt-1">{stat.sublabel}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge="Platform"
            title="Built Different."
            highlight="By Design."
            description="CSGN isn't another streaming platform. It's a network—one channel, curated programming, on-chain economics. Everything traditional media can't replicate."
          />

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
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

      {/* Content Pillars */}
      <section className="relative py-24 lg:py-32 border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge="Content"
            title="Two Pillars."
            highlight="One Network."
            description="Crypto drama and sports gaming converge on CSGN. Every story, every match, every moment—live."
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

      {/* How It Works */}
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

      {/* CTA */}
      <section className="relative py-24 lg:py-32 border-t border-white/[0.04]">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-600/5 to-transparent" />
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
