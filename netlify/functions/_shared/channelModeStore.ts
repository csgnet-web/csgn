/**
 * Persistence for the public channel-mode verdict.
 *
 * Split from `channelMode.ts` so the rules that decide what a viewer is told
 * stay a pure module with no Firestore import — and so both writers (the
 * per-minute poller and the operator's own button) go through ONE function.
 * Two writers with two copies of this logic is how the public log ends up
 * disagreeing with the badge above it.
 */
import { getDoc, writeDoc } from './firebaseAdmin'
import { appendModeEvent, describeChannelMode, type ModeEvent, type ModeInput, type ModeVerdict } from './channelMode'

export const CHANNEL_MODE_PATH = 'public/channelMode'

export interface StoredChannelMode extends ModeVerdict {
  log: ModeEvent[]
  liveCount: number
  updatedAt: string
}

/**
 * Compute the verdict, append it to the public switch log if it changed, and
 * publish. Returns what was stored.
 *
 * Best-effort by design: the caller is either a background poller (which must
 * not fail a run over a status doc) or an operator action that has already
 * succeeded (putting somebody on air must not roll back because the sign
 * describing it could not be updated). Both wrap it in a try.
 */
export async function publishChannelMode(input: ModeInput, nowIso = new Date().toISOString()): Promise<StoredChannelMode> {
  const verdict = describeChannelMode(input)
  const stored = await getDoc<{ log?: ModeEvent[] }>(CHANNEL_MODE_PATH)
  const log = appendModeEvent(stored?.log ?? [], verdict, nowIso)
  const doc: StoredChannelMode = {
    ...verdict,
    log,
    liveCount: Math.max(0, Number(input.liveCount) || 0),
    updatedAt: nowIso,
  }
  await writeDoc(CHANNEL_MODE_PATH, { ...doc })
  return doc
}
