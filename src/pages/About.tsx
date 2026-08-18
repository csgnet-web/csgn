import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { CSGN_MINT } from '@/lib/slots'
import { usePageMeta } from '@/hooks/usePageMeta'

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
  usePageMeta({
    title: 'About CSGN — How the 24/7 Crypto Channel Works',
    description: "How CSGN works: post a link to a clip you already made and it airs between live streams, or connect your Twitch once and get carried automatically. Airtime is one-to-one with the $CSGN you hold.",
    path: '/about',
  })

  return (
    <div className="min-h-screen pt-24 lg:pt-28 pb-24">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 space-y-8">

        <header>
          <h1 className="text-3xl sm:text-4xl font-bold font-display text-white leading-tight">
            A 24-hour TV channel for crypto that anyone can get on.
          </h1>
          <p className="mt-4 text-base text-gray-400 leading-relaxed">
            CSGN is always broadcasting. When a streamer from the network goes live, we put them on
            the channel. When nobody's live, we play clips our members sent in. That's the whole
            product — a channel that never goes dark, made out of other people's work.
          </p>
          <p className="mt-3 text-base text-gray-400 leading-relaxed">
            There's no audition and no application. Post a link, or connect your Twitch and keep
            streaming exactly as you already do.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/watch"><Button variant="primary" size="md">Watch the channel</Button></Link>
            <Link to="/studio"><Button variant="secondary" size="md">Post a clip</Button></Link>
          </div>
        </header>

        <Section title="Two ways to get on">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Term label="Post a clip">
              Paste a link to something you already put on YouTube, TikTok or Instagram. We check
              it, then it airs between the live streams. You don't have to be there.
            </Term>
            <Term label="Connect your Twitch">
              Tick one box giving us permission to carry your stream. Then just stream. When you go
              live we can put you on the channel, and you earn a share of trading fees for the
              minutes you're actually on.
            </Term>
          </div>
          <p>
            Live wins over clips. If a streamer goes on while your clip was queued, their stream
            takes the air and your clip moves to the next gap.
          </p>
        </Section>

        <Section title="Going live without managing anything">
          <p>
            This used to mean booking a two-hour block and remembering to be online for it. It
            doesn't any more. You connect Twitch once, grant permission, and carry on with your
            week. We check your channel about once a minute, and when you're live you show up on
            our board and can be put on the channel.
          </p>
          <p>
            You're paid for the minutes we actually carried you — not for being live on your own
            channel, and not for booking something you didn't show up to. If our checks fail,
            that's our problem and you're paid in full.
          </p>
          <p>
            You can still reserve a specific block if you want a guaranteed time. Most people
            don't, and don't need to.
          </p>
        </Section>

        <Section title="Clips, and how much airtime you get">
          <p>
            Between live streams the channel plays clips members sent in. How much of that time is
            yours is <strong className="text-white">one to one with the $CSGN you hold</strong> —
            hold 1% of the supply, get 1% of the open air. Hold twice as much, get twice as much.
          </p>
          <p>
            Your airtime is worked out from your wallet, not from your posting. It's yours whether
            or not you've uploaded anything, and you can see the number, the balance behind it and
            the share of supply it came from on your{' '}
            <Link to="/studio" className="text-primary-400 hover:text-primary-300 underline">studio page</Link>.
          </p>
          <p>
            There's a ceiling on how much of a day one member can take, so nobody can buy the whole
            channel. Every clip is watched by a person before it airs. Clips don't earn trading
            fees — live streams do. What holding buys you is the audience.
          </p>
        </Section>

        <Section title="What the token does">
          <p>
            $CSGN never gates having an account, connecting your Twitch, or going live — those are
            free and always will be. What it decides is what gets <em>promoted</em>: your share of
            clip airtime, whether you can put a line on the broadcast ticker, your weight in the
            Meme 100, and what it costs to win the coin spotlight.
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
          <p className="text-base text-white font-medium">The channel is on right now.</p>
          <p className="mt-2 text-sm text-gray-400 leading-relaxed">
            Something you made could be on it tonight. Paste a link — it takes about eleven seconds.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/studio"><Button variant="primary" size="md">Post a clip</Button></Link>
            <Link to="/schedule"><Button variant="secondary" size="md">See who's on</Button></Link>
          </div>
        </section>

      </div>
    </div>
  )
}
