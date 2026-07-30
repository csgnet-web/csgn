/**
 * "Live now" and "Up next" for the broadcast ticker, derived from the actual
 * schedule instead of being typed in by hand every two hours.
 *
 * The poller writes these into config/ticker once a minute — but only while
 * config/ticker.onAirAuto is not false. Saving either card from the admin panel
 * flips onAirAuto off, so a manual override sticks until the operator turns
 * auto-fill back on. Pure functions here so the naming rules are unit-tested.
 */

export interface OnAirSlot {
  assignedName?: string | null
  assignedUid?: string | null
  streamTitle?: string | null
  label?: string | null
  startTime?: string | null
  type?: string | null
}

export interface NowLiveCard { name: string; title: string }
export interface UpNextCard { name: string; startET: string }

/** Unclaimed hours still have an identity on air — never a blank card. */
const NETWORK_NAME = 'CSGN Originals'
const OPEN_NAME = 'Open Stage'

/** 'ceo' is the legacy id for the same 7 PM–3 AM network block. */
const isNetwork = (slot: OnAirSlot): boolean => slot.type === 'network' || slot.type === 'ceo'

/** Who the hour belongs to: the claimant, the network, or nobody yet. */
export function slotDisplayName(slot: OnAirSlot): string {
  const claimed = String(slot.assignedName || '').trim()
  if (claimed) return claimed
  return isNetwork(slot) ? NETWORK_NAME : OPEN_NAME
}

/** What the hour is called: the streamer's own title, else the block's name. */
export function slotDisplayTitle(slot: OnAirSlot): string {
  const title = String(slot.streamTitle || '').trim()
  if (title) return title
  if (slot.assignedName) return String(slot.label || '').trim()
  return isNetwork(slot) ? 'CSGN Originals block' : 'This hour is open — claim it at csgn.fun/schedule'
}

/** Wall-clock ET, e.g. '10:00 PM ET' — the format the ticker card expects. */
export function formatETTime(startTime: string | Date | null | undefined): string {
  if (!startTime) return ''
  const d = startTime instanceof Date ? startTime : new Date(startTime)
  if (Number.isNaN(d.getTime())) return ''
  const t = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(d)
  return `${t} ET`
}

export function deriveNowLive(slot: OnAirSlot | null | undefined): NowLiveCard | null {
  if (!slot) return null
  return { name: slotDisplayName(slot), title: slotDisplayTitle(slot) }
}

export function deriveUpNext(slot: OnAirSlot | null | undefined): UpNextCard | null {
  if (!slot) return null
  return { name: slotDisplayName(slot), startET: formatETTime(slot.startTime) }
}
