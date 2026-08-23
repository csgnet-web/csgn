import { BROADCAST, Kicker, Rule, Slate, Stat } from './BroadcastKit'

/**
 * NOW ON AIR — the full-screen card that introduces whoever is up.
 *
 * Plays for a few seconds at the top of a segment, then clears to the feed.
 * This is the graphic that turns "a stream started" into "the channel handed
 * over to somebody", and it is the difference a viewer feels without being
 * able to name it.
 *
 * The avatar is the hero and it is huge — 320px, ringed in the accent. A card
 * introducing a PERSON that leads with type is a card that introduces a
 * booking. Where there is no picture the initial fills the same circle at the
 * same size, so the layout never collapses into a different composition.
 */
export function NowOnAir({
  name, handle, avatarUrl, subtitle, viewers, kicker = 'Now on air',
}: {
  name: string
  handle?: string
  avatarUrl?: string
  subtitle?: string
  viewers?: number
  kicker?: string
}) {
  return (
    <Slate>
      <div className="absolute inset-0 flex items-center gap-[90px] px-[140px]">
        {/* The face. */}
        <div className="shrink-0 relative">
          <div
            className="rounded-full overflow-hidden bg-white/[0.06] flex items-center justify-center"
            style={{ width: 320, height: 320, boxShadow: `0 0 0 10px ${BROADCAST.accent}` }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
            ) : (
              <span className="font-display font-black text-white/70" style={{ fontSize: 150 }}>
                {(name || '?').slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* The name. */}
        <div className="min-w-0 flex-1">
          <Kicker className="text-[24px]">{kicker}</Kicker>

          <h1
            className="mt-7 font-display font-black uppercase text-white leading-[0.82] tracking-[-0.035em] break-words"
            style={{ fontSize: name.length > 14 ? 108 : 148 }}
          >
            {name}
          </h1>

          {handle && (
            <p className="mt-5 font-mono font-bold text-white/45" style={{ fontSize: 38 }}>
              @{handle}
            </p>
          )}

          <div className="mt-9 w-[560px]">
            <Rule />
          </div>

          {subtitle && (
            <p className="mt-8 text-white/70 leading-snug line-clamp-2" style={{ fontSize: 32 }}>
              {subtitle}
            </p>
          )}

          {typeof viewers === 'number' && viewers > 0 && (
            <div className="mt-10">
              <Stat
                value={viewers.toLocaleString('en-US')}
                label="Watching"
                tone="live"
                className="[&>p:first-child]:text-[80px]"
              />
            </div>
          )}
        </div>
      </div>
    </Slate>
  )
}

export default NowOnAir
