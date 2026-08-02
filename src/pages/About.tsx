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
          <p className="mt-3 text-base text-gray-400 leading-relaxed">
            That's the whole idea. Everything below is how it works.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/schedule"><Button variant="primary" size="md">See what's open</Button></Link>
            <Link to="/watch"><Button variant="secondary" size="md">Watch now</Button></Link>
          </div>
        </header>

        <Section title="Why a schedule and not a feed">
          <p>
            Every crypto app you've used gives you a feed. A feed is a slot machine — you put a
            thought in, pull the handle, and something else decides whether anyone hears it. You
            don't have a spot. You have a chance, and it resets every morning.
          </p>
          <p>
            Television never worked that way, but television also never let you in. There's no open
            call at ESPN. You can't claim eleven o'clock.
          </p>
          <p>
            We're the third thing: a real channel with a real schedule and real holes in it. If
            nobody's booked 3 PM, 3 PM is yours. Nobody votes on whether you're interesting. The
            hour was empty and you took it.
          </p>
        </Section>

        <Section title="Claiming an hour">
          <p>
            Open blocks run from 3 AM to 7 PM ET. From 7 PM to 3 AM we run our own programming —
            CSGN Originals — so those hours aren't claimable.
          </p>
          <p>You need three things, and only the first two take any effort:</p>
          <div className="grid gap-2.5 sm:grid-cols-3">
            <Term label="A wallet">
              Connect Phantom. It's how you sign in and where your share of the fees goes.
            </Term>
            <Term label="A verified email">
              We send a link, you click it. This is what stops one person claiming the whole week.
            </Term>
            <Term label="A Twitch channel">
              You stream to your own channel as normal. We put it on the network.
            </Term>
          </div>
          <p>
            You keep streaming where you already stream. Claiming a slot doesn't move you anywhere —
            it puts your channel on a network with a lower third, a ticker and a schedule, in front
            of people who came for the channel rather than for you. That's the difference.
          </p>
          <p>
            While you're on air you earn <strong className="text-white">30% of $CSGN's trading
            fees</strong> for the whole block. Not a tip jar, not a share of ad revenue that doesn't
            exist yet — a cut of what the token actually generates while you're the one on screen.
          </p>
        </Section>

        <Section title="What the token does">
          <p>
            $CSGN isn't a key. It doesn't gate making an account, claiming a slot, or going live —
            all of that is free and always will be. What it does is decide what gets{' '}
            <em>promoted</em>.
          </p>
          <p>
            The important part: <strong className="text-white">holding is not spending.</strong>{' '}
            Nothing here burns your tokens, locks them, escrows them, or asks you to deposit them.
            Your voting power is simply what's in your wallet right now, read from the chain. Sell
            tomorrow and your weight goes with it. That's the entire mechanic.
          </p>
          <div className="grid gap-2.5">
            <Term label="Meme 100">
              A ranked board of coins. You back one with your $CSGN and the standings go on air. The
              rank blends holder votes, 24h volume, market cap and how much is actually happening on
              the chart — and every coin on it has its contract address right there on the card, so
              you can check what you're backing. Change your pick whenever you like; your weight
              moves with you.
            </Term>
            <Term label="Right Now">
              Hold enough $CSGN and you can push a line onto the broadcast ticker. Your words, on
              the network, on air.
            </Term>
            <Term label="Coin Jukebox">
              Pay to put a coin in the spotlight, in SOL or $CSGN. Like TouchTunes, for the ticker.
              The money goes to the treasury.
            </Term>
            <Term label="Network votes">
              Holders decide things that affect the channel. Weight is your balance, tallies are
              re-checked against live on-chain holdings when a vote closes, and the totals are
              public.
            </Term>
          </div>
          <p>
            <strong className="text-white">We never burn anything.</strong> Burning destroys capital
            once for a press release. Instead everything the network takes in goes to one public
            treasury under published rules, so you can watch the balance and hold us to it. It's on{' '}
            <Link to="/treasury" className="text-primary-400 hover:text-primary-300 underline">
              /treasury
            </Link>.
          </p>
        </Section>

        <Section title="The games">
          <p>
            Two, and they work on opposite principles on purpose.
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Term label="Starting 5 — daily, free">
              Pick five coins off the day's slate, one from each size tier, and name a captain. Go
              5-for-5 and you take a share of 100,000 $CSGN. Nobody goes perfect, the jackpot rolls
              into tomorrow. It's free to enter — how many lineups you get depends on what you hold,
              and everybody gets at least one.
            </Term>
            <Term label="Squares — weekly, paid">
              The office pool. Buy squares on a 10×10 grid, digits get drawn after entries close,
              and the winner takes 500,000 $CSGN on a full board. This is the one game that costs
              money: the prize is the entry pool minus a published rake. A short board pays a
              shorter prize — we don't pretend otherwise.
            </Term>
          </div>
          <p>
            Both draws are reproducible. The random numbers come from a Solana blockhash sampled
            <em> after</em> entries close, run through a published function — so nobody, including
            us, could know the result while the game was open, and anyone can re-derive it
            afterwards.
          </p>
          <p className="text-gray-500">
            Neither game is open yet. The engines are built and tested; the boards go live once the
            first slate runs.
          </p>
        </Section>

        <Section title="Your profile">
          <p>
            Your profile is at <span className="font-mono text-gray-300">/account</span>. It shows
            your slots and what they earned, your $CSGN holdings and what they entitle you to, your
            game record, and your Meme 100 vote — which you can change from there any time.
          </p>
          <p>
            Other members can find you at{' '}
            <span className="font-mono text-gray-300">csgn.fun/u/yourname</span>. That page shows
            your name, your Twitch, your slots and your winnings.{' '}
            <strong className="text-white">It does not show your email address.</strong> Your email
            is visible to you and nobody else — it isn't in any response another member can reach.
          </p>
        </Section>

        <Section title="The token">
          <p>$CSGN is on Solana, launched on pump.fun.</p>
          <div className="rounded-lg border border-white/[0.07] bg-white/[0.015] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-gray-500">Contract address</p>
            <p className="mt-1 font-mono text-xs text-gray-300 break-all">{CSGN_MINT}</p>
          </div>
          <p className="text-gray-500">
            Nothing on this site is financial advice. The games pay real tokens to real people and
            the token can go to zero like any other. Don't put in money you need.
          </p>
        </Section>

        <Section title="Open source">
          <p>
            All of it. The player, the schedule, the games, the payout ledger, the broadcast
            graphics — MIT licensed, on{' '}
            <a
              href="https://github.com/csgnet-web/csgn"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-400 hover:text-primary-300 underline"
            >
              GitHub
            </a>. Fork it, point the wallets at your own, and run your own network. We'd rather the
            idea spread than be the only ones with it.
          </p>
        </Section>

        <section className="border-t border-white/[0.08] pt-8">
          <p className="text-base text-white font-medium">There's an empty hour on the schedule.</p>
          <p className="mt-2 text-sm text-gray-400 leading-relaxed">
            Go look at it. If it's still open, it's yours.
          </p>
          <Link to="/schedule" className="inline-block mt-5">
            <Button variant="primary" size="md">See the schedule</Button>
          </Link>
        </section>

      </div>
    </div>
  )
}
