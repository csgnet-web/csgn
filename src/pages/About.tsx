import { motion } from 'framer-motion'
import { ArrowRight, Rocket, Tv, CheckCircle2, Handshake, UserPlus, FileText } from 'lucide-react'
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

const steps = [
  {
    icon: UserPlus,
    title: 'Step 1: Create Your Account',
    desc: 'Use email/password or Connect with Twitch to start your creator profile in minutes.',
  },
  {
    icon: FileText,
    title: 'Step 2: Apply (Optional, Fast)',
    desc: 'If you want an on-air slot, submit your streamer application and audience details.',
  },
  {
    icon: Handshake,
    title: 'Step 3: We Reach Out',
    desc: 'Our team reviews fit, then contacts you directly with next steps and onboarding.',
  },
]

const whatToPrepare = [
  'Your Twitch channel and content focus',
  'Your typical stream schedule and timezone',
  'A short pitch for your show format and audience',
  'Any social proof: clips, social links, or prior collaborations',
]

export default function About() {
  return (
    <div className="min-h-screen pt-24 lg:pt-32 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Badge variant="blue" className="mb-6">How-To Guide</Badge>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-black font-display tracking-tight text-white mb-6"
          >
            How to Join <span className="text-gradient">CSGN</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-300 leading-relaxed max-w-4xl mx-auto"
          >
            Built like a modern media agency and executed like a performance studio, CSGN helps creators convert attention into opportunity. Apply to stream or simply create an account—either way, our team will review and reach out.
          </motion.p>
        </div>

        <section className="mb-16">
          <Card className="p-6 sm:p-8 border-primary-500/20 bg-primary-500/[0.04]" hover={false}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <Badge variant="blue" className="mb-3">Creator One-Pager</Badge>
                <h2 className="text-2xl font-display font-bold text-white mb-2">Start here in under 2 minutes</h2>
                <p className="text-sm text-gray-300 max-w-2xl">
                  Share the one-pager with creators, managers, and partners for the fastest onboarding path.
                </p>
              </div>
              <Link to="/about/streamer-quick-apply" className="shrink-0">
                <Button variant="primary" size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Open One-Pager
                </Button>
              </Link>
            </div>
          </Card>
        </section>

        <section className="mb-16">
          <SectionHeading
            badge="Process"
            title="Three Steps"
            highlight="To Get Started"
            description="Whether you're applying to stream or creating an account first, the path is simple and creator-friendly."
          />
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <motion.div key={step.title} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                <Card className="p-6 h-full" hover={false}>
                  <div className="w-11 h-11 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center mb-4">
                    <step.icon className="w-5 h-5 text-primary-400" />
                  </div>
                  <h3 className="font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-400">{step.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="mb-24">
          <SectionHeading
            badge="Preparation"
            title="What Helps Us"
            highlight="Move Fast"
            description="The best applications are clear, specific, and production-ready."
          />
          <Card className="p-6" hover={false}>
            <div className="grid md:grid-cols-2 gap-3">
              {whatToPrepare.map((item) => (
                <p key={item} className="flex items-start gap-2 text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  {item}
                </p>
              ))}
            </div>
          </Card>
        </section>

        <section id="contact" className="text-center">
          <Card className="p-10 lg:p-14" hover={false} glow>
            <h2 className="text-3xl sm:text-4xl font-bold font-display text-white mb-4">
              Apply or Create an Account—We&apos;ll Reach Out
            </h2>
            <p className="text-lg text-gray-400 mb-8 max-w-2xl mx-auto">
              Want a slot? Apply now. Just exploring? Create your account and we&apos;ll contact you with the right next move.
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
