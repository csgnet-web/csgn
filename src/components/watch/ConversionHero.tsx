import { Link } from 'react-router-dom'
import { ArrowRight, Clapperboard, Radio, Zap } from 'lucide-react'
import { useAuthModal } from '@/contexts/useAuthModal'
import { useLiveSlot } from '@/contexts/useLiveSlot'
import { isSlotClaimable } from '@/lib/slots'

/**
 * THE CONVERSION LAYER — what a cold visitor sees under the stage.
 *
 * A visitor who arrives from an ad or an X link has one question, and it is not
 * "what is CSGN". It is **"what do I do here"**. This answers it in three
 * mutually exclusive paths, ordered by how much effort each one costs, and gives
 * each a single button.
 *
 * The order is deliberate and is the whole conversion argument:
 *
 *   1. POST A CLIP — near-zero effort. Paste a link you already have. This is
 *      the top of the funnel and it should be the biggest thing on the page.
 *   2. CLAIM A BLOCK — real effort. You have to be live for two hours. Fewer
 *      people will do it and they are worth more, so it gets a real card but
 *      not the headline.
 *   3. HOLD $CSGN — the thing that makes (1) worth more.
 *
 * What is deliberately NOT here: a feature grid, a roadmap, a founder story, or
 * a second CTA competing with the first. Every one of those is a place a cold
 * visitor stops.
 *
 * Live numbers, not claims. `marketing-outreach.md` §1 forbids quoting an income
 * — so the proof strip counts open blocks and what is on air, which are facts
 * about right now rather than a promise about later.
 */
export function ConversionHero({ signedIn }: { signedIn: boolean }) {
  const { openAuth } = useAuthModal()
  const { allSlots, currentSlot, networkBlockEnabled } = useLiveSlot()

  const openBlocks = allSlots.filter((s) => isSlotClaimable(s, networkBlockEnabled)).length
  const onAir = currentSlot?.assignedName ?? null

  return (
    <section className="shrink-0 border-t border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent">
      <div className="max-w-[1280px] mx-auto px-5 py-10 sm:py-14">

        {/* ── Proof strip. Facts about right now, not claims about later. ── */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
          <span className="inline-flex items-center gap-1.5 text-live">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-live opacity-70 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-live" />
            </span>
            {onAir ? `${onAir} on air` : 'Broadcasting 24/7'}
          </span>
          {openBlocks > 0 && <span className="text-gray-500">{openBlocks} blocks open today</span>}
          <span className="text-gray-500">Free to join</span>
        </div>

        {/* ── The line. One idea, said once. ── */}
        <h2 className="mt-5 text-4xl sm:text-6xl font-black font-display text-white tracking-[-0.03em] leading-[0.92] max-w-3xl">
          Put your work
          <br className="hidden sm:block" />
          <span className="text-primary-500"> on television.</span>
        </h2>
        <p className="mt-4 text-base sm:text-lg text-gray-400 leading-relaxed max-w-xl">
          CSGN is a 24-hour channel that anyone can get on. Post a clip you've already made, or take
          a two-hour block and stream it live from your own channel.
        </p>

        {/* ── The primary action, alone. ── */}
        <div className="mt-7 flex flex-wrap items-center gap-3">
          {signedIn ? (
            <Link to="/studio">
              <button className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-[15px] font-bold shadow-[0_10px_40px_-10px_rgba(255,35,70,0.7)] transition-colors cursor-pointer touch-manipulation">
                Post a clip <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          ) : (
            <button
              onClick={openAuth}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-[15px] font-bold shadow-[0_10px_40px_-10px_rgba(255,35,70,0.7)] transition-colors cursor-pointer touch-manipulation"
            >
              Get on the channel <ArrowRight className="w-4 h-4" />
            </button>
          )}
          <span className="text-xs text-gray-500">
            Google, X or email. No wallet, no password, about ten seconds.
          </span>
        </div>

        {/* ── The three paths, cheapest effort first. ── */}
        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          <Path
            Icon={Clapperboard}
            eyebrow="Easiest"
            title="Post a clip"
            body="Paste a link to something you already put on YouTube, TikTok or Instagram. It airs between the live blocks. You don't have to be there."
            action={signedIn ? { to: '/studio', label: 'Open Studio' } : { onClick: openAuth, label: 'Start posting' }}
            accent
          />
          <Path
            Icon={Radio}
            eyebrow="Most rewarding"
            title="Claim a block"
            body="Take an empty two-hour block and stream it from your own Twitch channel. You earn 30% of the trading fees the token generates while you're on air."
            action={{ to: '/schedule', label: 'See what’s open' }}
          />
          <Path
            Icon={Zap}
            eyebrow="Compounding"
            title="Hold $CSGN"
            body="Your share of clip airtime follows what you hold — twice the bag, twice the time on screen. Nothing is locked, staked or burned."
            action={{ to: '/participate', label: 'How it works' }}
          />
        </div>

        {/* ── The line for partners. One sentence, no pitch deck. ── */}
        <p className="mt-9 pt-6 border-t border-white/[0.06] text-xs text-gray-500 leading-relaxed max-w-2xl">
          <span className="text-gray-300 font-semibold">Brands and projects:</span> the network sells
          its own airtime, ticker placement and sponsored blocks — every surface is on one published
          schedule and every payment goes to a public treasury.{' '}
          <a href="mailto:partners@csgn.fun" className="text-primary-400 hover:text-primary-300 underline underline-offset-2">
            partners@csgn.fun
          </a>
        </p>
      </div>
    </section>
  )
}

/** One route in. Same weight as its siblings apart from the accent on the
 *  cheapest one — a visitor should be able to tell which is easiest at a glance
 *  without the other two looking like consolation prizes. */
function Path({
  Icon, eyebrow, title, body, action, accent,
}: {
  Icon: typeof Radio
  eyebrow: string
  title: string
  body: string
  action: { to?: string; onClick?: () => void; label: string }
  accent?: boolean
}) {
  const inner = (
    <>
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${accent ? 'text-primary-400' : 'text-gray-500'}`} />
        <span className={`text-[10px] font-bold uppercase tracking-[0.16em] ${accent ? 'text-primary-400' : 'text-gray-600'}`}>
          {eyebrow}
        </span>
      </div>
      <h3 className="mt-2.5 text-lg font-bold text-white">{title}</h3>
      <p className="mt-1.5 text-[13px] text-gray-400 leading-relaxed flex-1">{body}</p>
      <span className={`mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold ${accent ? 'text-primary-300' : 'text-gray-300'}`}>
        {action.label} <ArrowRight className="w-3.5 h-3.5" />
      </span>
    </>
  )

  const shell = `flex flex-col text-left rounded-2xl border p-5 h-full transition-colors cursor-pointer touch-manipulation ${
    accent
      ? 'border-primary-500/30 bg-primary-500/[0.06] hover:bg-primary-500/[0.1]'
      : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]'
  }`

  return action.to
    ? <Link to={action.to} className={shell}>{inner}</Link>
    : <button type="button" onClick={action.onClick} className={shell}>{inner}</button>
}

export default ConversionHero
