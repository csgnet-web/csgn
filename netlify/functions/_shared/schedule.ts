/**
 * Canonical CSGN schedule template — pure server-side mirror of the template
 * logic in src/lib/slots.ts (which is bound to the client Firebase SDK and so
 * can't be imported here). Keep the two templates in sync.
 *
 * Schedule (ET, DST-aware):
 *   Slots 1-8:  3:00 AM – 7:00 PM  (auction, 8 × 2h)
 *   Slots 9-12: 7:00 PM – 3:00 AM  (open slot — DB type 'ceo', 4 × 2h)
 */

export type SlotType = 'auction' | 'ceo'

interface TemplateSlot {
  hourET: number
  dayOffset?: number
  duration: number
  type: SlotType
}

const SCHEDULE_TEMPLATE: TemplateSlot[] = [
  { hourET: 3, duration: 2, type: 'auction' },
  { hourET: 5, duration: 2, type: 'auction' },
  { hourET: 7, duration: 2, type: 'auction' },
  { hourET: 9, duration: 2, type: 'auction' },
  { hourET: 11, duration: 2, type: 'auction' },
  { hourET: 13, duration: 2, type: 'auction' },
  { hourET: 15, duration: 2, type: 'auction' },
  { hourET: 17, duration: 2, type: 'auction' },
  { hourET: 19, duration: 2, type: 'ceo' },
  { hourET: 21, duration: 2, type: 'ceo' },
  { hourET: 23, duration: 2, type: 'ceo' },
  { hourET: 1, dayOffset: 1, duration: 2, type: 'ceo' },
]

/** Convert an ET wall-clock hour on a calendar date to UTC, DST-aware. */
function etToUTC(year: number, month: number, day: number, hourET: number): Date {
  let candidate = new Date(Date.UTC(year, month - 1, day, hourET + 5, 0, 0))
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(candidate)
  const nyHour = parseInt(parts.find((p) => p.type === 'hour')!.value, 10)
  if (nyHour !== hourET) {
    candidate = new Date(candidate.getTime() + (hourET - nyHour) * 60 * 60 * 1000)
  }
  return candidate
}

export function utcToETComponents(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0'
  return { year: parseInt(get('year'), 10), month: parseInt(get('month'), 10), day: parseInt(get('day'), 10) }
}

function formatTimeLabel(hour: number): string {
  const h = hour % 24
  const ampm = h >= 12 ? 'PM' : 'AM'
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${display}:00 ${ampm}`
}

export interface ExpectedSlot {
  id: string
  type: SlotType
  label: string
  startTime: string
  endTime: string
}

/** The canonical 12 slots for the ET calendar day containing `targetDate`. */
export function buildExpectedSlotsForDate(targetDate: Date): ExpectedSlot[] {
  const { year, month, day } = utcToETComponents(targetDate)
  const etMiddayUTC = etToUTC(year, month, day, 12)

  return SCHEDULE_TEMPLATE.map((template) => {
    const slotDay = new Date(etMiddayUTC.getTime() + (template.dayOffset ?? 0) * 24 * 60 * 60 * 1000)
    const slotDate = utcToETComponents(slotDay)
    const startUTC = etToUTC(slotDate.year, slotDate.month, slotDate.day, template.hourET)
    const endUTC = new Date(startUTC.getTime() + template.duration * 60 * 60 * 1000)

    return {
      id: `slot-${String(slotDate.year).padStart(4, '0')}-${String(slotDate.month).padStart(2, '0')}-${String(slotDate.day).padStart(2, '0')}-${String(template.hourET).padStart(2, '0')}`,
      // Operator directive: the auto-seeder creates every slot as CEO Creator
      // for now. Revert to `template.type` to reopen the auction block.
      type: 'ceo',
      label: `${formatTimeLabel(template.hourET)} – ${formatTimeLabel(template.hourET + template.duration)}`,
      startTime: startUTC.toISOString(),
      endTime: endUTC.toISOString(),
    }
  })
}

/** Fresh open slot document for one expected template entry. */
export function buildSlotDoc(exp: ExpectedSlot, defaultStreamUrl: string): Record<string, unknown> {
  return {
    id: exp.id,
    type: exp.type,
    label: exp.label,
    startTime: exp.startTime,
    endTime: exp.endTime,
    status: 'open',
    streamUrl: defaultStreamUrl,
    streamTitle: '',
    assignedUid: null,
    assignedName: null,
    bids: [],
    lotteryEntrants: [],
    requests: [],
    createdAt: new Date().toISOString(),
  }
}
