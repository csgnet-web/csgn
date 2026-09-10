import { Link } from 'react-router-dom'
import { Clapperboard, Radio, Tv } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CSGN_MINT } from '@/lib/slots'
import { usePageMeta } from '@/hooks/usePageMeta'

/**
 * About — the facts, and nothing arranged around them.
 *
 * ── What this page stopped being ───────────────────────────────────────────
 *
 * Seven sections of prose, about seven hundred words, explaining the product to
 * somebody who had already opened the product. Every sentence was true and well
 * written and almost none of it was read, because a person on a page called
 * "About" is checking whether this is legitimate and what the catch is — and
 * that is a question you answer with facts on separate lines, not paragraphs.
 *
 * The twenty-word version now happens on arrival (`components/onboarding/
 * Intro.tsx`), where it is actually useful. What is left here is the reference:
 * the three ways in, the rules that decide money and airtime, the contract
 * address, and the risk.
 *
 * ── The rules the copy follows ─────────────────────────────────────────────
 *
 *   • ONE FACT PER LINE. If two facts are in one sentence, they are two lines.
 *   • No sentence explaining a previous sentence. That is a sign the first one
 *     was wrong.
 *   • Say the thing, then say the number. "1% of the supply, 1% of the day"
 *     beats any amount of "meaningful rewards".
 *   • No adjectives doing a fact's job. If a sentence survives having its
 *     adjectives deleted, they were not doing anything.
 *   • Nothing true only in future tense.
 */

/** One way in. A verb, a line, a destination — never a paragraph. */
function Door({ Icon, title, line, to, cta }: {
  Icon: typeof Tv
  title: string
  line: string
  to: string
  cta: string
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-4 transition-colors hover:border-white/[0.16] hover:bg-white/[0.04]"
    >
      <span className="w-11 h-11 shrink-0 rounded-xl bg-white/[0.05] border border-white/[0.07] flex items-center justify-center">
        <Icon className="w-5 h-5 text-primary-400" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-white">{title}</span>
        <span className="block text-[13px] text-gray-400 leading-snug">{line}</span>
      </span>
      <span className="shrink-0 text-[13px] font-semibold text-primary-400 group-hover:text-primary-300">{cta}</span>
    </Link>
  )
}

/** One rule. The whole point is that it fits on one line. */
function Rule({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 py-2.5 border-b border-white/[0.05] last:border-0">
      <span className="mt-[7px] w-1 h-1 shrink-0 rounded-full bg-primary-500" />
      <span className="text-[14px] text-gray-300 leading-snug">{children}</span>
    </li>
  )
}

export default function About() {
  usePageMeta({
    title: 'About CSGN — How the 24/7 Crypto Channel Works',
    description: "How CSGN works: post a link to a clip you already made and it airs between live streams, or connect your Twitch once and get carried automatically. Airtime is one-to-one with the $CSGN you hold.",
    path: '/about',
  })

  return (
    <div className="min-h-screen pt-24 lg:pt-28 pb-24">
      <div className="max-w-xl mx-auto px-4 sm:px-6">

        <h1 className="text-3xl sm:text-4xl font-black font-display text-white leading-[1.1] tracking-tight">
          A TV channel for crypto.<br />Anyone can get on it.
        </h1>

        <div className="mt-8 space-y-2.5">
          <Door Icon={Tv} title="Watch" line="On 24 hours a day." to="/watch" cta="Open" />
          <Door Icon={Clapperboard} title="Post a clip" line="A link you already posted. It airs between the streams." to="/studio" cta="Post" />
          <Door Icon={Radio} title="Go live" line="Connect Twitch once. We carry you when you stream." to="/account" cta="Connect" />
        </div>

        <h2 className="mt-12 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">The rules</h2>
        <ul className="mt-3">
          <Rule>Live beats clips. A stream going on moves your clip to the next gap — it never costs you seconds.</Rule>
          <Rule>
            Clip airtime is one to one with the $CSGN you hold. 1% of the supply, 1% of the day.
          </Rule>
          <Rule>Holding is not spending. Nothing is burned, locked or deposited — sell tomorrow and it goes with you.</Rule>
          <Rule>There is a ceiling on how much of a day one wallet can take.</Rule>
          <Rule>A person watches every clip before it airs.</Rule>
          <Rule>Streams earn 30% of the fees their hour generates, for the minutes we actually carried them.</Rule>
          <Rule>An account, connecting Twitch and going live are free. The token decides what gets promoted, never who is allowed in.</Rule>
          <Rule>
            Fees go to one public treasury.{' '}
            <Link to="/treasury" className="text-primary-400 hover:text-primary-300 underline underline-offset-2">See the balance</Link>.
          </Rule>
        </ul>

        <h2 className="mt-12 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">$CSGN</h2>
        <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.015] px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-gray-500">Solana · pump.fun</p>
          <p className="mt-1 font-mono text-xs text-gray-300 break-all">{CSGN_MINT}</p>
        </div>
        <p className="mt-3 text-[12px] text-gray-500 leading-snug">
          Not financial advice. It can go to zero. Don't put in money you need.
        </p>

        <p className="mt-10 text-[13px] text-gray-500">
          Open source, MIT.{' '}
          <a
            href="https://github.com/csgnet-web/csgn"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-400 hover:text-primary-300 underline underline-offset-2"
          >
            GitHub
          </a>
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/studio"><Button variant="primary" size="lg">Post a clip</Button></Link>
          <Link to="/watch"><Button variant="secondary" size="lg">Watch</Button></Link>
        </div>

      </div>
    </div>
  )
}
