/**
 * FeedGate — decides when the Twitch embed on /player is genuinely showing
 * broadcast content and when it is safe to touch the player at all.
 *
 * Why this exists: Twitch stitches preroll ads server-side into the live HLS
 * session. The embed's READY/PLAYING events fire while the *ad* is playing,
 * and poking the player during that window — setQuality() on an empty quality
 * list, play()/setMuted(false) storms — wedges playback: the player UI keeps
 * reporting "playing" (pause button showing) while the picture is frozen on
 * the first ad frame. Because the old page treated PLAYING as "content is up",
 * it also lifted the branded cover mid-ad (exposing Twitch's ad countdown) and
 * its watchdog, satisfied by the PLAYING flag, never rebuilt the wedged embed.
 *
 * The gate replaces event-trust with observed truth: /player samples
 * `getCurrentTime()` once a second and feeds it here. Frames advancing is the
 * only thing that counts as playback. On top of that signal the gate runs:
 *
 *   MASK      a fixed window from the first observed frames during which the
 *             branded cover must stay up and the player must not be touched —
 *             long enough that Twitch's preroll break (≤30s) is over. There is
 *             no public embed API that distinguishes stitched ad frames from
 *             content frames, so a deterministic window is the only reliable
 *             way to keep ad video/text off the encode.
 *   PIN       one setQuality() to the source rendition, issued only after the
 *             mask AND only from a populated quality list (never blind), then
 *             a short stability wait so the switch rebuffer stays covered.
 *   CONFIRM   frames flowing, mask done, pin settled → unmute + reveal.
 *   NUDGE     frames stop on a previously-flowing feed → one gentle play()
 *             once the cover is back up (never during quiet bootstrap).
 *   REBUILD   no frames for 20s while the network state says LIVE → the embed
 *             is wedged (the frozen-preroll failure) → tear down and rebuild.
 *   REMASK    a stall long enough to imply Twitch restarted the playback
 *             session (which can bring a fresh preroll) starts a new mask.
 *
 * Pure and clock-free (callers pass nowMs) so every scenario is unit-testable.
 */

/** Cadence at which /player samples the embed and calls FeedGate.sample. */
export const PROGRESS_TICK_MS = 1_000
/** getCurrentTime must advance by at least this much (s) to count as frames. */
export const PROGRESS_EPSILON_S = 0.15
/** Cover-hold window from first frames: Twitch preroll breaks cap at 30s;
 *  +3s of stitch/latency slop. Everything inside this window is treated as
 *  potentially ad video and stays behind the branded cover, muted. */
export const PREROLL_MASK_MS = 33_000
/** After the mask, wait at most this long for the quality list to populate
 *  before giving up on pinning (auto quality is better than a blind poke). */
export const PIN_WAIT_MS = 5_000
/** After issuing the quality pin, require this much continued playback before
 *  confirming, so the rendition-switch rebuffer never reaches the encode. */
export const POST_PIN_STABLE_MS = 2_000
/** Progress must have been continuous for this long before (re)confirming —
 *  keeps a stuttering feed from strobing the cover on/off. */
export const CONFIRM_STABLE_MS = 2_000
/** A confirmed feed whose frames stop for this long is no longer confirmed —
 *  the cover comes back before a frozen frame reads as an outage on-stream. */
export const CONFIRM_LOSS_STALL_MS = 6_000
/** A stall this long means Twitch will restart the playback session on
 *  recovery (possibly with a fresh preroll) — so recovery starts a new mask. */
export const REMASK_STALL_MS = 12_000
/** No frames for this long while the state machine says LIVE ⇒ the embed is
 *  wedged — signal a rebuild (re-signalled at the same cadence if ignored). */
export const STALL_REBUILD_MS = 20_000

export type GatePhase =
  /** No frames observed yet this session (embed booting or channel offline). */
  | 'boot'
  /** Frames flowing but still inside the preroll mask window. */
  | 'ad-mask'
  /** Mask done; pinning quality / waiting for post-pin stability. */
  | 'settling'
  /** Content confirmed — safe to unmute and reveal. */
  | 'on-air'
  /** Frames stopped after having flowed. */
  | 'stalled'

export interface GateSample {
  nowMs: number
  /** player.getCurrentTime() in seconds, or null when unavailable. */
  currentTimeS: number | null
  /** player.getQualities().length (0 while Twitch hasn't populated it). */
  qualityCount: number
  /** Master-control mode is LIVE (server signal or embed events). */
  live: boolean
}

export interface GateDecision {
  /** Content is flowing and settled — unmute + reveal (sticky until lost). */
  confirmed: boolean
  /** One-shot: pin source quality NOW (list populated, mask done, flowing). */
  pinQuality: boolean
  /** One-shot per stall: feed stopped after flowing — try a gentle play(). */
  nudge: boolean
  /** Wedged while LIVE — tear the embed down and rebuild it. */
  rebuild: boolean
  phase: GatePhase
  /** ms of preroll mask left for the current session (0 once done/no session). */
  maskRemainingMs: number
  /** ms since frames last advanced (since creation if they never have). */
  sinceProgressMs: number
}

export interface FeedGate {
  sample: (s: GateSample) => GateDecision
  /** The embed fired PLAYING — only used as a fallback truth source when
   *  getCurrentTime is unavailable, so old embeds degrade to event trust. */
  notePlaying: () => void
}

export function createFeedGate(
  createdAtMs: number,
  opts?: {
    /** Override the preroll-ad cover window. Defaults to PREROLL_MASK_MS (33s,
     *  sized to outlast Twitch's ad break). /player passes a much smaller value
     *  in no-ads / Turbo mode, where there is no stitched preroll to outlast —
     *  the mask then only needs to hide the play-button poster and buffering. */
    prerollMaskMs?: number
  },
): FeedGate {
  const prerollMaskMs = opts?.prerollMaskMs ?? PREROLL_MASK_MS
  let lastTimeS: number | null = null
  let lastProgressAtMs: number | null = null
  let runStartMs: number | null = null // start of the current uninterrupted progress run
  let sessionStartMs: number | null = null // first frames of the current playback session
  let pinDone = false
  let pinIssuedAtMs: number | null = null
  let confirmedState = false
  let lastRebuildSignalMs = 0
  let nudged = false
  let playingSeen = false

  const notePlaying = () => { playingSeen = true }

  const sample = (s: GateSample): GateDecision => {
    const { nowMs } = s

    // ── Did frames advance since the last sample? ──
    let advanced = false
    if (typeof s.currentTimeS === 'number' && Number.isFinite(s.currentTimeS)) {
      if (lastTimeS !== null && s.currentTimeS > lastTimeS + PROGRESS_EPSILON_S) advanced = true
      // A backwards jump is a seek/reset (ad→content handoff, live-edge catchup
      // after reconnect) — the pipeline is active, not frozen.
      if (lastTimeS !== null && s.currentTimeS < lastTimeS - 1) advanced = true
      lastTimeS = s.currentTimeS
    } else {
      // getCurrentTime unavailable (very old embed build): degrade to trusting
      // the PLAYING event. No freeze detection, but no worse than event-only.
      advanced = playingSeen
    }

    if (advanced) {
      const stalledForMs = lastProgressAtMs === null ? 0 : nowMs - lastProgressAtMs
      if (sessionStartMs === null || stalledForMs >= REMASK_STALL_MS) {
        // Cold start, or a stall long enough that Twitch restarts the playback
        // session (fresh preroll possible): new session ⇒ new mask + re-pin.
        sessionStartMs = nowMs
        pinDone = false
        pinIssuedAtMs = null
      }
      if (runStartMs === null) runStartMs = nowMs
      lastProgressAtMs = nowMs
      nudged = false
    } else {
      runStartMs = null
    }

    const sinceProgressMs = nowMs - (lastProgressAtMs ?? createdAtMs)
    const flowing = lastProgressAtMs !== null && sinceProgressMs < CONFIRM_LOSS_STALL_MS
    const maskElapsedMs = sessionStartMs === null ? 0 : nowMs - sessionStartMs
    const maskDone = sessionStartMs !== null && maskElapsedMs >= prerollMaskMs

    // ── Quality pin: once per session, only post-mask, only from a real list ──
    let pinQuality = false
    if (maskDone && flowing && !pinDone) {
      if (s.qualityCount > 0) {
        pinQuality = true
        pinDone = true
        pinIssuedAtMs = nowMs
      } else if (maskElapsedMs >= prerollMaskMs + PIN_WAIT_MS) {
        pinDone = true // list never populated — stay on auto rather than poke blind
      }
    }
    const pinSettled = pinDone && (pinIssuedAtMs === null || nowMs - pinIssuedAtMs >= POST_PIN_STABLE_MS)

    // Asymmetric hysteresis: ENTERING confirmed needs a continuous progress
    // run (a lone advancing blip right after a stall must not lift the cover),
    // but an ESTABLISHED confirm survives short rebuffers — it only drops once
    // frames have been absent for CONFIRM_LOSS_STALL_MS, so a healthy feed
    // with a 1–2s hiccup never strobes the cover on-stream.
    const stable = runStartMs !== null && nowMs - runStartMs >= CONFIRM_STABLE_MS
    confirmedState = confirmedState
      ? flowing && maskDone && pinDone
      : flowing && maskDone && pinDone && pinSettled && stable
    const confirmed = confirmedState

    // ── Recovery escalation: one gentle nudge, then rebuild while LIVE ──
    let nudge = false
    if (!flowing && lastProgressAtMs !== null && !nudged && sinceProgressMs >= CONFIRM_LOSS_STALL_MS) {
      nudge = true
      nudged = true
    }
    let rebuild = false
    if (s.live && sinceProgressMs >= STALL_REBUILD_MS && nowMs - lastRebuildSignalMs >= STALL_REBUILD_MS) {
      rebuild = true
      lastRebuildSignalMs = nowMs
    }

    const phase: GatePhase = confirmed
      ? 'on-air'
      : lastProgressAtMs === null
        ? 'boot'
        : !flowing
          ? 'stalled'
          : !maskDone
            ? 'ad-mask'
            : 'settling'

    return {
      confirmed,
      pinQuality,
      nudge,
      rebuild,
      phase,
      maskRemainingMs: sessionStartMs === null ? prerollMaskMs : Math.max(0, prerollMaskMs - maskElapsedMs),
      sinceProgressMs,
    }
  }

  return { sample, notePlaying }
}
