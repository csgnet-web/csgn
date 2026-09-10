import { describe, it, expect } from 'vitest'
import { parseRehearsal, legAt, demoReelItems, DEMO_CLIPS, type RehearsalPlan } from './rehearsal'

describe('parseRehearsal', () => {
  it('is null for a normal /player load', () => {
    expect(parseRehearsal('')).toBeNull()
    expect(parseRehearsal('?noads=1&debug=1')).toBeNull()
  })

  it('refuses to guess at an unrecognised value', () => {
    // The failure mode of guessing is a rehearsal frame going out over a real
    // broadcast, so an unknown value is not a rehearsal at all.
    expect(parseRehearsal('?rehearse=yes')).toBeNull()
    expect(parseRehearsal('?rehearse=')).toBeNull()
  })

  it('reads each fixed mode, and holds it', () => {
    for (const mode of ['clip', 'stream', 'master'] as const) {
      const plan = parseRehearsal(`?rehearse=${mode}`)!
      expect(plan.script).toHaveLength(1)
      expect(plan.script[0].mode).toBe(mode)
      expect(plan.loop).toBe(false)
      // A fixed mode never hands over — Infinity means "set no timer".
      expect(legAt(plan, 10 * 60_000).mode).toBe(mode)
      expect(legAt(plan, 10 * 60_000).remainingMs).toBe(Infinity)
    }
  })

  it('accepts the reel aliases', () => {
    expect(parseRehearsal('?rehearse=reel')!.script[0].mode).toBe('clip')
    expect(parseRehearsal('?rehearse=clips')!.script[0].mode).toBe('clip')
    expect(parseRehearsal('?rehearse=all')!.loop).toBe(true)
  })

  it('scripts the run in escalation order and loops it', () => {
    const plan = parseRehearsal('?rehearse=run&leg=10')!
    expect(plan.loop).toBe(true)
    expect(plan.script.map((l) => l.mode)).toEqual(['clip', 'stream', 'master', 'clip'])
    // The reel is the floor, so it opens on a double-length leg.
    expect(plan.script[0].seconds).toBe(20)
    expect(plan.script[1].seconds).toBe(10)
  })

  it('sanitises the channel the way the operator hook does', () => {
    expect(parseRehearsal('?rehearse=stream&channel=Some_Body')!.channel).toBe('some_body')
    expect(parseRehearsal('?rehearse=stream&channel=a b/../c')!.channel).toBe('abc')
    // Nothing usable left → the house channel rather than an empty tune.
    expect(parseRehearsal('?rehearse=stream&channel=!!!')!.channel).toBe('csgnet')
  })

  it('clamps the timings instead of trusting the URL', () => {
    expect(parseRehearsal('?rehearse=run&leg=0')!.script[1].seconds).toBe(45)
    expect(parseRehearsal('?rehearse=run&leg=-5')!.script[1].seconds).toBe(45)
    expect(parseRehearsal('?rehearse=run&leg=999999')!.script[1].seconds).toBe(3600)
    expect(parseRehearsal('?rehearse=clip&clip=2')!.clipSeconds).toBe(5)
    expect(parseRehearsal('?rehearse=clip&clip=nonsense')!.clipSeconds).toBe(20)
  })
})

describe('legAt', () => {
  const plan = (): RehearsalPlan => parseRehearsal('?rehearse=run&leg=10')!

  it('walks the script in order', () => {
    const p = plan() // clip 20s, stream 10s, master 10s, clip 10s = 50s
    expect(legAt(p, 0).mode).toBe('clip')
    expect(legAt(p, 19_999).mode).toBe('clip')
    expect(legAt(p, 20_000).mode).toBe('stream')
    expect(legAt(p, 29_999).mode).toBe('stream')
    expect(legAt(p, 30_000).mode).toBe('master')
    expect(legAt(p, 40_000).mode).toBe('clip')
  })

  it('reports how long is left on the leg, so one timer covers it', () => {
    const p = plan()
    expect(legAt(p, 0).remainingMs).toBe(20_000)
    expect(legAt(p, 5_000).remainingMs).toBe(15_000)
    expect(legAt(p, 25_000).remainingMs).toBe(5_000)
  })

  it('distinguishes the second clip leg from the first', () => {
    // Both are clip mode; a caller re-arming timers has to be able to tell that
    // the channel actually changed hands rather than stayed put.
    const p = plan()
    expect(legAt(p, 0).index).toBe(0)
    expect(legAt(p, 40_000).index).toBe(3)
  })

  it('wraps a looping run', () => {
    const p = plan()
    expect(legAt(p, 50_000).mode).toBe('clip')
    expect(legAt(p, 50_000).index).toBe(0)
    expect(legAt(p, 70_000).mode).toBe('stream')
    expect(legAt(p, 500_000).mode).toBe('clip')
  })

  it('survives a clock that went backwards', () => {
    // OBS browser sources have been seen to resume with a negative elapsed time
    // after a machine sleeps; a negative modulo must not throw or land nowhere.
    const p = plan()
    expect(['clip', 'stream', 'master']).toContain(legAt(p, -5_000).mode)
    expect(legAt(p, -5_000).remainingMs).toBeGreaterThan(0)
  })
})

describe('demoReelItems', () => {
  it('produces segments in the published schedule shape', () => {
    const items = demoReelItems(20)
    expect(items.length).toBeGreaterThan(0)
    for (const item of items) {
      // Everything VodRotator reads off a real segment has to be present, or
      // the rehearsal is rehearsing a different component.
      expect(item.platform).toBe('youtube')
      expect(item.seconds).toBe(20)
      expect(item.username).toMatch(/^rehearsal_/)
      expect(item.url).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\//)
      expect(item.url).toContain('autoplay=1')
      expect(item.look).toBeTruthy()
      expect(item.style).toBeTruthy()
      expect(item.motion).toBeTruthy()
    }
  })

  it('shows every card shape, not one shape five times', () => {
    // An operator framing a scene has to see the badge (top right) and the
    // ticker (full width, bottom) or they find out they collide on air.
    const styles = new Set(demoReelItems(20).map((i) => i.style))
    expect(styles.size).toBeGreaterThanOrEqual(4)
  })

  it('labels every segment as rehearsal footage', () => {
    for (const item of demoReelItems(20)) expect(item.title).toMatch(/rehearsal footage/i)
  })

  it('caps the count so a URL cannot ask for a thousand segments', () => {
    expect(demoReelItems(20, 500)).toHaveLength(12)
    expect(demoReelItems(20, 0)).toHaveLength(1)
  })

  it('only uses demo clips that were chosen for staying up', () => {
    const ids = DEMO_CLIPS.map((c) => c.videoId)
    for (const item of demoReelItems(20)) {
      expect(ids.some((id) => item.url.includes(id))).toBe(true)
    }
  })
})
