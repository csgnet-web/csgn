import { describe, it, expect } from 'vitest'
import {
  createFeedGate,
  PROGRESS_TICK_MS,
  PREROLL_MASK_MS,
  PIN_WAIT_MS,
  POST_PIN_STABLE_MS,
  CONFIRM_STABLE_MS,
  CONFIRM_LOSS_STALL_MS,
  STALL_REBUILD_MS,
  type FeedGate,
  type GateDecision,
  type GateSample,
} from './feedGate'

/** Realistic epoch-ish base so "ms since 0" guards can't pass by accident. */
const T0 = 1_700_000_000_000

/**
 * Drives a gate one 1s sample at a time, the way /player's poll does, and
 * records every decision. `timeline(tickIndex)` returns the sample for the
 * tick at T0 + tickIndex * 1s (tick 1 is the first sample after creation).
 */
function run(
  gate: FeedGate,
  ticks: number,
  timeline: (tick: number) => Omit<GateSample, 'nowMs'>,
): Array<GateDecision & { atMs: number; tick: number }> {
  const out: Array<GateDecision & { atMs: number; tick: number }> = []
  for (let tick = 1; tick <= ticks; tick++) {
    const nowMs = T0 + tick * PROGRESS_TICK_MS
    out.push({ ...gate.sample({ nowMs, ...timeline(tick) }), atMs: nowMs, tick })
  }
  return out
}

const sec = (ms: number) => ms / 1_000

/** Twitch-shaped happy path: 2s of buffering, then the stitched preroll plays
 *  (frames advance, ad video), content continues seamlessly after. Quality
 *  list populates once the HLS session is up. */
function adThenContent(tick: number): Omit<GateSample, 'nowMs'> {
  return {
    currentTimeS: tick <= 2 ? 0 : tick - 2, // frames advance 1s/s from tick 3
    qualityCount: tick <= 2 ? 0 : 5,
    live: tick >= 3, // PLAYING fired at ad start → master control went LIVE
  }
}

describe('feedGate — clean startup with a preroll', () => {
  // Frames start at tick 3 ⇒ mask ends 33s later, at tick 3 + 33 = 36.
  const maskEndTick = 3 + sec(PREROLL_MASK_MS)

  it('never confirms (cover stays down) during the entire ad-mask window', () => {
    const d = run(createFeedGate(T0), 60, adThenContent)
    for (const step of d.filter((s) => s.tick < maskEndTick)) {
      expect(step.confirmed, `tick ${step.tick}`).toBe(false)
    }
  })

  it('issues no quality pin until the mask has elapsed, then exactly one', () => {
    const d = run(createFeedGate(T0), 60, adThenContent)
    const pins = d.filter((s) => s.pinQuality)
    expect(pins.map((p) => p.tick)).toEqual([maskEndTick])
  })

  it('confirms once the pin has settled, and reports on-air', () => {
    const d = run(createFeedGate(T0), 60, adThenContent)
    const confirmTick = maskEndTick + sec(POST_PIN_STABLE_MS)
    const first = d.find((s) => s.confirmed)
    expect(first?.tick).toBe(confirmTick)
    expect(first?.phase).toBe('on-air')
    // and it stays confirmed while frames keep flowing
    for (const step of d.filter((s) => s.tick > confirmTick)) {
      expect(step.confirmed, `tick ${step.tick}`).toBe(true)
    }
  })

  it('never nudges or rebuilds a healthy startup', () => {
    const d = run(createFeedGate(T0), 60, adThenContent)
    expect(d.some((s) => s.nudge)).toBe(false)
    expect(d.some((s) => s.rebuild)).toBe(false)
  })

  it('reports ad-mask phase while frames flow inside the window', () => {
    const d = run(createFeedGate(T0), 60, adThenContent)
    expect(d.find((s) => s.tick === 10)?.phase).toBe('ad-mask')
    expect(d.find((s) => s.tick === 10)?.maskRemainingMs).toBe(PREROLL_MASK_MS - 7_000)
  })
})

describe('feedGate — the reported failure: embed freezes on the first ad frame', () => {
  // Ad renders one frame at tick 3 (currentTime 0 → 0.5) and never advances
  // again; the player chrome keeps claiming "playing" and PLAYING already
  // flipped master control to LIVE. The old page trusted the event, lifted
  // the cover on the frozen ad, and never recovered.
  function frozenAd(tick: number): Omit<GateSample, 'nowMs'> {
    return {
      currentTimeS: tick <= 2 ? 0 : 0.5,
      qualityCount: 0,
      live: tick >= 3,
    }
  }

  it('never confirms, so the frozen ad never reaches the encode', () => {
    const d = run(createFeedGate(T0), 60, frozenAd)
    expect(d.some((s) => s.confirmed)).toBe(false)
  })

  it('tries one gentle nudge once the stall is real', () => {
    const d = run(createFeedGate(T0), 60, frozenAd)
    const nudges = d.filter((s) => s.nudge)
    // frames stopped at tick 3 → stall threshold crossed at tick 3 + 6s
    expect(nudges.map((n) => n.tick)).toEqual([3 + sec(CONFIRM_LOSS_STALL_MS)])
  })

  it('signals a rebuild after 20s without frames, and re-signals if ignored', () => {
    const d = run(createFeedGate(T0), 60, frozenAd)
    const rebuilds = d.filter((s) => s.rebuild)
    const first = 3 + sec(STALL_REBUILD_MS)
    expect(rebuilds.map((r) => r.tick)).toEqual([first, first + sec(STALL_REBUILD_MS)])
  })

  it('never issues a quality pin at a frozen player', () => {
    const d = run(createFeedGate(T0), 60, frozenAd)
    expect(d.some((s) => s.pinQuality)).toBe(false)
  })
})

describe('feedGate — embed produces no frames at all while LIVE', () => {
  // Server Helix check says the channel is live but the embed is wedged/
  // mistuned and currentTime sits at 0 forever.
  const dead = (): Omit<GateSample, 'nowMs'> => ({ currentTimeS: 0, qualityCount: 0, live: true })

  it('stays in boot, never confirms, and asks for a rebuild at 20s', () => {
    const d = run(createFeedGate(T0), 45, dead)
    expect(d.some((s) => s.confirmed)).toBe(false)
    expect(d.find((s) => s.tick === 10)?.phase).toBe('boot')
    const rebuilds = d.filter((s) => s.rebuild)
    expect(rebuilds[0]?.tick).toBe(sec(STALL_REBUILD_MS))
  })

  it('never nudges an embed that has not played yet (quiet bootstrap)', () => {
    const d = run(createFeedGate(T0), 45, dead)
    expect(d.some((s) => s.nudge)).toBe(false)
  })
})

describe('feedGate — offline channel (not LIVE) stays quiet', () => {
  it('no rebuild, no nudge, no confirm while intermission holds an idle embed', () => {
    const d = run(createFeedGate(T0), 90, () => ({ currentTimeS: 0, qualityCount: 0, live: false }))
    expect(d.some((s) => s.confirmed || s.nudge || s.rebuild)).toBe(false)
  })
})

describe('feedGate — mid-broadcast stalls', () => {
  // Healthy confirmed feed, then frames stop at tick 50 for `stallTicks`
  // seconds, then resume advancing.
  const stallAt = 50
  function stalling(stallTicks: number) {
    return (tick: number): Omit<GateSample, 'nowMs'> => {
      let t: number
      if (tick < stallAt) t = tick // advancing
      else if (tick < stallAt + stallTicks) t = stallAt - 1 // frozen
      else t = stallAt - 1 + (tick - (stallAt + stallTicks) + 1) // resumed
      return { currentTimeS: t, qualityCount: 5, live: true }
    }
  }

  it('a 3s rebuffer never drops confirmation (no cover strobe)', () => {
    const d = run(createFeedGate(T0), 80, stalling(3))
    for (const step of d.filter((s) => s.tick >= 40)) {
      expect(step.confirmed, `tick ${step.tick}`).toBe(true)
    }
  })

  it('an 8s stall re-covers, nudges once, and re-confirms ~2s after recovery without re-masking', () => {
    const stallTicks = 8
    const d = run(createFeedGate(T0), 90, stalling(stallTicks))
    const lossTick = stallAt - 1 + sec(CONFIRM_LOSS_STALL_MS) // last progress was at tick 49
    expect(d.find((s) => s.tick === lossTick)?.confirmed).toBe(false)
    expect(d.filter((s) => s.nudge).map((s) => s.tick)).toEqual([lossTick])
    // recovery at tick 58; stall was 9s < REMASK_STALL_MS ⇒ same session, no
    // fresh mask and no second pin — re-confirm after the stability run.
    const reconfirm = d.find((s) => s.tick >= stallAt + stallTicks && s.confirmed)
    expect(reconfirm?.tick).toBe(stallAt + stallTicks + sec(CONFIRM_STABLE_MS))
    expect(d.filter((s) => s.pinQuality).length).toBe(1)
  })

  it('a long outage re-masks on recovery (fresh preroll risk) and re-pins', () => {
    const stallTicks = 20 // ≥ REMASK_STALL_MS ⇒ Twitch restarts the session
    const d = run(createFeedGate(T0), 130, stalling(stallTicks))
    const resumeTick = stallAt + stallTicks // first advancing sample again
    // no confirmation for a full mask window after recovery
    const maskedUntil = resumeTick + sec(PREROLL_MASK_MS)
    for (const step of d.filter((s) => s.tick >= resumeTick && s.tick < maskedUntil)) {
      expect(step.confirmed, `tick ${step.tick}`).toBe(false)
    }
    // frames first advance at tick 2 in this timeline ⇒ initial pin at 2+33s
    const pins = d.filter((s) => s.pinQuality).map((s) => s.tick)
    expect(pins).toEqual([2 + sec(PREROLL_MASK_MS), maskedUntil]) // initial pin + post-outage pin
    expect(d.find((s) => s.tick === maskedUntil + sec(POST_PIN_STABLE_MS))?.confirmed).toBe(true)
  })

  it('rebuild fires during a stall only once LIVE frames have been absent 20s', () => {
    const d = run(createFeedGate(T0), 90, stalling(25))
    const rebuilds = d.filter((s) => s.rebuild).map((s) => s.tick)
    expect(rebuilds).toEqual([stallAt - 1 + sec(STALL_REBUILD_MS)])
  })
})

describe('feedGate — playback position quirks', () => {
  it('a backwards seek (ad→content handoff, live-edge catchup) counts as activity, not a stall', () => {
    const d = run(createFeedGate(T0), 60, (tick) => ({
      // advances, then jumps back hard at tick 40 and keeps advancing
      currentTimeS: tick < 40 ? tick : tick - 35,
      qualityCount: 5,
      live: true,
    }))
    for (const step of d.filter((s) => s.tick >= 38 && s.tick <= 45)) {
      expect(step.confirmed, `tick ${step.tick}`).toBe(true)
    }
    expect(d.some((s) => s.nudge || s.rebuild)).toBe(false)
  })

  it('sub-epsilon jitter on a paused clock does not count as frames', () => {
    const d = run(createFeedGate(T0), 40, (tick) => ({
      currentTimeS: 10 + tick * 0.01, // 10ms/s of drift — not playback
      qualityCount: 5,
      live: true,
    }))
    expect(d.some((s) => s.confirmed)).toBe(false)
    expect(d.filter((s) => s.rebuild).length).toBeGreaterThan(0)
  })
})

describe('feedGate — degraded environments', () => {
  it('without getCurrentTime, falls back to the PLAYING event and still masks the preroll', () => {
    const gate = createFeedGate(T0)
    gate.notePlaying() // embed fired PLAYING; currentTime unavailable
    const d = run(gate, 60, () => ({ currentTimeS: null, qualityCount: 5, live: true }))
    const sessionStart = 1 // first sample already counts as playing
    const maskEnd = sessionStart + sec(PREROLL_MASK_MS)
    for (const step of d.filter((s) => s.tick < maskEnd)) {
      expect(step.confirmed, `tick ${step.tick}`).toBe(false)
    }
    expect(d.filter((s) => s.pinQuality).map((s) => s.tick)).toEqual([maskEnd])
    expect(d.find((s) => s.tick === maskEnd + sec(POST_PIN_STABLE_MS))?.confirmed).toBe(true)
    expect(d.some((s) => s.rebuild)).toBe(false) // no frame truth ⇒ no false rebuilds
  })

  it('when the quality list never populates, confirms on auto quality instead of poking blind', () => {
    const d = run(createFeedGate(T0), 60, (tick) => ({
      currentTimeS: tick <= 2 ? 0 : tick - 2,
      qualityCount: 0, // list never arrives
      live: tick >= 3,
    }))
    expect(d.some((s) => s.pinQuality)).toBe(false)
    // pin is skipped PIN_WAIT_MS after the mask, confirm lands there
    const confirmTick = 3 + sec(PREROLL_MASK_MS) + sec(PIN_WAIT_MS)
    expect(d.find((s) => s.confirmed)?.tick).toBe(confirmTick)
  })
})
