import Player from '@/pages/Player'

/**
 * /oldplayer — the channel as it ran BEFORE member clips.
 *
 * A one-line escape hatch, and deliberately so. This is the same `Player`
 * component the live channel uses, with the holder-clip source switched off:
 * live blocks work exactly as they do on /player, and the gaps fall back to the
 * admin VOD playlist and then the branded board.
 *
 * ── When to point OBS here ─────────────────────────────────────────────────
 *
 * When a clip is misbehaving on air and you need it off the channel NOW —
 * a platform changed an embed policy, a segment is rendering black, audio is
 * wrong on one clip and you cannot tell which. Switch the browser source to
 * `/oldplayer`, the channel keeps running, and you debug with the pressure off.
 *
 * ── Why it is a flag and not a copy ────────────────────────────────────────
 *
 * A forked file would rot. It would miss every fix made to the real player, and
 * the first time you actually needed it — under pressure, mid-broadcast — you
 * would discover it had been broken for two months by a change nobody thought
 * to mirror. One component, one flag, no drift.
 */
export default function OldPlayer() {
  return <Player clipsEnabled={false} />
}
