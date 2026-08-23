import { describe, it, expect } from 'vitest'
import {
  parseTokens, parseProfile, parseVideoList, envelopeOk, videoLabel,
  accessTokenUsable, refreshTokenExpired,
} from '../_shared/tiktok'

// TikTok signals failure with HTTP 200 and an error code INSIDE the body. A
// caller that only checks res.ok turns every failure into an empty list — the
// exact "empty state indistinguishable from a failure" that has caused every
// serious bug in this project.
describe('envelopeOk', () => {
  it('accepts an ok envelope and a missing one', () => {
    expect(envelopeOk({ error: { code: 'ok' } })).toBe(true)
    expect(envelopeOk({ data: {} })).toBe(true)
  })
  it('rejects an error envelope', () => {
    expect(envelopeOk({ error: { code: 'access_token_invalid' } })).toBe(false)
    expect(envelopeOk({ error: { code: 'scope_not_authorized' } })).toBe(false)
  })
})

describe('parseTokens', () => {
  const NOW = 1_700_000_000_000
  it('reads a token response and turns lifetimes into absolute times', () => {
    const t = parseTokens({
      access_token: 'at', refresh_token: 'rt',
      expires_in: 86_400, refresh_expires_in: 31_536_000,
      open_id: 'oid', scope: 'user.info.basic,video.list',
    }, NOW)
    expect(t).not.toBeNull()
    expect(t!.accessExpiresAt).toBe(NOW + 86_400_000)
    expect(t!.refreshExpiresAt).toBe(NOW + 31_536_000_000)
    expect(t!.openId).toBe('oid')
  })
  it('is null without both tokens', () => {
    expect(parseTokens({ access_token: 'at' })).toBeNull()
    expect(parseTokens({ error: 'invalid_grant' })).toBeNull()
    expect(parseTokens(null)).toBeNull()
  })
  it('falls back to sane lifetimes when TikTok omits them', () => {
    const t = parseTokens({ access_token: 'at', refresh_token: 'rt' }, NOW)
    expect(t!.accessExpiresAt).toBeGreaterThan(NOW)
    expect(t!.refreshExpiresAt).toBeGreaterThan(t!.accessExpiresAt)
  })
})

describe('parseProfile', () => {
  it('reads a user', () => {
    const p = parseProfile({ data: { user: { open_id: 'o', display_name: 'Rob', avatar_url: 'a', username: 'rob' } }, error: { code: 'ok' } })
    expect(p).toEqual({ openId: 'o', displayName: 'Rob', avatarUrl: 'a', username: 'rob' })
  })
  it('is null on an error envelope', () => {
    expect(parseProfile({ error: { code: 'access_token_invalid' } })).toBeNull()
  })
  it('is null on an empty body', () => {
    expect(parseProfile({ data: {} })).toBeNull()
    expect(parseProfile(null)).toBeNull()
  })
})

describe('parseVideoList', () => {
  const page = {
    error: { code: 'ok' },
    data: {
      videos: [
        {
          id: 7300000000000000000, title: 'the funniest thing all week',
          video_description: '#fyp', duration: 34,
          cover_image_url: 'https://cdn/cover.jpg',
          share_url: 'https://www.tiktok.com/@rob/video/7300000000000000000',
          embed_link: 'https://www.tiktok.com/embed/v2/7300000000000000000',
          create_time: 1_700_000_000,
        },
        // No share URL: cannot be imported, so it must not be offered.
        { id: '7300000000000000001', duration: 12, cover_image_url: 'x' },
      ],
      cursor: 1_700_000_000_000,
      has_more: true,
    },
  }

  it('reads videos, coercing a numeric id to a string', () => {
    const r = parseVideoList(page)!
    expect(r.videos).toHaveLength(1)
    expect(r.videos[0].id).toBe('7300000000000000000')
    expect(r.videos[0].duration).toBe(34)
    expect(r.videos[0].createdAt).toBe(new Date(1_700_000_000_000).toISOString())
  })

  it('drops a video with no share url rather than offering a row that cannot import', () => {
    expect(parseVideoList(page)!.videos.every((v) => v.shareUrl)).toBe(true)
  })

  it('carries the paging cursor', () => {
    const r = parseVideoList(page)!
    expect(r.hasMore).toBe(true)
    expect(r.cursor).toBe(1_700_000_000_000)
  })

  // Null, not an empty page: "we could not read your videos" and "you have no
  // videos" need different words on screen.
  it('is null on an error envelope, not an empty list', () => {
    expect(parseVideoList({ error: { code: 'scope_not_authorized' } })).toBeNull()
    expect(parseVideoList(null)).toBeNull()
  })

  it('is an empty page when the account genuinely has no videos', () => {
    const r = parseVideoList({ error: { code: 'ok' }, data: { videos: [], has_more: false } })!
    expect(r.videos).toEqual([])
    expect(r.hasMore).toBe(false)
  })
})

describe('videoLabel', () => {
  const base = { id: '1', duration: 10, coverImageUrl: '', shareUrl: 's', embedLink: '', createdAt: '' }
  it('prefers the title, falls back to the caption, then to a default', () => {
    expect(videoLabel({ ...base, title: 'T', description: 'D' })).toBe('T')
    expect(videoLabel({ ...base, title: '', description: 'D' })).toBe('D')
    expect(videoLabel({ ...base, title: '', description: '' })).toBe('TikTok clip')
  })
  it('caps the length', () => {
    expect(videoLabel({ ...base, title: 'x'.repeat(200), description: '' }).length).toBe(80)
  })
})

describe('token freshness', () => {
  const NOW = 1_700_000_000_000
  it('leaves headroom for the round trip', () => {
    expect(accessTokenUsable({ accessExpiresAt: NOW + 120_000 }, NOW)).toBe(true)
    expect(accessTokenUsable({ accessExpiresAt: NOW + 30_000 }, NOW)).toBe(false)
    expect(accessTokenUsable(null, NOW)).toBe(false)
  })
  // A refresh token past its year means reconnect — there is no way back.
  it('knows when a reconnect is the only option', () => {
    expect(refreshTokenExpired({ refreshExpiresAt: NOW + 1000 }, NOW)).toBe(false)
    expect(refreshTokenExpired({ refreshExpiresAt: NOW - 1 }, NOW)).toBe(true)
    expect(refreshTokenExpired({}, NOW)).toBe(true)
  })
})
