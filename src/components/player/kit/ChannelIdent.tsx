import { useEffect, useState } from 'react'
import { BROADCAST, CornerMarks, Kicker, Rule, StripeField } from './BroadcastKit'

/**
 * THE CHANNEL IDENT.
 *
 * The three seconds of branding that plays between segments. This is the single
 * highest-leverage graphic on the whole channel and it is worth saying why:
 *
 * A viewer decides whether they are watching "a channel" or "someone's stream"
 * in the first few seconds, and almost entirely from production furniture
 * rather than content. An ident is the clearest possible signal — it is a thing
 * that only exists because somebody MADE it, and it recurs, so it reads as a
 * network rather than a broadcast. It costs three seconds of airtime and buys
 * the whole package credibility.
 *
 * ── The construction ───────────────────────────────────────────────────────
 *
 * Four beats over ~2.6s, driven from one `phase` counter rather than from CSS
 * animation delays. That matters: the ident has to be able to END on cue when
 * the next segment is ready, and a stack of independently-timed CSS animations
 * cannot be interrupted cleanly — you get a graphic that is halfway through
 * something when the video cuts under it.
 *
 *   0  BLACK        the cut to nothing that makes the rest land
 *   1  STRIPES      diagonal bars sweep the frame
 *   2  WORDMARK     hard cut in, no fade — a fade here reads as a website
 *   3  LOCKUP       rule draws, tagline sets, hold
 *
 * Everything is a hard cut or a linear move. No easing curves that overshoot,
 * no bounce: this is broadcast furniture, not a UI animation.
 */

const BEATS = [140, 420, 900, 1140] as const

export function ChannelIdent({ onDone }: { onDone?: () => void }) {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const timers = BEATS.map((ms, i) => setTimeout(() => setPhase(i + 1), ms))
    const done = setTimeout(() => onDone?.(), 2600)
    return () => { for (const t of timers) clearTimeout(t); clearTimeout(done) }
  }, [onDone])

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {/* Beat 1 — the stripes sweep through and leave. */}
      <div style={{ opacity: phase >= 1 && phase < 3 ? 0.9 : 0 }}>
        <StripeField progress={phase >= 1 ? 1 : 0} />
      </div>

      {/* Beat 2 — the accent field slams in from the bottom-left. */}
      <div
        className="absolute inset-0"
        style={{
          background: BROADCAST.accent,
          clipPath: 'polygon(0 100%, 100% 0, 100% 100%, 0 100%)',
          opacity: phase >= 2 ? 1 : 0,
          transform: phase >= 2 ? 'translate(0,0)' : 'translate(-30%, 30%)',
          transition: 'transform 220ms linear',
        }}
      />

      {phase >= 2 && <CornerMarks tone="#ffffff" />}

      {/* Beat 3 — the wordmark. A hard cut, deliberately: fading a logo in is
          the single most common way a broadcast package reads as a slideshow. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div style={{ opacity: phase >= 2 ? 1 : 0 }}>
          <h1
            className="font-display font-black uppercase text-white leading-[0.8] tracking-[-0.045em] text-center"
            style={{ fontSize: 260 }}
          >
            CSGN
          </h1>
        </div>

        <div
          className="mt-8 overflow-hidden"
          style={{
            width: phase >= 3 ? 720 : 0,
            transition: 'width 260ms linear',
          }}
        >
          <Rule tone="paper" className="w-[720px]" />
        </div>

        <div className="mt-8" style={{ opacity: phase >= 3 ? 1 : 0 }}>
          <Kicker tone="paper" className="text-[26px]">
            Crypto&rsquo;s Entertainment Flagship
          </Kicker>
        </div>
      </div>

      {/* The 24/7 mark, bottom-right, because a channel that runs continuously
          should say so on the one graphic everybody sees repeatedly. */}
      <div className="absolute right-24 bottom-24 text-right" style={{ opacity: phase >= 3 ? 1 : 0 }}>
        <p className="font-display font-black text-white leading-none tabular-nums" style={{ fontSize: 76 }}>24/7</p>
        <p className="mt-2 font-black uppercase tracking-[0.32em] text-white/70 text-[15px]">On&nbsp;Solana</p>
      </div>
    </div>
  )
}

export default ChannelIdent
