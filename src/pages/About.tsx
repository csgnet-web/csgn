import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { CSGN_MINT } from '@/lib/slots'

/**
 * About — what CSGN is, and how every part of it actually works.
 *
 * Rewritten to be readable by a person who arrived here from a link and has no
 * idea what a "slot" is. Rules the copy follows:
 *
 *   • Say the thing, then say the number. "Claim an hour" beats "leverage our
 *     inventory layer", and "100,000 $CSGN" beats "meaningful rewards".
 *   • No adjectives doing a fact's job. Not "seamless", "revolutionary",
 *     "cutting-edge", "empowering". If a sentence survives having its adjectives
 *     deleted, they weren't doing anything.
 *   • Nothing here can be true only in future tense. Where something isn't built
 *     yet, it says so, in the same voice.
 *   • Contractions, short sentences, second person. It should read like the
 *     person who built it explaining it at a bar.
 *
 * Sections are plain <section>s in one column. The old page was a grid of
 * animated value-prop cards ("Quality First", "Crypto-Native") that said nothing
 * a reader could act on.
 */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-white/[0.08] pt-8">
      <h2 className="text-lg sm:text-xl font-semibold text-white">{title}</h2>
      <div className="mt-4 space-y-4 text-sm sm:text-[15px] text-gray-400 leading-relaxed">{children}</div>
    </section>
  )
}

function Term({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.015] px-4 py-3">
      <p className="text-sm font-semibold text-white">{label}</p>
      <p className="mt-1 text-sm text-gray-400 leading-relaxed">{children}</p>
    </div>
  )
}

export default function About() {
  return (
    <div className="min-h-screen pt-24 lg:pt-28 pb-24">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 space-y-8">

        <header>
          <h1 className="text-3xl sm:text-4xl font-bold font-display text-white leading-tight">
            A television network for crypto, with the door left open.
          </h1>
          <p className="mt-4 text-base text-gray-400 leading-relaxed">
            CSGN runs 24 hours a day. There's a schedule — twelve two-hour blocks, every day, the
            same way there's been a schedule since 1948. Eight of those blocks are open, and the way
            you get one is that you take it.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/schedule"><Button variant="primary" size="md">See what's open</Button></Link>
            <Link to="/watch"><Button variant="secondary" size="md">Watch now</Button></Link>
          </div>
        </header>

        <Section title="Two ways to get on">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Term label="Take a block and go live">
              Claim an empty two-hour block and stream it from your own channel. You earn 30% of
              the $CSGN trading fees generated while you're on air.
            </Term>
            <Term label="Post a clip">
              Link something you already put on YouTube, TikTok or Instagram. It airs between the
              live blocks, without you being there.
            </Term>
          </div>
          <p>
            Live always wins. If somebody claims the block your clip was going to air in, their
            stream takes it and your clip moves to the next opening.
          </p>
        </Section>

        <Section title="Claiming a block">
          <p>
            Open blocks run 3 AM to 7 PM ET. From 7 PM to 3 AM we run our own programming. All you
            need is a Twitch channel — no wallet, no tokens. We ask for a wallet later, when
            there's money waiting for you.
          </p>
          <p>
            We check your channel about once a minute and pay for the share of those checks that
            found you broadcasting. Cut out for ten minutes and it costs you nothing. Claim a block
            and never go live and it pays nothing, because nothing aired. If our checks fail,
            that's our problem and you're paid in full.
          </p>
        </Section>

        <Section title="Clips and airtime">
          <p>
            Between the live blocks, the channel plays clips members sent in. How much of that time
            is yours depends on how much $CSGN you hold —{' '}
            <strong className="text-white">hold twice as much, get twice as much.</strong> No
            holdings, no airtime: that's what the token is for.
          </p>
          <p>
            There's a ceiling on how much of a day one member can take, so nobody can buy the whole
            channel. Every clip is watched by a person before it airs. Clips don't earn fees — the
            live blocks do. What holding buys is the audience.
          </p>
          <p className="text-gray-500">
            <strong className="text-gray-300">Not open yet.</strong> The scheduler runs; the posting
            screen is still being finished.
          </p>
        </Section>

        <Section title="What the token does">
          <p>
            $CSGN never gates having an account, claiming a block, or going live — those are free
            and always will be. It decides what gets <em>promoted</em>: your share of clip airtime,
            whether you can put a line on the broadcast ticker, and your weight in network votes
            and the Meme 100.
          </p>
          <p>
            <strong className="text-white">Holding is not spending.</strong> Nothing is burned,
            locked, escrowed or deposited. Your weight is simply what's in your wallet right now,
            read from the chain. Sell tomorrow and it goes with you.
          </p>
          <p>
            Everything the network takes in goes to one public treasury under published rules, so
            you can watch the balance:{' '}
            <Link to="/treasury" className="text-primary-400 hover:text-primary-300 underline">
              /treasury
            </Link>.
          </p>
        </Section>

        <Section title="The token">
          <p>$CSGN is on Solana, launched on pump.fun.</p>
          <div className="rounded-lg border border-white/[0.07] bg-white/[0.015] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-gray-500">Contract address</p>
            <p className="mt-1 font-mono text-xs text-gray-300 break-all">{CSGN_MINT}</p>
          </div>
          <p className="text-gray-500">
            Nothing here is financial advice. The token can go to zero like any other. Don't put in
            money you need.
          </p>
        </Section>

        <Section title="Open source">
          <p>
            All of it — MIT licensed, on{' '}
            <a
              href="https://github.com/csgnet-web/csgn"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-400 hover:text-primary-300 underline"
            >
              GitHub
            </a>. Fork it, point the wallets at your own, run your own network.
          </p>
        </Section>

        <section className="border-t border-white/[0.08] pt-8">
          <p className="text-base text-white font-medium">There's an empty block on the schedule.</p>
          <p className="mt-2 text-sm text-gray-400 leading-relaxed">
            If it's still open, it's yours. Don't want to be live at 3 AM? Post a clip instead.
          </p>
          <Link to="/schedule" className="inline-block mt-5">
            <Button variant="primary" size="md">See the schedule</Button>
          </Link>
        </section>

      </div>
    </div>
  )
}
