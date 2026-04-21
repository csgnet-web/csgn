import { Link } from 'react-router-dom'
import { Clock3, ExternalLink, CheckCircle2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

const steps = [
  'Open CSGN.fun/apply.',
  'Connect your Twitch + Phantom wallet.',
  'Drop your stream details and submit.',
]

export default function StreamerQuickApply() {
  return (
    <div className="min-h-screen pt-24 lg:pt-32 pb-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <Card className="p-8 sm:p-10" hover={false} glow>
          <Badge variant="blue" className="mb-5">Streamer One-Pager</Badge>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-white mb-3">
            Apply to CSGN in under 2 minutes
          </h1>
          <p className="text-gray-300 mb-7">
            This is the fastest path for creators: no long forms, no guesswork, just 3 clear steps.
          </p>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 mb-6">
            <p className="text-sm text-amber-200 flex items-center gap-2">
              <Clock3 className="w-4 h-4" />
              Average completion time: ~2 minutes.
            </p>
          </div>

          <ol className="space-y-3 mb-8">
            {steps.map((step, idx) => (
              <li key={step} className="flex items-start gap-3 text-sm sm:text-base">
                <span className="mt-0.5 inline-flex w-6 h-6 items-center justify-center rounded-full bg-primary-500/20 text-primary-300 text-xs font-semibold">
                  {idx + 1}
                </span>
                <span className="text-gray-200">{step}</span>
              </li>
            ))}
          </ol>

          <div className="space-y-3 mb-8 text-sm text-gray-300">
            <p className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> Keep your Twitch handle accurate so review is instant.</p>
            <p className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> Submit once; CSGN reviews quickly and follows up after approval.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <a href="https://csgn.fun/apply" target="_blank" rel="noreferrer" className="w-full sm:w-auto">
              <Button variant="primary" size="lg" className="w-full" rightIcon={<ExternalLink className="w-4 h-4" />}>
                Go to CSGN.fun/apply
              </Button>
            </a>
            <Link to="/about" className="w-full sm:w-auto">
              <Button variant="secondary" size="lg" className="w-full">
                Back to About
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
