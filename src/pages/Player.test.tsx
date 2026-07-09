/**
 * Integration tests for /player's playback pipeline: the real <Player />
 * component driven against a scripted fake of Twitch's embed API with fake
 * timers, one simulated second at a time.
 *
 * The scenarios encode Twitch's real startup behavior — a server-side-stitched
 * preroll ad plays first (READY/PLAYING fire during the ad), content follows —
 * plus the production failure this page shipped with: the embed freezing on
 * the first ad frame while its chrome still claims "playing". Every second,
 * the tests assert the on-air invariant: the embed is never visible without
 * the branded cover until FeedGate has confirmed settled broadcast content,
 * so no ad video, ad countdown text, or Twitch chrome can reach the encode.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

// ── Scripted stand-in for Twitch's embed player ─────────────────────────────

type Handler = () => void

class FakeTwitchPlayer {
  static READY = 'ready'
  static ONLINE = 'online'
  static OFFLINE = 'offline'
  static ENDED = 'ended'
  static PLAYING = 'playing'
  static PLAYBACK_BLOCKED = 'playbackBlocked'
  static instances: FakeTwitchPlayer[] = []

  host: HTMLElement
  opts: Record<string, unknown>
  handlers = new Map<string, Handler[]>()
  calls: Array<{ method: string; args: unknown[]; atMs: number }> = []
  currentTime = 0
  qualities: Array<{ group: string }> = []
  muted: boolean
  /** Simulates a browser autoplay policy that rejects gesture-less unmutes. */
  blockUnmute = false

  constructor(el: HTMLElement, opts: Record<string, unknown>) {
    this.host = el
    this.opts = opts
    this.muted = Boolean(opts.muted)
    el.appendChild(document.createElement('iframe'))
    FakeTwitchPlayer.instances.push(this)
  }

  private log(method: string, ...args: unknown[]) {
    this.calls.push({ method, args, atMs: Date.now() })
  }

  addEventListener(event: string, cb: Handler) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), cb])
  }
  removeEventListener() {}
  fire(event: string) {
    for (const cb of this.handlers.get(event) ?? []) cb()
  }

  play() { this.log('play') }
  pause() { this.log('pause') }
  setChannel(c: string) { this.log('setChannel', c) }
  getChannel() { return String(this.opts.channel ?? '') }
  setMuted(muted: boolean) {
    this.log('setMuted', muted)
    if (!muted && this.blockUnmute) {
      this.muted = true
      queueMicrotask(() => this.fire(FakeTwitchPlayer.PLAYBACK_BLOCKED))
      return
    }
    this.muted = muted
  }
  getMuted() { return this.muted }
  setVolume(v: number) { this.log('setVolume', v) }
  getVolume() { return 1 }
  setQuality(group: string) { this.log('setQuality', group) }
  getQualities() { return this.qualities }
  getQuality() { return 'auto' }
  getCurrentTime() { return this.currentTime }
}

// ── Module mocks ─────────────────────────────────────────────────────────────

const harness = vi.hoisted(() => ({
  obs: true,
  loadPlayer: (): Promise<unknown> => Promise.reject(new Error('unset')),
}))

vi.mock('@/lib/twitchEmbed', () => ({
  loadTwitchPlayer: () => harness.loadPlayer(),
}))
vi.mock('@/lib/environment', () => ({
  isOBS: () => harness.obs,
  obsVersion: () => '2.23.5',
}))
vi.mock('@/config/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  doc: () => ({}),
  onSnapshot: () => () => {}, // never delivers — defaults (no override, no VODs) apply
}))
vi.mock('@/lib/slots', () => ({
  DEFAULT_STREAM_URL: 'https://twitch.tv/csgnet',
  formatESTRange: () => '8:00 PM – 9:00 PM EST',
}))
vi.mock('@/contexts/useLiveSlot', () => ({
  useLiveSlot: () => ({
    currentSlot: {
      id: 'slot-1',
      streamUrl: 'https://www.twitch.tv/teststreamer',
      assignedUid: 'uid-1',
      assignedName: 'Test Streamer',
      status: 'confirmed',
      startTime: new Date(Date.now() - 3_600_000).toISOString(),
      endTime: new Date(Date.now() + 3_600_000).toISOString(),
    },
    allSlots: [],
    manualOverride: null,
    tokenStats: null,
    nowMs: Date.now(),
    slotsReady: true,
  }),
}))
// Presentation components stubbed to sentinels — these tests are about what
// the pipeline shows when, not how the cards look.
vi.mock('@/components/player/FeedCover', () => ({
  default: () => <div data-testid="feed-cover" />,
}))
vi.mock('@/components/player/IntermissionBoard', () => ({
  default: () => <div data-testid="intermission-board" />,
}))
vi.mock('@/components/player/StatusCard', () => ({
  default: ({ variant }: { variant: string }) => <div data-testid={`card-${variant}`} />,
}))
vi.mock('@/components/player/VodRotator', () => ({
  default: () => <div data-testid="vod-rotator" />,
}))
vi.mock('@/components/ui/WipeOverlay', () => ({
  WipeOverlay: () => null,
}))

import Player from './Player'

// ── Harness ──────────────────────────────────────────────────────────────────

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root | null = null
let host: HTMLElement | null = null
let t0 = 0

async function mountPlayer() {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => root!.render(<Player />))
  t0 = Date.now()
}

/** Seconds since mount for a fake-player call record. */
const secOf = (atMs: number) => (atMs - t0) / 1_000

const coverUp = () => document.querySelector('[data-testid="feed-cover"]') !== null
const embedVisible = (p: FakeTwitchPlayer) => p.host.style.visibility === 'visible'

/**
 * Advance the simulation one wall-clock second at a time. `script` runs just
 * before each 1s boundary (mutate fake playback state / fire embed events for
 * the second being entered); `invariant` runs just after, with the elapsed
 * seconds — use it to assert exposure rules continuously.
 */
async function passSeconds(
  n: number,
  script?: (sec: number) => void,
  invariant?: (sec: number) => void,
) {
  for (let i = 1; i <= n; i++) {
    await act(async () => {
      script?.(i)
      vi.advanceTimersByTime(1_000)
    })
    invariant?.(i)
  }
}

const callsOf = (p: FakeTwitchPlayer, method: string) => p.calls.filter((c) => c.method === method)
const unmutes = (p: FakeTwitchPlayer) => p.calls.filter((c) => c.method === 'setMuted' && c.args[0] === false)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  FakeTwitchPlayer.instances = []
  harness.obs = true
  harness.loadPlayer = () => Promise.resolve(FakeTwitchPlayer)
})

afterEach(async () => {
  if (root) await act(async () => root!.unmount())
  root = null
  host?.remove()
  host = null
  vi.useRealTimers()
})

// ── Scenarios ────────────────────────────────────────────────────────────────

describe('/player with a healthy Twitch preroll (OBS encoder)', () => {
  // Twitch-shaped timeline: READY fires, then PLAYING as the *stitched ad*
  // starts; currentTime advances through ad and content alike; the quality
  // list populates once the HLS session is up.
  const script = (p: () => FakeTwitchPlayer) => (sec: number) => {
    if (sec === 1) { p().fire(FakeTwitchPlayer.READY); p().fire(FakeTwitchPlayer.PLAYING) }
    p().currentTime = Math.max(0, sec - 1)
    if (sec >= 3) p().qualities = [{ group: 'chunked' }, { group: '720p60' }]
  }

  it('never exposes or pokes the embed during the ad window, then pins, unmutes and reveals', async () => {
    await mountPlayer()
    const player = () => FakeTwitchPlayer.instances[0]
    expect(FakeTwitchPlayer.instances).toHaveLength(1)

    const exposures: number[] = []
    await passSeconds(45, script(player), (sec) => {
      if (embedVisible(player()) && !coverUp()) exposures.push(sec)
    })

    // The embed went LIVE-visible early (PLAYING fired) but stayed covered for
    // the whole 33s preroll mask — first uncovered second is well past the ad.
    expect(exposures.length).toBeGreaterThan(0)
    expect(Math.min(...exposures)).toBeGreaterThanOrEqual(38)

    // Quiet bootstrap: zero play() calls, zero quality requests and zero
    // unmute attempts inside the mask window (the pokes that froze prerolls).
    expect(callsOf(player(), 'play')).toHaveLength(0)
    const pins = callsOf(player(), 'setQuality')
    expect(pins).toHaveLength(1)
    expect(pins[0].args).toEqual(['chunked'])
    expect(secOf(pins[0].atMs)).toBeGreaterThanOrEqual(35)
    const audioOn = unmutes(player())
    expect(audioOn.length).toBeGreaterThan(0)
    expect(secOf(audioOn[0].atMs)).toBeGreaterThanOrEqual(37)

    // End state: revealed, audible, on the LIVE feed.
    expect(coverUp()).toBe(false)
    expect(player().muted).toBe(false)
    expect(document.querySelector('[data-testid="card-starting-soon"]')).toBeNull()
    expect(document.querySelector('[data-testid="card-brb"]')).toBeNull()
  })

  it('constructs the embed muted+autoplay with no quality demand', async () => {
    await mountPlayer()
    const opts = FakeTwitchPlayer.instances[0].opts
    expect(opts.autoplay).toBe(true)
    expect(opts.muted).toBe(true)
    expect(opts.channel).toBe('teststreamer')
    expect('quality' in opts).toBe(false)
    // and the shell refuses pointer events so Twitch chrome can't be summoned
    expect(FakeTwitchPlayer.instances[0].host.style.pointerEvents).toBe('none')
  })
})

describe('/player when the embed freezes on the first preroll frame (the reported bug)', () => {
  it('keeps the cover up, rebuilds the wedged embed, and reveals by the deadline', async () => {
    await mountPlayer()
    expect(FakeTwitchPlayer.instances).toHaveLength(1)
    const first = FakeTwitchPlayer.instances[0]

    let rebuildBirthSec: number | null = null
    const exposures: number[] = []

    await passSeconds(
      70,
      (sec) => {
        const latest = FakeTwitchPlayer.instances.at(-1)!
        if (latest === first) {
          // Instance 1: ad starts (PLAYING fires, one frame renders) — then the
          // picture freezes forever while the player still claims "playing".
          if (sec === 1) { first.fire(FakeTwitchPlayer.READY); first.fire(FakeTwitchPlayer.PLAYING); first.currentTime = 0.5 }
          if (sec === 2) first.currentTime = 1.2
          // sec ≥ 3: currentTime pinned at 1.2 — frozen.
        } else {
          // Instance 2 (post-rebuild): healthy Twitch timeline.
          if (rebuildBirthSec === null) rebuildBirthSec = sec
          const local = sec - rebuildBirthSec
          if (local === 1) { latest.fire(FakeTwitchPlayer.READY); latest.fire(FakeTwitchPlayer.PLAYING) }
          latest.currentTime = Math.max(0, local - 1)
          if (local >= 3) latest.qualities = [{ group: 'chunked' }, { group: '720p60' }]
        }
      },
      (sec) => {
        const latest = FakeTwitchPlayer.instances.at(-1)!
        if (embedVisible(latest) && !coverUp()) exposures.push(sec)
      },
    )

    // The frozen embed was detected and torn down (~2s of frames + 20s stall),
    // never shown, never quality-poked; recovery got one gentle play() nudge.
    expect(FakeTwitchPlayer.instances).toHaveLength(2)
    expect(rebuildBirthSec).not.toBeNull()
    expect(rebuildBirthSec!).toBeLessThanOrEqual(25)
    expect(callsOf(first, 'setQuality')).toHaveLength(0)
    expect(unmutes(first)).toHaveLength(0)
    expect(callsOf(first, 'play').length).toBeLessThanOrEqual(1)

    // The cover held through the frozen embed and the rebuild's own bootstrap,
    // but never past the hard reveal deadline: the feed must be on-screen by
    // ~45s LIVE no matter what, even if the second embed's mask isn't done.
    const second = FakeTwitchPlayer.instances[1]
    expect(exposures.length).toBeGreaterThan(0)
    expect(Math.min(...exposures)).toBeGreaterThanOrEqual(40)
    expect(Math.min(...exposures)).toBeLessThanOrEqual(48)

    // And the page ended up actually playing: revealed, pinned, audible. The
    // quality pin still lands on the gate's clean post-mask moment.
    expect(coverUp()).toBe(false)
    expect(callsOf(second, 'setQuality')).toHaveLength(1)
    expect(second.muted).toBe(false)
    // The stall never bounced a live broadcast to BRB.
    expect(document.querySelector('[data-testid="card-brb"]')).toBeNull()
  })
})

describe('/player when the gate can never observe playback (blind getCurrentTime)', () => {
  it('force-reveals and unmutes at the deadline instead of holding Now Live forever', async () => {
    await mountPlayer()
    const exposures: number[] = []
    const announced = new Set<FakeTwitchPlayer>()

    await passSeconds(
      65,
      () => {
        // Every instance: PLAYING fires once (so the state machine goes LIVE)
        // but currentTime is pinned at 0 and the quality list never populates —
        // the gate sees no frames, ever, on the original embed or any rebuild.
        const latest = FakeTwitchPlayer.instances.at(-1)!
        if (!announced.has(latest)) {
          announced.add(latest)
          latest.fire(FakeTwitchPlayer.READY)
          latest.fire(FakeTwitchPlayer.PLAYING)
        }
      },
      (sec) => {
        const latest = FakeTwitchPlayer.instances.at(-1)!
        if (embedVisible(latest) && !coverUp()) exposures.push(sec)
      },
    )

    // The old behavior: covered rebuild loop forever ("stuck on Now Live").
    // Now the deadline lifts the curtain and turns audio on regardless.
    expect(exposures.length).toBeGreaterThan(0)
    expect(Math.min(...exposures)).toBeGreaterThanOrEqual(40)
    expect(Math.min(...exposures)).toBeLessThanOrEqual(48)
    expect(coverUp()).toBe(false)
    expect(FakeTwitchPlayer.instances.at(-1)!.muted).toBe(false)

    // After the forced reveal the gate loses teardown power — the on-screen
    // feed is never rebuilt out from under the viewer again.
    expect(FakeTwitchPlayer.instances.length).toBeLessThanOrEqual(2)
    expect(document.querySelector('[data-testid="card-brb"]')).toBeNull()
  })
})

describe('/player in a normal browser tab (autoplay policy blocks unmute)', () => {
  it('stays muted through the mask, surfaces tap-for-sound, and unlocks on the gesture', async () => {
    harness.obs = false
    await mountPlayer()
    const player = FakeTwitchPlayer.instances[0]
    player.blockUnmute = true

    await passSeconds(45, (sec) => {
      if (sec === 1) { player.fire(FakeTwitchPlayer.READY); player.fire(FakeTwitchPlayer.PLAYING) }
      player.currentTime = Math.max(0, sec - 1)
      if (sec >= 3) player.qualities = [{ group: 'chunked' }]
    })

    // The single unmute attempt happened post-confirm (never during the ad),
    // got blocked, and the affordance appeared; the feed stayed muted+playing.
    const attempts = unmutes(player)
    expect(attempts.length).toBeGreaterThan(0)
    expect(secOf(attempts[0].atMs)).toBeGreaterThanOrEqual(37)
    expect(player.muted).toBe(true)
    const button = document.querySelector('button')
    expect(button?.textContent).toContain('Tap for sound')

    // Viewer taps: policy unlocks, audio comes on, affordance clears.
    player.blockUnmute = false
    await act(async () => {
      window.dispatchEvent(new Event('pointerdown'))
      vi.advanceTimersByTime(100)
    })
    expect(player.muted).toBe(false)
    expect(document.querySelector('button')).toBeNull()
  })
})
