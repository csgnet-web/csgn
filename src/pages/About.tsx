import { motion } from 'framer-motion'
import { Zap, Users, Tv, Rocket, Shield, Radio } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Button } from '@/components/ui/Button'

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6 },
  }),
}

const values = [
  { icon: Radio, title: 'Always On', desc: '24/7 means 24/7. The network never goes dark.' },
  { icon: Shield, title: 'Quality First', desc: 'Every streamer is vetted. Every slot is curated.' },
  { icon: Users, title: 'Streamer Partners', desc: '30% creator-fee share. Streamers are partners, not products.' },
  { icon: Zap, title: 'Crypto-Native', desc: 'Built on Solana. Powered by on-chain economics.' },
]

export default function About() {
  return (
    <div className="min-h-screen pt-24 lg:pt-32 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="max-w-4xl mx-auto text-center mb-24">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Badge variant="blue" className="mb-6">About CSGN</Badge>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-black font-display tracking-tight text-white mb-6"
          >
            The ESPN and TMZ of{' '}
            <span className="text-gradient">Crypto</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-400 leading-relaxed max-w-3xl mx-auto"
          >
            CSGN is the first 24/7 crypto-native streaming network built on Solana's pump.fun protocol.
            We're building the definitive broadcast home for cryptocurrency culture, sports gaming, and the
            next generation of broadcasting talent.
          </motion.p>
        </div>

        {/* The Problem */}
        <section className="mb-24">
          <SectionHeading
            badge="The Problem"
            title="Traditional Media"
            highlight="Is Broken"
            description="ESPN's average viewer is over 50. Young talent has no pipeline. Crypto culture has no network home. The gap is massive."
          />

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                stat: '40%+',
                label: 'Decline in cable viewership (18-34) in the past decade',
              },
              {
                stat: '50+',
                label: 'Average age of ESPN viewers',
              },
              {
                stat: '$1.5B+',
                label: 'Crypto media market with zero dedicated networks',
              },
            ].map((item, i) => (
              <motion.div key={item.stat} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                <Card className="p-6 text-center" hover={false}>
                  <div className="text-4xl font-black font-display text-gradient mb-2">{item.stat}</div>
                  <p className="text-sm text-gray-400">{item.label}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* The Solution */}
        <section className="mb-24" id="vision">
          <SectionHeading
            badge="Our Solution"
            title="CSGN Fills"
            highlight="The Gap"
            description="One channel. Always live. Token-powered economics. A fundamentally new model that no legacy broadcaster can replicate."
          />

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {values.map((value, i) => (
              <motion.div key={value.title} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                <Card className="p-5 text-center h-full" hover={false}>
                  <div className="w-12 h-12 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center mx-auto mb-3">
                    <value.icon className="w-6 h-6 text-primary-400" />
                  </div>
                  <h3 className="font-semibold text-white text-sm mb-1">{value.title}</h3>
                  <p className="text-xs text-gray-500">{value.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section id="contact" className="text-center">
          <Card className="p-10 lg:p-14" hover={false} glow>
            <h2 className="text-3xl sm:text-4xl font-bold font-display text-white mb-4">
              Join Crypto's Entertainment Flagship
            </h2>
            <p className="text-lg text-gray-400 mb-8 max-w-xl mx-auto">
              Whether you want to watch, stream, or invest—CSGN is building the future of sports broadcasting.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/apply">
                <Button variant="primary" size="lg" leftIcon={<Rocket className="w-5 h-5" />}>
                  Apply to Stream
                </Button>
              </Link>
              <Link to="/watch">
                <Button variant="secondary" size="lg" leftIcon={<Tv className="w-5 h-5" />}>
                  Watch Live
                </Button>
              </Link>
            </div>
          </Card>
        </section>
      </div>
    </div>
  )
}
