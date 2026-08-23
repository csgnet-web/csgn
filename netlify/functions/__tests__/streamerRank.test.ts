import { describe, it, expect } from 'vitest'
import {
  rankStreamers, switchRecommendation, RANK_WEIGHTS,
  FRESH_PEAK_MINUTES, ROTATION_FULL_MINUTES, type RankCandidate,
} from '../_shared/streamerRank'

/**
 * These rules decide who goes on television, so they are pinned rather than
 * discovered live. The three failure modes they exist to prevent:
 *
 *   • the same streamer winning every night until the rest of the roster
 *     stops bothering,
 *   • a six-hour-old stream ranking level with one that just started,
 *   • a shortlist so noisy the MP stops reading it.
 */

const c = (over: Partial<RankCandidate> & { uid: string }): RankCandidate => ({
  username: over.uid, displayName: over.uid, live: true, viewerCount: 10,
  streamMinutes: 60, onAirMinutesToday: 0, balance: 0, ...over,
})

describe('rankStreamers', () => {
  it('ranks the bigger audience first, all else equal', () => {
    const r = rankStreamers([c({ uid: 'small', viewerCount: 5 }), c({ uid: 'big', viewerCount: 500 })])
    expect(r.map((x) => x.uid)).toEqual(['big', 'small'])
  })

  it('excludes anybody offline', () => {
    expect(rankStreamers([c({ uid: 'off', live: false })])).toEqual([])
  })

  // A shortlist that includes people you should not put on is one you stop
  // reading.
  it('excludes anybody below the viewer floor', () => {
    const r = rankStreamers([c({ uid: 'tiny', viewerCount: 1 }), c({ uid: 'ok', viewerCount: 9 })], 5)
    expect(r.map((x) => x.uid)).toEqual(['ok'])
  })

  it('is empty when nobody is live', () => {
    expect(rankStreamers([])).toEqual([])
    expect(rankStreamers([c({ uid: 'a', live: false })], 0)).toEqual([])
  })

  // THE TERM THAT KEEPS THE ROSTER ALIVE. Two identical streamers, one of whom
  // has already had a shift today — the other one goes on.
  it('prefers somebody who has not been carried today', () => {
    const r = rankStreamers([
      c({ uid: 'alreadyOn', onAirMinutesToday: ROTATION_FULL_MINUTES }),
      c({ uid: 'waiting', onAirMinutesToday: 0 }),
    ])
    expect(r[0].uid).toBe('waiting')
    expect(r[0].why).toContain('not on yet today')
  })

  it('prefers a fresh stream over a six-hour-old one', () => {
    const r = rankStreamers([
      c({ uid: 'stale', streamMinutes: 400 }),
      c({ uid: 'fresh', streamMinutes: FRESH_PEAK_MINUTES }),
    ])
    expect(r[0].uid).toBe('fresh')
  })

  it('gives a holder the edge over a non-holder at the same audience', () => {
    const r = rankStreamers([
      c({ uid: 'nothing', balance: 0 }),
      c({ uid: 'holder', balance: 5_000_000 }),
    ])
    expect(r[0].uid).toBe('holder')
  })

  // The corrections must not be able to overturn a genuine gap. Somebody with
  // ten times the audience wins on audience alone, and that is correct.
  it('never lets the tie-breakers beat a ten-fold audience gap', () => {
    const r = rankStreamers([
      c({ uid: 'huge', viewerCount: 1000, streamMinutes: 400, onAirMinutesToday: ROTATION_FULL_MINUTES, balance: 0 }),
      c({ uid: 'tiny', viewerCount: 10, streamMinutes: 10, onAirMinutesToday: 0, balance: 50_000_000 }),
    ])
    expect(r[0].uid).toBe('huge')
  })

  it('breaks a dead-heat on viewers', () => {
    const r = rankStreamers([c({ uid: 'a', viewerCount: 20 }), c({ uid: 'b', viewerCount: 20 })])
    expect(r).toHaveLength(2)
    expect(r[0].score).toBe(r[1].score)
  })

  it('publishes a breakdown that sums to the score', () => {
    const [top] = rankStreamers([c({ uid: 'a', viewerCount: 40, balance: 1_000 })])
    const { audience, freshness, rotation, stake } = top.breakdown
    expect(audience + freshness + rotation + stake).toBe(top.score)
  })

  it('keeps every score inside 0–100', () => {
    const r = rankStreamers([
      c({ uid: 'a', viewerCount: 99_999, balance: 1e9, streamMinutes: 0, onAirMinutesToday: 0 }),
      c({ uid: 'b', viewerCount: 0, balance: 0, streamMinutes: 9999, onAirMinutesToday: 9999 }),
    ])
    for (const row of r) {
      expect(row.score).toBeGreaterThanOrEqual(0)
      expect(row.score).toBeLessThanOrEqual(100)
    }
  })

  it('weights sum to one, so a perfect candidate scores 100', () => {
    const sum = RANK_WEIGHTS.audience + RANK_WEIGHTS.freshness + RANK_WEIGHTS.rotation + RANK_WEIGHTS.stake
    expect(sum).toBeCloseTo(1, 10)
  })

  // The MP is glancing at a phone. One clause, not a table.
  it('always gives a one-line reason mentioning the audience', () => {
    for (const row of rankStreamers([c({ uid: 'a', viewerCount: 42, gameName: 'Just Chatting' })])) {
      expect(row.why).toContain('42 watching')
      expect(row.why.length).toBeLessThan(90)
    }
  })
})

describe('switchRecommendation', () => {
  const ranked = () => rankStreamers([
    c({ uid: 'big', viewerCount: 300 }),
    c({ uid: 'small', viewerCount: 12 }),
  ])

  it('recommends the top candidate when nothing is on air', () => {
    const r = switchRecommendation(ranked(), null)
    expect(r?.uid).toBe('big')
  })

  it('recommends a switch when the current stream has emptied out', () => {
    const r = switchRecommendation(ranked(), { uid: 'x', viewerCount: 2, live: true })
    expect(r?.uid).toBe('big')
    expect(r?.why).toContain('against 2 on air now')
  })

  // A channel that changes hands every few minutes reads as broken. Silence is
  // the correct output most of the time.
  it('says nothing when the stream on air is holding its own', () => {
    expect(switchRecommendation(ranked(), { uid: 'x', viewerCount: 250, live: true })).toBeNull()
  })

  it('never recommends switching to whoever is already on', () => {
    const r = switchRecommendation(ranked(), { uid: 'big', viewerCount: 300, live: true })
    expect(r?.uid).not.toBe('big')
  })

  it('says nothing when nobody qualifies', () => {
    expect(switchRecommendation([], null)).toBeNull()
  })

  // An on-air streamer who has gone offline is worse than anybody live.
  it('recommends immediately when the current stream has dropped', () => {
    expect(switchRecommendation(ranked(), { uid: 'x', viewerCount: 900, live: false })?.uid).toBe('big')
  })
})
