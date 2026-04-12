import { Card } from '@/components/ui/Card'

export default function Terms() {
  return (
    <div className="min-h-screen pt-24 lg:pt-32 pb-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card hover={false} className="p-6 md:p-8 space-y-4">
          <h1 className="text-3xl font-display font-bold text-white">Terms & Conditions</h1>
          <p className="text-sm text-gray-300">By creating an account, you agree to use CSGN in compliance with applicable laws and platform rules.</p>
          <ul className="list-disc pl-6 text-sm text-gray-300 space-y-2">
            <li>You are responsible for your account, wallet, and streaming credentials.</li>
            <li>Slot assignments, payouts, and estimates are subject to review and not guaranteed.</li>
            <li>Abuse, fraud, or policy violations may result in account suspension.</li>
            <li>Feature flags marked “Coming Soon” are informational and may change.</li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
