import { describe, it, expect, beforeEach } from 'vitest'
import type { TwitchLinkStatus } from './api'
import {
  TWITCH_LINK_KEY,
  clearPendingTwitchLink,
  pollDelayMs,
  readPendingTwitchLink,
  storePendingTwitchLink,
  waitForTwitchLink,
} from './twitchLink'

const LINK = { state: 'st_abc', linkToken: 'tok_abc', createdAt: Date.now() }

const READY: TwitchLinkStatus = {
  status: 'ready',
  twitchProofToken: 'proof',
  twitchUserId: '1',
  username: 'streamer',
  displayName: 'Streamer',
  profileImageUrl: '',
}

beforeEach(() => sessionStorage.clear())

describe('pending link storage', () => {
  it('round-trips the state and its link token', () => {
    storePendingTwitchLink(LINK)
    expect(readPendingTwitchLink()).toEqual(LINK)
  })

  it('drops a link older than the server-side token life', () => {
    storePendingTwitchLink({ ...LINK, createdAt: Date.now() - 20 * 60 * 1000 })
    expect(readPendingTwitchLink()).toBeNull()
    expect(sessionStorage.getItem(TWITCH_LINK_KEY)).toBeNull()
  })

  it('survives a corrupted or half-written entry', () => {
    sessionStorage.setItem(TWITCH_LINK_KEY, '{not json')
    expect(readPendingTwitchLink()).toBeNull()
    sessionStorage.setItem(TWITCH_LINK_KEY, JSON.stringify({ state: 'only-a-state' }))
    expect(readPendingTwitchLink()).toBeNull()
  })

  it('clears on demand', () => {
    storePendingTwitchLink(LINK)
    clearPendingTwitchLink()
    expect(readPendingTwitchLink()).toBeNull()
  })
})

describe('pollDelayMs', () => {
  it('is fast while the common case is still plausible, then backs off', () => {
    expect(pollDelayMs(0)).toBe(2_000)
    expect(pollDelayMs(30_000)).toBe(3_000)
    expect(pollDelayMs(120_000)).toBe(5_000)
  })
})

describe('waitForTwitchLink', () => {
  /** Virtual clock: the delays are real minutes, the test is not. */
  function harness(responses: Array<TwitchLinkStatus | Error>) {
    let clock = 0
    let calls = 0
    return {
      calls: () => calls,
      options: {
        now: () => clock,
        sleep: async (ms: number) => { clock += ms },
        claim: async () => {
          const next = responses[Math.min(calls, responses.length - 1)]
          calls += 1
          if (next instanceof Error) throw next
          return next
        },
      },
    }
  }

  it('keeps polling through `pending` and resolves with the proof', async () => {
    const h = harness([{ status: 'pending' }, { status: 'pending' }, READY])
    await expect(waitForTwitchLink(LINK, h.options)).resolves.toEqual(READY)
    expect(h.calls()).toBe(3)
  })

  it('stops on a terminal failure instead of spinning until timeout', async () => {
    const h = harness([{ status: 'pending' }, { status: 'failed', error: 'duplicate_twitch' }])
    await expect(waitForTwitchLink(LINK, h.options)).resolves.toEqual({ status: 'failed', error: 'duplicate_twitch' })
  })

  it('rides out a dropped request — switching apps kills requests, not sign-ups', async () => {
    const h = harness([new Error('network'), new Error('network'), READY])
    await expect(waitForTwitchLink(LINK, h.options)).resolves.toEqual(READY)
  })

  it('gives up quietly after the timeout', async () => {
    const h = harness([{ status: 'pending' }])
    await expect(waitForTwitchLink(LINK, { ...h.options, timeoutMs: 10_000 })).resolves.toBeNull()
  })

  it('stops immediately when the caller aborts', async () => {
    const controller = new AbortController()
    controller.abort()
    const h = harness([READY])
    await expect(waitForTwitchLink(LINK, { ...h.options, signal: controller.signal })).resolves.toBeNull()
    expect(h.calls()).toBe(0)
  })
})
