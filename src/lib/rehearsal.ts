/**
 * REHEARSAL — driving the whole channel from the URL bar, with no accounts.
 *
 * ── The problem this solves ────────────────────────────────────────────────
 *
 * Everything the channel puts on air in clip mode comes out of a pipeline that
 * starts with somebody connecting a TikTok account: connect → import → review →
 * approve → the day's shares lock at 2 AM → the scheduler lays a playlist down →
 * /player runs it. That is the right pipeline, and it is completely useless as
 * a way to answer the question an operator actually has on the day they set OBS
 * up, which is: **does the reel look right on television?**
 *
 * The existing `?preview=` flags answer that one frame at a time — each renders
 * a single card and stops. What they cannot show is the thing that goes wrong in
 * practice: the HAND-OVER. Ident into board into clip into ident, a streamer
 * breaking in over the top of it, the MP taking the channel, and the reel
 * picking up where it left off. That sequence is the product, it is the part
 * with the timers in it, and until now the only way to see it was to have real
 * members with real clips and then wait.
 *
 * So: a rehearsal is a scripted run of the real components, on demo content,
 * driven entirely by query parameters. No Firestore, no account, no TikTok, no
 * approval queue. `?rehearse=run` in an OBS browser source and the operator
 * watches every mode change the channel can make, on a loop, in two minutes.
 *
 * ── What this is NOT ───────────────────────────────────────────────────────
 *
 * It is not a test of the INTAKE. Nothing here parses a pasted link, because
 * there is exactly one clip parser in this codebase and it runs on the server
 * (`netlify/functions/_shared/clipEmbed.ts`). A second one here — even a small
 * one, even "just for rehearsal" — would be a second answer to what goes on
 * television, and the rehearsal would start passing for links the real pipeline
 * rejects. To rehearse with YOUR OWN clips, use Master Control → Rehearse the
 * reel, which pushes pasted links through the real parser and the real
 * scheduler on the server, then watch it with `?rehearse=live`.
 *
 * This file is the LOOK and the TIMING. That one is the plumbing.
 */

import type { VodItem } from '@/components/player/VodRotator'

/** The three modes as the channel publishes them — see
 *  `netlify/functions/_shared/channelMode.ts`. Mirrored (not imported) because
 *  /player is composited into OBS and pulls in as little as it can. */
export type RehearsalMode = 'clip' | 'stream' | 'master'

export interface RehearsalLeg {
  mode: RehearsalMode
  seconds: number
}

export interface RehearsalPlan {
  /** A fixed single mode, or a scripted loop through all three. */
  script: RehearsalLeg[]
  /** Twitch channel to tune on a stream leg. */
  channel: string
  /** How long each demo clip runs. Short by default: an operator checking a
   *  hand-over should not have to sit through a whole video to see the next
   *  one arrive. */
  clipSeconds: number
  /** Whether the loop repeats. A single fixed mode does not. */
  loop: boolean
  /**
   * Play the REHEARSAL SCHEDULE instead of the demo footage — the playlist
   * Master Control built from links the operator pasted, at
   * `public/airtimeScheduleRehearsal`.
   *
   * The two rehearsals answer different questions. The demo reel proves the
   * look and the hand-over on content that cannot break; this one proves that
   * the operator's own links parse, embed and run at the length the platform
   * reported. Neither is a substitute for the other, so both exist.
   */
  useRehearsalSchedule: boolean
  /** Verbatim `?rehearse=` value, for the debug overlay. */
  label: string
}

/**
 * The demo reel.
 *
 * Two YouTube videos chosen for one property each: they have been public,
 * embeddable and unlikely to be taken down for the better part of two decades.
 * A rehearsal that fails because somebody deleted the demo clip teaches the
 * operator that the reel is broken, which is the exact opposite of the job.
 *
 * They are also, obviously, not crypto clips. That is deliberate — nobody
 * should be able to mistake a rehearsal frame for real programming, on air or
 * in a screenshot.
 */
export const DEMO_CLIPS: Array<{ videoId: string; title: string }> = [
  { videoId: 'aqz-KE-bpKQ', title: 'Big Buck Bunny — rehearsal footage' },
  { videoId: 'jNQXAC9IVRw', title: 'Me at the zoo — rehearsal footage' },
]

/**
 * Demo members, one per card SHAPE.
 *
 * The reel's credit card is the one piece of broadcast furniture a member
 * chooses for themselves, and the shapes sit in very different parts of the
 * frame — a badge top-right, a ticker across the bottom. An operator framing a
 * scene needs to see all of them, not one of them three times, or they will
 * discover the ticker overlapping their own lower third live on air.
 */
const DEMO_MEMBERS = [
  { username: 'rehearsal_one', look: 'signal', style: 'bar', motion: 'slide' },
  { username: 'rehearsal_two', look: 'money', style: 'badge', motion: 'pop' },
  { username: 'rehearsal_three', look: 'violet', style: 'ticker', motion: 'wipe' },
  { username: 'rehearsal_four', look: 'gold', style: 'stack', motion: 'cut' },
  { username: 'rehearsal_five', look: 'ice', style: 'minimal', motion: 'slide' },
]

/**
 * Embed parameters. Mirrors YOUTUBE_PARAMS in the server's clipEmbed module —
 * the one string in this file that has a counterpart, because a rehearsal that
 * plays under different embed flags than the broadcast is rehearsing something
 * else. Unmuted, like the real thing: OBS allows autoplay with sound and a
 * normal browser tab does not, which is worth finding out here rather than on
 * air.
 */
const YOUTUBE_PARAMS = 'autoplay=1&controls=0&rel=0&playsinline=1&modestbranding=1'

/**
 * Build a demo playlist in the exact shape the published schedule uses, so
 * `VodRotator` cannot tell the difference — which is the point. Every field
 * that travels on a real segment travels on these.
 */
export function demoReelItems(clipSeconds: number, count = DEMO_MEMBERS.length): VodItem[] {
  const n = Math.max(1, Math.min(count, 12))
  return Array.from({ length: n }, (_, i) => {
    const member = DEMO_MEMBERS[i % DEMO_MEMBERS.length]
    const clip = DEMO_CLIPS[i % DEMO_CLIPS.length]
    return {
      url: `https://www.youtube-nocookie.com/embed/${clip.videoId}?${YOUTUBE_PARAMS}`,
      platform: 'youtube',
      title: clip.title,
      seconds: clipSeconds,
      username: member.username,
      look: member.look,
      style: member.style,
      motion: member.motion,
      // No avatar: the card has to be legible for a member who never set one,
      // and that is the case a designed mock never covers.
      avatarUrl: '',
    }
  })
}

/** The scripted loop. Ordered as the channel actually escalates: the reel is
 *  the floor, a streamer breaks in over it, the MP pre-empts them, and the reel
 *  picks up again — which is the sentence the whole product is trying to be. */
function defaultScript(legSeconds: number): RehearsalLeg[] {
  return [
    { mode: 'clip', seconds: legSeconds * 2 },
    { mode: 'stream', seconds: legSeconds },
    { mode: 'master', seconds: legSeconds },
    { mode: 'clip', seconds: legSeconds },
  ]
}

const DEFAULT_LEG_SECONDS = 45
const DEFAULT_CLIP_SECONDS = 20
/** A channel that is always live, so a stream leg has something to tune. Any
 *  public Twitch channel works; this one is ours. */
const DEFAULT_CHANNEL = 'csgnet'

function clampNumber(raw: string | null, fallback: number, min: number, max: number): number {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.min(max, Math.max(min, Math.floor(n))) : fallback
}

/**
 * Read the rehearsal out of a query string, or answer null for a normal load.
 *
 *   ?rehearse=clip      the member reel, on demo content, forever
 *   ?rehearse=stream    a live feed through the real gate (add &channel=name)
 *   ?rehearse=master    the master stage the MP's own encoder hour shows
 *   ?rehearse=run       all three on a loop — clip, stream, master, clip
 *   ?rehearse=live      YOUR links, seeded from Master Control → Rehearse the
 *                       reel, through the real parser and the real scheduler
 *
 *   &leg=45             seconds per leg of the scripted run
 *   &clip=20            seconds per demo clip
 *   &channel=xqc        the channel a stream leg tunes
 *
 * Anything else is not a rehearsal. An unrecognised value returns null rather
 * than guessing, because the failure mode of guessing is a rehearsal frame
 * going out over a real broadcast.
 */
export function parseRehearsal(search: string): RehearsalPlan | null {
  const params = new URLSearchParams(search)
  const raw = (params.get('rehearse') || '').trim().toLowerCase()
  if (!raw) return null

  const legSeconds = clampNumber(params.get('leg'), DEFAULT_LEG_SECONDS, 5, 3600)
  const clipSeconds = clampNumber(params.get('clip'), DEFAULT_CLIP_SECONDS, 5, 600)
  const channel = (params.get('channel') || DEFAULT_CHANNEL).trim().toLowerCase().replace(/[^a-z0-9_]/g, '') || DEFAULT_CHANNEL

  const base = { channel, clipSeconds, useRehearsalSchedule: false }

  if (raw === 'run' || raw === 'all') {
    return { ...base, script: defaultScript(legSeconds), loop: true, label: raw }
  }
  if (raw === 'clip' || raw === 'clips' || raw === 'reel') {
    return { ...base, script: [{ mode: 'clip', seconds: legSeconds }], loop: false, label: raw }
  }
  if (raw === 'stream') {
    return { ...base, script: [{ mode: 'stream', seconds: legSeconds }], loop: false, label: raw }
  }
  if (raw === 'master') {
    return { ...base, script: [{ mode: 'master', seconds: legSeconds }], loop: false, label: raw }
  }
  // The operator's OWN links, seeded through Master Control → Rehearse the reel.
  if (raw === 'live' || raw === 'mine') {
    return { ...base, script: [{ mode: 'clip', seconds: legSeconds }], loop: false, label: raw, useRehearsalSchedule: true }
  }
  return null
}

export interface LegPosition {
  mode: RehearsalMode
  /** Index into the script — the identity of THIS leg, so a caller can tell a
   *  second clip leg from the first one and re-arm its timers. */
  index: number
  /** Milliseconds until the next leg begins; Infinity when nothing follows. */
  remainingMs: number
}

/**
 * Where a run is at, `elapsedMs` after it started.
 *
 * Pure, and total: a plan with one non-looping leg simply stays on that leg
 * forever, which is what `?rehearse=clip` should do. Returning a remaining time
 * (rather than expecting the caller to keep its own clock) is what lets /player
 * schedule ONE timer per leg instead of polling.
 */
export function legAt(plan: RehearsalPlan, elapsedMs: number): LegPosition {
  const total = plan.script.reduce((sum, leg) => sum + leg.seconds, 0) * 1000
  if (plan.script.length === 0 || total <= 0) return { mode: 'clip', index: 0, remainingMs: Infinity }

  if (!plan.loop) {
    // Walk the legs once and then hold the last one. A fixed single-mode
    // rehearsal is the common case and lands here on the first iteration.
    let cursor = 0
    for (let i = 0; i < plan.script.length; i++) {
      const legMs = plan.script[i].seconds * 1000
      if (elapsedMs < cursor + legMs || i === plan.script.length - 1) {
        return {
          mode: plan.script[i].mode,
          index: i,
          remainingMs: i === plan.script.length - 1 ? Infinity : cursor + legMs - elapsedMs,
        }
      }
      cursor += legMs
    }
  }

  let offset = ((elapsedMs % total) + total) % total
  for (let i = 0; i < plan.script.length; i++) {
    const legMs = plan.script[i].seconds * 1000
    if (offset < legMs) return { mode: plan.script[i].mode, index: i, remainingMs: legMs - offset }
    offset -= legMs
  }
  // Unreachable while total > 0; answering the first leg beats throwing on air.
  return { mode: plan.script[0].mode, index: 0, remainingMs: plan.script[0].seconds * 1000 }
}
