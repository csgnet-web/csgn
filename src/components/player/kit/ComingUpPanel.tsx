import { ComingUp, type ComingUpEntry } from './ComingUp'
import { useLiveSlot } from '@/contexts/useLiveSlot'
import { formatTimeET, isNetworkSlot, slotIdentity, toMillis } from '@/lib/slots'

/**
 * COMING UP, wired to the real schedule.
 *
 * `ComingUp` is the pure presentation — it takes rows and draws them, so it can
 * be storyboarded and previewed without a database. This is the container that
 * fills it from the live schedule context.
 *
 * The split matters here more than usual: this graphic goes to air, and being
 * able to look at it with made-up rows while designing it is the difference
 * between iterating on the layout in seconds and iterating on it by waiting for
 * a slot to change.
 */
export function ComingUpPanel() {
  const { allSlots, networkBlockEnabled, nowMs } = useLiveSlot()

  const entries: ComingUpEntry[] = allSlots
    .filter((slot) => toMillis(slot.startTime) > nowMs)
    .sort((a, b) => toMillis(a.startTime) - toMillis(b.startTime))
    .slice(0, 5)
    .map((slot) => {
      const identity = slotIdentity(slot, { networkBlockEnabled, openName: 'Open' })
      return {
        time: formatTimeET(slot.startTime),
        name: identity.name,
        network: isNetworkSlot(slot) && networkBlockEnabled,
        open: identity.isOpen,
      }
    })

  // A schedule with nothing ahead of it still has to draw something — the
  // channel is on, and an empty graphic on air is worse than an honest one.
  if (entries.length === 0) {
    return <ComingUp entries={[{ time: 'Next', name: 'Member clips', open: false }]} />
  }

  return <ComingUp entries={entries} />
}

export default ComingUpPanel
