/**
 * TIKTOK LOGIN KIT + DISPLAY API.
 *
 * Why TikTok and not Instagram: Meta killed the Basic Display API in December
 * 2024, and every remaining path to somebody's Reels requires them to convert to
 * a Business account and link a Facebook Page — a four-step detour through
 * another company's settings to save one paste. Nobody does that, so the
 * Instagram button would be a dead button on our most important screen. TikTok
 * needs no partnership for these scopes, is free, and hands back the ONE thing
 * the clip pipeline cannot otherwise get: the real duration of the video. Every
 * TikTok pasted by hand currently falls back to a 45-second guess.
 *
 * See docs/spec-social-import.md for the full argument.
 *
 * ── The shape of this module ───────────────────────────────────────────────
 *
 * Parsing is PURE and exported so it can be tested without a network: TikTok's
 * v2 endpoints wrap everything in `{ data: …, error: { code: 'ok' } }` and
 * signal failure with a 200 and an error code, which is exactly the kind of
 * response that silently becomes an empty list if you only check `res.ok`.
 */
import { fetchJson } from './cache'

/** Scopes. `video.list` is the one that matters — it carries the duration. */
export const TIKTOK_SCOPES = 'user.info.basic,video.list'

const OAUTH_BASE = 'https://www.tiktok.com/v2/auth/authorize/'
const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/'
const USERINFO_URL = 'https://open.tiktokapis.com/v2/user/info/'
const VIDEO_LIST_URL = 'https://open.tiktokapis.com/v2/video/list/'

/** Fields to request from video.list. `duration` is the whole point. */
const VIDEO_FIELDS = 'id,title,video_description,duration,cover_image_url,share_url,embed_link,create_time'

export interface TikTokTokens {
  accessToken: string
  refreshToken: string
  /** Epoch ms. TikTok returns lifetimes in seconds. */
  accessExpiresAt: number
  refreshExpiresAt: number
  openId: string
  scope: string
}

export interface TikTokProfile {
  openId: string
  displayName: string
  avatarUrl: string
  username: string
}

export interface TikTokVideo {
  id: string
  title: string
  description: string
  /** Seconds. The reason this integration exists. */
  duration: number
  coverImageUrl: string
  shareUrl: string
  embedLink: string
  createdAt: string
}

export function tiktokConfigured(): boolean {
  return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET && process.env.TIKTOK_REDIRECT_URI)
}

export function tiktokAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY || '',
    scope: TIKTOK_SCOPES,
    response_type: 'code',
    redirect_uri: process.env.TIKTOK_REDIRECT_URI || '',
    state,
  })
  return `${OAUTH_BASE}?${params.toString()}`
}

/* ─── Pure parsing ─── */

/** TikTok's envelope. A failure arrives as HTTP 200 with an error code inside. */
interface Envelope<T> { data?: T; error?: { code?: string; message?: string } }

/** True when TikTok's envelope says the call actually worked. */
export function envelopeOk(body: unknown): boolean {
  const code = (body as Envelope<unknown> | null)?.error?.code
  // Absent is fine (the token endpoint omits it on success); anything other
  // than 'ok' is a failure dressed as a 200.
  return code == null || code === 'ok'
}

interface RawToken {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  refresh_expires_in?: number
  open_id?: string
  scope?: string
  error?: string
}

/** Turn a token response into stored tokens, or null when it is unusable. */
export function parseTokens(body: unknown, nowMs = Date.now()): TikTokTokens | null {
  const raw = body as RawToken | null
  if (!raw || raw.error || !raw.access_token || !raw.refresh_token) return null
  const accessTtl = Number(raw.expires_in) > 0 ? Number(raw.expires_in) : 86_400
  const refreshTtl = Number(raw.refresh_expires_in) > 0 ? Number(raw.refresh_expires_in) : 365 * 86_400
  return {
    accessToken: String(raw.access_token),
    refreshToken: String(raw.refresh_token),
    accessExpiresAt: nowMs + accessTtl * 1000,
    refreshExpiresAt: nowMs + refreshTtl * 1000,
    openId: String(raw.open_id || ''),
    scope: String(raw.scope || ''),
  }
}

interface RawUser {
  user?: { open_id?: string; display_name?: string; avatar_url?: string; username?: string }
}

export function parseProfile(body: unknown): TikTokProfile | null {
  if (!envelopeOk(body)) return null
  const u = (body as Envelope<RawUser> | null)?.data?.user
  if (!u) return null
  const openId = String(u.open_id || '')
  const displayName = String(u.display_name || '')
  if (!openId && !displayName) return null
  return {
    openId,
    displayName,
    avatarUrl: String(u.avatar_url || ''),
    username: String(u.username || ''),
  }
}

interface RawVideoList {
  videos?: Array<{
    id?: string | number
    title?: string
    video_description?: string
    duration?: number
    cover_image_url?: string
    share_url?: string
    embed_link?: string
    create_time?: number
  }>
  cursor?: number
  has_more?: boolean
}

export interface VideoPage { videos: TikTokVideo[]; cursor: number | null; hasMore: boolean }

/**
 * Parse a video.list page.
 *
 * A video with no share URL is DROPPED rather than kept with an empty link: the
 * import turns each of these into a clip by URL, and a row the member can tick
 * that then fails to import is worse than a row that was never offered.
 */
export function parseVideoList(body: unknown): VideoPage | null {
  if (!envelopeOk(body)) return null
  const data = (body as Envelope<RawVideoList> | null)?.data
  if (!data) return null
  const videos: TikTokVideo[] = (data.videos ?? [])
    .map((v) => ({
      id: String(v?.id ?? ''),
      title: String(v?.title || '').trim(),
      description: String(v?.video_description || '').trim(),
      duration: Math.max(0, Math.round(Number(v?.duration) || 0)),
      coverImageUrl: String(v?.cover_image_url || ''),
      shareUrl: String(v?.share_url || ''),
      embedLink: String(v?.embed_link || ''),
      createdAt: Number(v?.create_time) > 0 ? new Date(Number(v!.create_time) * 1000).toISOString() : '',
    }))
    .filter((v) => v.id && v.shareUrl)
  return {
    videos,
    cursor: Number.isFinite(Number(data.cursor)) && Number(data.cursor) > 0 ? Number(data.cursor) : null,
    hasMore: data.has_more === true,
  }
}

/** The best one-line label for a video — its own title, then its caption. */
export function videoLabel(video: TikTokVideo): string {
  return (video.title || video.description || 'TikTok clip').slice(0, 80)
}

/** Is this access token still good, with a minute of headroom for the round trip? */
export function accessTokenUsable(tokens: { accessExpiresAt?: number } | null, nowMs = Date.now()): boolean {
  const exp = Number(tokens?.accessExpiresAt)
  return Number.isFinite(exp) && exp - 60_000 > nowMs
}

/** Has the refresh token itself expired? Then the member must reconnect —
 *  TikTok refresh tokens live 365 days and there is no way back without them. */
export function refreshTokenExpired(tokens: { refreshExpiresAt?: number } | null, nowMs = Date.now()): boolean {
  const exp = Number(tokens?.refreshExpiresAt)
  return !Number.isFinite(exp) || exp <= nowMs
}

/* ─── Network ─── */

async function postForm(url: string, form: Record<string, string>): Promise<unknown> {
  return fetchJson<unknown>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString(),
    timeoutMs: 8_000,
  })
}

/** Exchange an authorization code for tokens. */
export async function exchangeCode(code: string): Promise<TikTokTokens | null> {
  return parseTokens(await postForm(TOKEN_URL, {
    client_key: process.env.TIKTOK_CLIENT_KEY || '',
    client_secret: process.env.TIKTOK_CLIENT_SECRET || '',
    code,
    grant_type: 'authorization_code',
    redirect_uri: process.env.TIKTOK_REDIRECT_URI || '',
  }))
}

/** Trade a refresh token for a fresh access token (and a rotated refresh one). */
export async function refreshTokens(refreshToken: string): Promise<TikTokTokens | null> {
  return parseTokens(await postForm(TOKEN_URL, {
    client_key: process.env.TIKTOK_CLIENT_KEY || '',
    client_secret: process.env.TIKTOK_CLIENT_SECRET || '',
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  }))
}

export async function fetchProfile(accessToken: string): Promise<TikTokProfile | null> {
  const url = `${USERINFO_URL}?fields=open_id,display_name,avatar_url,username`
  return parseProfile(await fetchJson<unknown>(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeoutMs: 8_000,
  }))
}

/** One page of the member's public videos. TikTok caps `max_count` at 20. */
export async function fetchVideoPage(accessToken: string, cursor?: number | null): Promise<VideoPage | null> {
  const body: Record<string, unknown> = { max_count: 20 }
  if (cursor) body.cursor = cursor
  return parseVideoList(await fetchJson<unknown>(`${VIDEO_LIST_URL}?fields=${encodeURIComponent(VIDEO_FIELDS)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeoutMs: 10_000,
  }))
}
