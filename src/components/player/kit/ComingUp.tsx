import { Kicker, Rule, Slate } from './BroadcastKit'

/**
 * COMING UP — the schedule as a broadcast graphic.
 *
 * Every channel that has ever worked runs this card, and for a reason worth
 * being precise about: it is the only graphic that gives a viewer a reason to
 * STAY. "Something is on now" holds somebody for as long as they like it;
 * "something you want is on in forty minutes" holds them past the thing they
 * do not.
 *
 * Set as an editorial table rather than a list of cards. Time on the left in
 * mono, name on the right in display weight, a hairline between rows — the
 * layout a printed TV listing has used for seventy years, because it is the
 * fastest thing in the world to scan.
 */

export interface ComingUpEntry {
  /** Pre-formatted ET time, e.g. "9:00 PM". */
  time: string
  name: string
  /** Marks the network's own programming block. */
  network?: boolean
  /** Nothing booked — the honest label, and a recruiting line. */
  open?: boolean
}

export function ComingUp({ entries }: { entries: ComingUpEntry[] }) {
  return (
    <Slate>
      <div className="absolute inset-0 flex flex-col justify-center px-[140px]">
        <Kicker className="text-[24px]">Coming up</Kicker>

        <div className="mt-10">
          <Rule />
        </div>

        <div className="mt-2">
          {entries.slice(0, 5).map((entry, i) => (
            <div key={`${entry.time}-${i}`}>
              <div className="flex items-baseline gap-16 py-7">
                <span
                  className="font-mono font-bold text-white/45 tabular-nums shrink-0 text-right"
                  style={{ fontSize: 46, width: 260 }}
                >
                  {entry.time}
                </span>
                <span
                  className={`font-display font-black uppercase leading-[0.9] tracking-[-0.02em] truncate ${
                    entry.open ? 'text-white/30' : entry.network ? 'text-[#ffb020]' : 'text-white'
                  }`}
                  style={{ fontSize: 62 }}
                >
                  {entry.name}
                </span>
              </div>
              {i < Math.min(entries.length, 5) - 1 && <Rule weight="hair" tone="mute" />}
            </div>
          ))}
        </div>

        <div className="mt-4">
          <Rule />
        </div>

        <p className="mt-10 font-black uppercase tracking-[0.3em] text-white/35 text-[17px]">
          All times ET &nbsp;·&nbsp; csgn.fun
        </p>
      </div>
    </Slate>
  )
}

export default ComingUp
