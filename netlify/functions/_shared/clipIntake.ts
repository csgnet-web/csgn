/**
 * PUTTING A CLIP ON A MEMBER'S REEL — one implementation, two front doors.
 *
 * `submitClip` (a pasted link) and `tiktokVideos` (a bulk import from a
 * connected TikTok account) both end here. They were never going to stay in
 * sync as two copies: the per-member cap, the duplicate rule, the ordering, the
 * pending status and the exact-runtime handling are all decisions about what
 * goes on television, and a second copy of those is a second answer.
 *
 * The import path also gets to SKIP the metadata round trip, because TikTok's
 * own API already told us the duration and the cover image. That is the real
 * prize of connecting an account: the duration is measured rather than guessed,
 * for free, on every imported clip.
 */
import { badRequest, conflict } from './errors'
import { getDoc, queryCollection, writeDoc, fieldFilter } from './firebaseAdmin'
import { parseClipUrl, clipKey, clampClipSeconds, type ParsedClip } from './clipEmbed'
import { fetchClipMeta, resolveShortLink } from './clipMeta'

/** Per member. A reel, not a channel — and a bound on the review queue. */
export const MAX_CLIPS_PER_MEMBER = 25
export const MAX_CLIP_TITLE = 80

export interface IntakeRequest {
  uid: string
  /** The link as submitted. Short links are resolved before parsing. */
  url: string
  /** The member's own title, if they gave one. Always wins over the platform's. */
  title?: string
  /**
   * Runtime the SOURCE PLATFORM already told us, in seconds. Supplied by the
   * import path, absent on a paste. When present no oEmbed/Data-API call is
   * made — we already have the one number that call exists to find.
   */
  knownSeconds?: number | null
  /** Cover image the platform already gave us, same reasoning. */
  knownThumbnailUrl?: string
  /** Title the platform already gave us, used only if the member gave none. */
  knownTitle?: string
  /** Author/handle the platform already gave us. */
  knownAuthorName?: string
}

export interface IntakeResult {
  id: string
  platform: string
  sourceUrl: string
  title: string
  thumbnailUrl: string
  sourceSeconds: number | null
  seconds: number
  measured: boolean
  order: number
  status: 'pending'
}

/** Everything about the member the intake needs, read once per batch. */
export interface IntakeMember {
  uid: string
  username: string
  /** Rows already on the reel — used for the cap, the dedupe and the ordering. */
  existing: Array<{ clipKey: string; order: number }>
}

/**
 * Load the member and their current reel. Split out so a bulk import reads it
 * ONCE for twenty clips instead of twenty times, which is the difference
 * between an import costing 3 reads and costing 60.
 */
export async function loadIntakeMember(uid: string): Promise<IntakeMember> {
  const user = await getDoc<{ username?: string; displayName?: string; status?: string }>(`users/${uid}`)
  if (!user || (user.status && user.status !== 'active')) {
    throw badRequest('Active CSGN account required.', 'inactive_account')
  }
  const mine = await queryCollection('clips', [fieldFilter('uid', 'EQUAL', uid)], [], MAX_CLIPS_PER_MEMBER + 1)
  return {
    uid,
    username: String(user.username || user.displayName || ''),
    existing: mine.map((row) => {
      const d = row.data as { clipKey?: string; order?: number }
      return { clipKey: String(d.clipKey || ''), order: Number(d.order) || 0 }
    }),
  }
}

/** Resolve a submitted link to a clip we can embed, or explain why we can't. */
export async function resolveClipUrl(submitted: string): Promise<ParsedClip> {
  // Try the pasted link as-is first — the overwhelmingly common case, and it
  // costs no network call. Only a link the pure parser cannot place gets the
  // redirect round trip, and only if it is a short-link host we recognise.
  let parsed = parseClipUrl(submitted)
  if (!parsed) parsed = parseClipUrl(await resolveShortLink(submitted))
  if (!parsed) {
    throw badRequest(
      'Paste a link to a YouTube, TikTok or Instagram post — the address of the post itself, not a profile or a search page.',
      'unsupported_clip_url',
    )
  }
  return parsed
}

/**
 * Write one clip onto a member's reel.
 *
 * `member` is MUTATED as clips are added (its `existing` list grows), so a
 * caller looping over a batch gets the cap, the dedupe and the ordering right
 * across the whole batch without re-reading anything. That is deliberate and is
 * the only reason this takes a member object rather than a uid.
 *
 * It lands as `pending` and stays there. Nothing airs unreviewed: this is a
 * broadcast, and one bad segment is everybody's problem, so there is no path
 * through here that produces an approved clip.
 */
export async function intakeClip(req: IntakeRequest, member: IntakeMember): Promise<IntakeResult> {
  if (member.existing.length >= MAX_CLIPS_PER_MEMBER) {
    throw conflict(`You can keep up to ${MAX_CLIPS_PER_MEMBER} clips. Remove one to add another.`, 'clip_limit_reached')
  }

  const parsed = await resolveClipUrl(req.url)

  // Same post submitted a second way is the same post. Without this a member
  // can fill their whole allocation with one video and eight different URLs.
  const key = clipKey(parsed)
  if (member.existing.some((c) => c.clipKey === key)) {
    throw conflict('That post is already in your reel.', 'duplicate_clip')
  }

  // Ask the platform what this is ONLY when we were not already told. A paste
  // needs the round trip; an import from a connected account does not.
  const told = req.knownSeconds != null && Number.isFinite(req.knownSeconds)
  const meta = told
    ? {
      title: String(req.knownTitle || '').slice(0, MAX_CLIP_TITLE),
      thumbnailUrl: String(req.knownThumbnailUrl || ''),
      authorName: String(req.knownAuthorName || ''),
      seconds: Number(req.knownSeconds),
    }
    // Best-effort: a slow or unkeyed provider costs us a title and a measured
    // runtime, never the post itself.
    : await fetchClipMeta(parsed)

  const clipId = `${req.uid.slice(0, 8)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  // The real runtime when we could measure it, clamped to what the scheduler
  // will air; the default when we could not. `measured` is stored so /studio can
  // be honest about which of the two a member is looking at.
  const measured = meta.seconds != null
  // The EXACT length when the platform gave us one — no rounding to a preset,
  // no clamping down to some house maximum. Cropping only ever becomes
  // necessary when a member's earned airtime is shorter than their video.
  const sourceSeconds = measured ? clampClipSeconds(meta.seconds) : null
  const seconds = sourceSeconds ?? clampClipSeconds(undefined)
  const order = member.existing.reduce((max, c) => Math.max(max, c.order), 0) + 1
  const title = (String(req.title ?? '').trim() || meta.title).slice(0, MAX_CLIP_TITLE)

  await writeDoc(`clips/${clipId}`, {
    uid: req.uid,
    username: member.username,
    platform: parsed.platform,
    videoId: parsed.videoId,
    clipKey: key,
    sourceUrl: parsed.canonicalUrl,
    embedUrl: parsed.embedUrl,
    // The member's own title wins; the platform's is the fallback, so a clip
    // posted with an empty title still reads as something on the review queue.
    title,
    thumbnailUrl: meta.thumbnailUrl,
    authorName: meta.authorName,
    sourceSeconds,
    trimStartSeconds: 0,
    trimEndSeconds: 0,
    seconds,
    measured,
    order,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  // Keep the in-memory reel honest so a batch behaves like a sequence of
  // single submissions rather than twenty clips all claiming order 1.
  member.existing.push({ clipKey: key, order })

  return {
    id: clipId,
    platform: parsed.platform,
    sourceUrl: parsed.canonicalUrl,
    title,
    thumbnailUrl: meta.thumbnailUrl,
    sourceSeconds,
    seconds,
    measured,
    order,
    status: 'pending',
  }
}
