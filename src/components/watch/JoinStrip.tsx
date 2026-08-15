import { Link } from 'react-router-dom'
import { ArrowRight, Radio, Wallet } from 'lucide-react'

/**
 * The one thing the landing page was missing: a reason and a door.
 *
 * `/` is where every ad click, every X link and every QR code lands, and until
 * now a first-time visitor got a player (usually reading OFFLINE early on), a
 * price ticker, a schedule, and two greyed-out "Coming Soon" buttons. Nothing
 * told them what CSGN is, and nothing asked them to join. The sign-up existed
 * only behind a header button labelled "Get Started", which is a label that
 * describes a mechanism rather than an offer.
 *
 * This block replaces the dead game tiles with the pitch in one sentence, three
 * facts a sceptic can check, and the two actions that actually exist. It is
 * deliberately below the stage — the live feed is still the hero — and it
 * disappears the moment it is answered: a signed-in streamer sees the schedule
 * link instead, and a fully set-up member sees nothing at all.
 */
export function JoinStrip({
  signedIn,
  twitchLinked,
  onGetStarted,
}: {
  signedIn: boolean
  twitchLinked: boolean
  onGetStarted: () => void
}) {
  // Nothing left to ask for. An empty strip beats a strip that invents a task.
  if (signedIn && twitchLinked) return null

  const facts = [
    ['30%', 'of the creator fees generated while you are on air'],
    ['Your channel', 'you stream to your own Twitch — nothing changes'],
    ['On-chain', 'paid in SOL to your wallet, verifiable per hour'],
  ] as const

  return (
    <div className="shrink-0 px-5 py-6 border-t border-white/[0.06]">
      <div className="max-w-[1280px] mx-auto rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-5 sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-400">
          {signedIn ? 'One step left' : 'The network'}
        </p>
        <h2 className="mt-2 text-xl sm:text-2xl font-black font-display text-white leading-tight">
          {signedIn
            ? 'Connect Twitch and the schedule opens up.'
            : 'Go live for an hour. Get paid from the trading it creates.'}
        </h2>
        <p className="mt-2 text-sm text-gray-400 leading-relaxed max-w-2xl">
          {signedIn
            ? 'Your account is ready. Linking the channel you already stream from is what turns every open hour on the schedule into one you can claim.'
            : 'CSGN pays the streamer on screen a share of the $CSGN trading fees generated during their hour. You keep streaming to your own Twitch channel; the payout is calculated per slot and settled on Solana.'}
        </p>

        {!signedIn && (
          <dl className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {facts.map(([value, label]) => (
              <div key={value} className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
                <dt className="text-base font-black font-display text-white leading-none">{value}</dt>
                <dd className="mt-1.5 text-[11px] text-gray-500 leading-snug">{label}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          {signedIn ? (
            <Link
              to="/account"
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white text-sm font-bold transition-colors"
            >
              <Radio className="w-4 h-4" aria-hidden />
              Connect Twitch
            </Link>
          ) : (
            <button
              type="button"
              onClick={onGetStarted}
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white text-sm font-bold transition-colors cursor-pointer"
            >
              <Wallet className="w-4 h-4" aria-hidden />
              Join with your wallet — one signature
            </button>
          )}
          <Link
            to="/schedule"
            className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold transition-colors"
          >
            See the open hours
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>

        {!signedIn && (
          <p className="mt-3 text-[11px] text-gray-600 leading-relaxed">
            No email, no password. Your Phantom wallet is the account — the same wallet the fees are paid to.
          </p>
        )}
      </div>
    </div>
  )
}
