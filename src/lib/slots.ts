import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot, serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/config/firebase'

/* ─── Constants ─── */

export const DEFAULT_STREAM_URL = 'https://twitch.tv/shrood'

/** CSGN token mint address (pump.fun) */
export const CSGN_MINT = 'GFV7fphvprMr1PYpYGPJort2QP7JJLEp3J1Buu7Zpump'

/** CSGN treasury wallet that receives bids */
export const CSGN_TREASURY = 'CSGNUgUpBqTNM7EBZSMeA5jzPLFNR2hELhLjbHLpbEY4'

/** CSGN token decimals (pump.fun standard) */
export const CSGN_DECIMALS = 6

/* ─── Types ─── */

export type SlotType = 'auction' | 'ceo'

export type SlotStatus =
  | 'open'            // accepting bids
  | 'closing'         // within 2h of airtime — bidding closed, winner notified
  | 'pending_deposit' // auction winner must confirm within 1h
  | 'confirmed'       // confirmed or CEO-assigned
  | 'live'            // currently airing
  | 'completed'       // finished airing
  | 'unfilled'        // nobody won / deposited

export type FeePaymentStatus = 'pending' | 'paid' | 'declined'

export interface CreatorFees {
  tradingVolumeSOL: number     // admin inputs trading volume in SOL during slot
  feeOwedSOL: number           // 0.003 * tradingVolumeSOL (30% of 1% pump.fun creator fee)
  activeChannels?: Array<{
    name: string
    streamUrl: string
    durationMinutes: number
  }>
  paymentStatus: FeePaymentStatus
  streamerWalletAddress: string
  paidAt?: string
  declineReason?: string
  updatedAt: string
}

export interface SlotRequest {
  id: string
  uid: string
  displayName: string
  message: string
  createdAt: string
  status: 'pending' | 'accepted' | 'declined'
  responseNote?: string
}

export interface SlotBid {
  uid: string
  displayName: string
  amount: number          // CSGN token amount (whole tokens, e.g. 100000 CSGN)
  walletAddress?: string  // bidder's Solana wallet address
  txSignature?: string    // on-chain tx signature
  createdAt: string
}

export interface Slot {
  id: string
  type: SlotType
  label: string
  startTime: string           // ISO UTC
  endTime: string             // ISO UTC
  status: SlotStatus
  streamUrl: string           // defaults to twitch.tv/shrood
  streamTitle: string         // display title for the stream
  assignedUid: string | null
  assignedName: string | null
  description: string
  bids: SlotBid[]             // auction only
  lotteryEntrants: string[]   // legacy field, kept for DB compat
  requests: SlotRequest[]     // slot request queue
  creatorFees?: CreatorFees   // populated after slot completes
  createdAt: unknown
}

/* ─── CSGN Quadratic bid pricing ─── */

const BASE_BID_CSGN = 100_000   // 100,000 CSGN base bid

/**
 * Quadratic pricing: y = 100000 + 10000 * x^2
 * where x = number of existing bids
 * Returns whole CSGN tokens.
 */
export function getMinimumBid(existingBidCount: number): number {
  return Math.round(BASE_BID_CSGN + 10_000 * Math.pow(existingBidCount, 2))
}

/** Format a CSGN amount for display (e.g. 100000 → "100,000 CSGN") */
export function formatCSGN(amount: number): string {
  return amount.toLocaleString() + ' CSGN'
}

/* ─── Schedule template ─── */

interface TemplateSlot {
  hourET: number    // hour in Eastern Time (0-23)
  dayOffset?: number // day offset relative to schedule anchor date
  duration: number  // hours
  type: SlotType
}

/**
 * Schedule (ET, DST-aware):
 *  Slots 1-8:  3:00 AM – 7:00 PM (auction, 8 slots)
 *  Slots 9-12: 7:00 PM – 3:00 AM next day (CEO, 4 slots)
 */
const SCHEDULE_TEMPLATE: TemplateSlot[] = [
  // Auction block: 3 AM – 7 PM
  { hourET: 3,  duration: 2, type: 'auction' },
  { hourET: 5,  duration: 2, type: 'auction' },
  { hourET: 7,  duration: 2, type: 'auction' },
  { hourET: 9,  duration: 2, type: 'auction' },
  { hourET: 11, duration: 2, type: 'auction' },
  { hourET: 13, duration: 2, type: 'auction' },
  { hourET: 15, duration: 2, type: 'auction' },
  { hourET: 17, duration: 2, type: 'auction' },
  // CEO Schedule block: 7 PM – 3 AM next day
  { hourET: 19, duration: 2, type: 'ceo' },
  { hourET: 21, duration: 2, type: 'ceo' },
  { hourET: 23, duration: 2, type: 'ceo' },
  { hourET: 1,  dayOffset: 1, duration: 2, type: 'ceo' },
]

/* ─── Timezone helpers ─── */

/**
 * Convert a wall-clock hour in Eastern Time on a given calendar date to UTC.
 * Correctly handles DST (US Eastern: UTC-5 in winter, UTC-4 in summer).
 *
 * @param year  4-digit year
 * @param month 1-indexed month
 * @param day   day of month
 * @param hourET  0-23 local Eastern hour
 */
function etToUTC(year: number, month: number, day: number, hourET: number): Date {
  // Estimate: try UTC-5 (EST) first
  let candidate = new Date(Date.UTC(year, month - 1, day, hourET + 5, 0, 0))

  // Check what hour this actually maps to in America/New_York
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(candidate)
  const nyHour = parseInt(parts.find((p) => p.type === 'hour')!.value, 10)

  // If off by an hour (DST), correct
  if (nyHour !== hourET) {
    candidate = new Date(candidate.getTime() + (hourET - nyHour) * 60 * 60 * 1000)
  }

  return candidate
}

/**
 * Get the Eastern Time date components for a given UTC Date.
 * Returns { year, month (1-indexed), day, hour (0-23) }.
 */
function utcToETComponents(date: Date): { year: number; month: number; day: number; hour: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0'
  return {
    year: parseInt(get('year'), 10),
    month: parseInt(get('month'), 10),
    day: parseInt(get('day'), 10),
    hour: parseInt(get('hour'), 10) % 24, // handle '24' → 0
  }
}

function formatTimeLabel(hour: number): string {
  const h = hour % 24
  const ampm = h >= 12 ? 'PM' : 'AM'
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${display}:00 ${ampm}`
}

/**
 * Format a slot's start–end as a DST-aware Eastern Time range.
 * e.g. "9:00 PM – 11:00 PM ET"
 */
export function formatESTRange(slot: Pick<Slot, 'startTime' | 'endTime'>): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  return `${fmt(slot.startTime)} – ${fmt(slot.endTime)} ET`
}

/* ─── Firestore operations ─── */

const SLOTS_COLLECTION = 'slots'
export const SLOTS_PER_DAY = 12



interface ExpectedSlotDef {
  id: string
  type: SlotType
  label: string
  startTime: string
  endTime: string
}

function buildExpectedSlotsForDate(targetDate: Date): ExpectedSlotDef[] {
  const { year, month, day } = utcToETComponents(targetDate)
  const etMiddayUTC = etToUTC(year, month, day, 12)

  return SCHEDULE_TEMPLATE.map((template) => {
    const slotDay = new Date(etMiddayUTC.getTime() + (template.dayOffset ?? 0) * 24 * 60 * 60 * 1000)
    const slotDate = utcToETComponents(slotDay)
    const startUTC = etToUTC(slotDate.year, slotDate.month, slotDate.day, template.hourET)
    const endUTC = new Date(startUTC.getTime() + template.duration * 60 * 60 * 1000)

    return {
      id: `slot-${String(slotDate.year).padStart(4, '0')}-${String(slotDate.month).padStart(2, '0')}-${String(slotDate.day).padStart(2, '0')}-${String(template.hourET).padStart(2, '0')}`,
      type: template.type,
      label: `${formatTimeLabel(template.hourET)} – ${formatTimeLabel(template.hourET + template.duration)}`,
      startTime: startUTC.toISOString(),
      endTime: endUTC.toISOString(),
    }
  })
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const aS = new Date(aStart).getTime()
  const aE = new Date(aEnd).getTime()
  const bS = new Date(bStart).getTime()
  const bE = new Date(bEnd).getTime()
  return aS < bE && bS < aE
}

export interface SyncScheduleResult {
  dateET: string
  created: number
  updated: number
  removed: number
  conflicts: string[]
}

/**
 * Sync one ET schedule day so it always contains the canonical 12 slots
 * (3 AM–7 PM auction, 7 PM–3 AM CEO) with no duplicate/overlapping stray slots.
 */
export async function syncSlotsForDate(targetDate: Date): Promise<SyncScheduleResult> {
  const expected = buildExpectedSlotsForDate(targetDate)
  const expectedById = new Map(expected.map((s) => [s.id, s]))

  const minStart = Math.min(...expected.map((s) => new Date(s.startTime).getTime()))
  const maxEnd = Math.max(...expected.map((s) => new Date(s.endTime).getTime()))
  const existing = await fetchSlots(new Date(minStart - 60 * 60 * 1000), new Date(maxEnd + 60 * 60 * 1000))

  const existingById = new Map(existing.map((slot) => [slot.id, slot]))
  let created = 0
  let updated = 0
  let removed = 0
  const conflicts: string[] = []

  for (const exp of expected) {
    const current = existingById.get(exp.id)
    if (!current) {
      const slot: Slot = {
        id: exp.id,
        type: exp.type,
        label: exp.label,
        startTime: exp.startTime,
        endTime: exp.endTime,
        status: 'open',
        streamUrl: DEFAULT_STREAM_URL,
        streamTitle: '',
        assignedUid: null,
        assignedName: null,
        description: '',
        bids: [],
        lotteryEntrants: [],
        requests: [],
        createdAt: serverTimestamp(),
      }
      await setDoc(doc(db, SLOTS_COLLECTION, exp.id), slot)
      created += 1
      continue
    }

    const patch: Partial<Slot> = {}
    if (current.type !== exp.type) patch.type = exp.type
    if (current.label !== exp.label) patch.label = exp.label
    if (current.startTime !== exp.startTime) patch.startTime = exp.startTime
    if (current.endTime !== exp.endTime) patch.endTime = exp.endTime

    if (Object.keys(patch).length > 0) {
      await updateDoc(doc(db, SLOTS_COLLECTION, exp.id), patch)
      updated += 1
    }
  }

  for (const slot of existing) {
    if (expectedById.has(slot.id)) continue

    const overlapsWindow = expected.some((exp) => overlaps(slot.startTime, slot.endTime, exp.startTime, exp.endTime))
    if (!overlapsWindow) continue

    const hasActivity = Boolean(slot.assignedUid) || slot.bids.length > 0 || (slot.requests?.length ?? 0) > 0 || slot.status === 'live'
    if (hasActivity) {
      conflicts.push(`Kept non-template active slot ${slot.id}`)
      continue
    }

    await deleteDoc(doc(db, SLOTS_COLLECTION, slot.id))
    removed += 1
  }

  const { year, month, day } = utcToETComponents(targetDate)
  return {
    dateET: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    created,
    updated,
    removed,
    conflicts,
  }
}

export async function syncSevenDaysFrom(startDate: Date): Promise<{ days: string[]; created: number; updated: number; removed: number; conflicts: string[] }> {
  const days: string[] = []
  let created = 0
  let updated = 0
  let removed = 0
  const conflicts: string[] = []

  for (let i = 0; i < 7; i++) {
    const target = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000)
    const result = await syncSlotsForDate(target)
    days.push(result.dateET)
    created += result.created
    updated += result.updated
    removed += result.removed
    conflicts.push(...result.conflicts)
  }

  return { days, created, updated, removed, conflicts }
}

/** Generate slot documents for a given calendar day in Eastern Time. */
export async function generateSlotsForDate(targetDate: Date): Promise<Slot[]> {
  const result = await syncSlotsForDate(targetDate)
  if (result.created === 0) return []

  const expected = buildExpectedSlotsForDate(targetDate)
  const createdIds = new Set(expected.map((s) => s.id))
  const from = new Date(Math.min(...expected.map((s) => new Date(s.startTime).getTime())) - 60 * 60 * 1000)
  const to = new Date(Math.max(...expected.map((s) => new Date(s.endTime).getTime())) + 60 * 60 * 1000)
  const slots = await fetchSlots(from, to)
  return slots.filter((slot) => createdIds.has(slot.id) && slot.status === 'open')
}

/**
 * Auto-generate slots for the next 3 days (72 hours ahead).
 * Should be called 72 hours before each day begins.
 */
export async function generateNextThreeDays(): Promise<{ generated: number; dates: string[] }> {
  const dates: string[] = []
  let generated = 0

  for (let i = 1; i <= 3; i++) {
    const targetDate = new Date()
    targetDate.setUTCDate(targetDate.getUTCDate() + i)
    targetDate.setUTCHours(12, 0, 0, 0) // use noon UTC to avoid date boundary issues

    const result = await syncSlotsForDate(targetDate)
    generated += result.created
    const { year, month, day } = utcToETComponents(targetDate)
    dates.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
  }

  return { generated, dates }
}

/**
 * Wipe ALL existing slots and seed fresh slots starting from the given ET date.
 * Generates slots for today + next 2 days.
 */
export async function wipeAndRegenerateSlots(startDate: Date): Promise<{ generated: number }> {
  // Delete all existing slots
  const allSnap = await getDocs(collection(db, SLOTS_COLLECTION))
  const deletes = allSnap.docs.map((d) => deleteDoc(d.ref))
  await Promise.all(deletes)

  // Generate 3 days starting from startDate
  let generated = 0
  for (let i = 0; i < 3; i++) {
    const targetDate = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000)
    const result = await syncSlotsForDate(targetDate)
    generated += result.created
  }

  return { generated }
}

/** Fetch all slots for a date range. */
export async function fetchSlots(from: Date, to: Date): Promise<Slot[]> {
  const q = query(
    collection(db, SLOTS_COLLECTION),
    where('startTime', '>=', from.toISOString()),
    where('startTime', '<=', to.toISOString()),
    orderBy('startTime', 'asc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as Slot)
}

/** Subscribe to slots changes in real time. */
export function subscribeToSlots(from: Date, to: Date, callback: (slots: Slot[]) => void): Unsubscribe {
  const q = query(
    collection(db, SLOTS_COLLECTION),
    where('startTime', '>=', from.toISOString()),
    where('startTime', '<=', to.toISOString()),
    orderBy('startTime', 'asc'),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data() as Slot))
  })
}

/** Get the currently active slot based on current time. */
export function subscribeToCurrentSlot(callback: (slot: Slot | null) => void): Unsubscribe {
  const now = new Date()
  // Use ±24h window so any timezone offset in stored startTime is always matched
  const from = new Date(now.getTime() - 24 * 60 * 60 * 1000) // 24h ago
  const to = new Date(now.getTime() + 24 * 60 * 60 * 1000)   // 24h ahead

  const q = query(
    collection(db, SLOTS_COLLECTION),
    where('startTime', '>=', from.toISOString()),
    where('startTime', '<=', to.toISOString()),
    orderBy('startTime', 'asc'),
  )

  return onSnapshot(q, (snap) => {
    const slots = snap.docs.map((d) => d.data() as Slot)
    const currentTime = Date.now()
    const current = slots.find((s) => {
      const start = new Date(s.startTime).getTime()
      const end = new Date(s.endTime).getTime()
      return currentTime >= start && currentTime < end
    })
    callback(current ?? null)
  })
}

/** Place a bid on an auction slot using CSGN tokens. */
export async function placeBid(slotId: string, bid: SlotBid): Promise<void> {
  const ref = doc(db, SLOTS_COLLECTION, slotId)
  const snap = await getDocs(query(collection(db, SLOTS_COLLECTION), where('id', '==', slotId)))
  if (snap.empty) throw new Error('Slot not found')

  const slot = snap.docs[0].data() as Slot
  if (slot.status !== 'open') throw new Error('Bidding is closed for this slot')
  if (slot.type !== 'auction') throw new Error('This slot is not an auction slot')

  const minBid = getMinimumBid(slot.bids.length)
  if (bid.amount < minBid) throw new Error(`Bid must be at least ${formatCSGN(minBid)}`)

  // Each wallet can only bid once
  if (bid.walletAddress && slot.bids.some((b) => b.walletAddress === bid.walletAddress)) {
    throw new Error('You have already placed a bid on this slot')
  }

  const updatedBids = [...slot.bids, bid]
  await updateDoc(ref, { bids: updatedBids })
}

/** Submit a slot request for a CEO slot. */
export async function requestSlot(slotId: string, request: Omit<SlotRequest, 'id' | 'status'>): Promise<void> {
  const ref = doc(db, SLOTS_COLLECTION, slotId)
  const snap = await getDocs(query(collection(db, SLOTS_COLLECTION), where('id', '==', slotId)))
  if (snap.empty) throw new Error('Slot not found')

  const slot = snap.docs[0].data() as Slot
  if (slot.type !== 'ceo') throw new Error('Requests are only for CEO schedule slots')
  if (slot.status !== 'open') throw new Error('This slot is no longer accepting requests')

  // Prevent duplicate requests
  if (slot.requests?.some((r) => r.uid === request.uid)) {
    throw new Error('You have already requested this slot')
  }

  const newRequest: SlotRequest = {
    ...request,
    id: crypto.randomUUID(),
    status: 'pending',
  }

  await updateDoc(ref, { requests: [...(slot.requests || []), newRequest] })
}

/** Admin: accept a slot request. */
export async function acceptSlotRequest(slotId: string, requestId: string, responseNote?: string): Promise<void> {
  const snap = await getDocs(query(collection(db, SLOTS_COLLECTION), where('id', '==', slotId)))
  if (snap.empty) throw new Error('Slot not found')

  const slot = snap.docs[0].data() as Slot
  const request = slot.requests?.find((r) => r.id === requestId)
  if (!request) throw new Error('Request not found')

  const updatedRequests = slot.requests.map((r) =>
    r.id === requestId ? { ...r, status: 'accepted' as const, responseNote } : r
  )

  const ref = doc(db, SLOTS_COLLECTION, slotId)
  await updateDoc(ref, {
    requests: updatedRequests,
    assignedUid: request.uid,
    assignedName: request.displayName,
    status: 'confirmed',
  })

  await addUserNotification(request.uid, {
    type: 'slot_request_accepted',
    slotId: slot.id,
    slotLabel: slot.label,
    slotStart: slot.startTime,
    message: `Your slot request for ${slot.label} has been accepted!${responseNote ? ` Note: ${responseNote}` : ''}`,
  })
}

/** Admin: decline a slot request. */
export async function declineSlotRequest(slotId: string, requestId: string, reason: string): Promise<void> {
  const snap = await getDocs(query(collection(db, SLOTS_COLLECTION), where('id', '==', slotId)))
  if (snap.empty) throw new Error('Slot not found')

  const slot = snap.docs[0].data() as Slot
  const request = slot.requests?.find((r) => r.id === requestId)
  if (!request) throw new Error('Request not found')

  const updatedRequests = slot.requests.map((r) =>
    r.id === requestId ? { ...r, status: 'declined' as const, responseNote: reason } : r
  )

  const ref = doc(db, SLOTS_COLLECTION, slotId)
  await updateDoc(ref, { requests: updatedRequests })

  await addUserNotification(request.uid, {
    type: 'slot_request_declined',
    slotId: slot.id,
    slotLabel: slot.label,
    slotStart: slot.startTime,
    message: `Your slot request for ${slot.label} was not approved. Reason: ${reason}`,
  })
}

/** Admin: assign/switch a streamer on any slot. */
export async function assignSlot(
  slotId: string,
  uid: string,
  displayName: string,
  streamUrl: string,
  description: string,
): Promise<void> {
  const ref = doc(db, SLOTS_COLLECTION, slotId)
  await updateDoc(ref, {
    assignedUid: uid,
    assignedName: displayName,
    streamUrl: streamUrl || DEFAULT_STREAM_URL,
    description,
    status: 'confirmed',
  })
}

/** Admin: update only the stream URL for a slot. */
export async function updateSlotStreamUrl(slotId: string, streamUrl: string): Promise<void> {
  const ref = doc(db, SLOTS_COLLECTION, slotId)
  await updateDoc(ref, { streamUrl: streamUrl || DEFAULT_STREAM_URL })
}

/** Admin: assign a user to a CEO slot. */
export async function assignCEOSlot(
  slotId: string,
  uid: string,
  displayName: string,
  streamUrl: string,
  description: string,
): Promise<void> {
  const ref = doc(db, SLOTS_COLLECTION, slotId)
  await updateDoc(ref, {
    assignedUid: uid,
    assignedName: displayName,
    streamUrl: streamUrl || DEFAULT_STREAM_URL,
    description,
    status: 'confirmed',
  })

  await addUserNotification(uid, {
    type: 'prime_assigned',
    slotId,
    slotLabel: '',
    slotStart: '',
    message: `You have been assigned a CEO Schedule slot! Check your schedule for details.`,
  })
}

/** Admin: update slot status. */
export async function updateSlotStatus(slotId: string, status: SlotStatus): Promise<void> {
  await updateDoc(doc(db, SLOTS_COLLECTION, slotId), { status })
}

/** Admin: update slot. */
export async function updateSlot(slotId: string, updates: Partial<Slot>): Promise<void> {
  await updateDoc(doc(db, SLOTS_COLLECTION, slotId), updates)
}

/** Admin: delete a slot. */
export async function deleteSlot(slotId: string): Promise<void> {
  await deleteDoc(doc(db, SLOTS_COLLECTION, slotId))
}

/** Admin: update creator fee payment status for a slot. */
export async function updateCreatorFees(slotId: string, fees: CreatorFees): Promise<void> {
  await updateDoc(doc(db, SLOTS_COLLECTION, slotId), { creatorFees: fees })
}

/** Admin: mark creator fees as paid. */
export async function markFeesPaid(slotId: string): Promise<void> {
  const snap = await getDocs(query(collection(db, SLOTS_COLLECTION), where('id', '==', slotId)))
  if (snap.empty) throw new Error('Slot not found')

  const slot = snap.docs[0].data() as Slot
  const fees = slot.creatorFees
  if (!fees) throw new Error('No fee record for this slot')

  const updatedFees: CreatorFees = {
    ...fees,
    paymentStatus: 'paid',
    paidAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  await updateDoc(doc(db, SLOTS_COLLECTION, slotId), { creatorFees: updatedFees })

  if (slot.assignedUid) {
    await addUserNotification(slot.assignedUid, {
      type: 'fee_paid',
      slotId: slot.id,
      slotLabel: slot.label,
      slotStart: slot.startTime,
      message: `Your creator fee payment of ${updatedFees.feeOwedSOL.toFixed(4)} SOL for ${slot.label} has been sent to your wallet!`,
    })
  }
}

/** Admin: decline creator fee payment with reason. */
export async function declineFeesPayment(slotId: string, reason: string): Promise<void> {
  const snap = await getDocs(query(collection(db, SLOTS_COLLECTION), where('id', '==', slotId)))
  if (snap.empty) throw new Error('Slot not found')

  const slot = snap.docs[0].data() as Slot
  const fees = slot.creatorFees
  if (!fees) throw new Error('No fee record for this slot')

  const updatedFees: CreatorFees = {
    ...fees,
    paymentStatus: 'declined',
    declineReason: reason,
    updatedAt: new Date().toISOString(),
  }

  await updateDoc(doc(db, SLOTS_COLLECTION, slotId), { creatorFees: updatedFees })

  if (slot.assignedUid) {
    await addUserNotification(slot.assignedUid, {
      type: 'fee_declined',
      slotId: slot.id,
      slotLabel: slot.label,
      slotStart: slot.startTime,
      message: `Your creator fee payment for ${slot.label} could not be processed. Reason: ${reason}`,
    })
  }
}

/** Add a notification to a user's profile. */
export async function addUserNotification(
  uid: string,
  notification: {
    type: 'auction_won' | 'prime_assigned' | 'slot_request_accepted' | 'slot_request_declined' | 'fee_paid' | 'fee_declined'
    slotId: string
    slotLabel: string
    slotStart: string
    message: string
    depositRequired?: number
    depositDeadline?: string
  },
): Promise<void> {
  const userRef = doc(db, 'users', uid)
  const snap = await getDoc(userRef)
  if (!snap.exists()) return

  const existing = (snap.data().notifications || []) as any[]
  const newNotification = {
    ...notification,
    id: crypto.randomUUID(),
    read: false,
    createdAt: new Date().toISOString(),
  }

  await updateDoc(userRef, { notifications: [newNotification, ...existing] })
}

/** Resolve an auction slot: pick highest bidder, notify them. */
export async function resolveAuction(slotId: string): Promise<{ winnerUid: string; amount: number } | null> {
  const ref = doc(db, SLOTS_COLLECTION, slotId)
  const snap = await getDocs(query(collection(db, SLOTS_COLLECTION), where('id', '==', slotId)))
  if (snap.empty) return null

  const slot = snap.docs[0].data() as Slot
  if (slot.bids.length === 0) {
    await updateDoc(ref, { status: 'unfilled', streamUrl: DEFAULT_STREAM_URL })
    return null
  }

  // Highest bid wins
  const sorted = [...slot.bids].sort((a, b) => b.amount - a.amount)
  const winner = sorted[0]

  const depositDeadline = new Date(new Date(slot.startTime).getTime() - 60 * 60 * 1000).toISOString()

  await updateDoc(ref, {
    status: 'pending_deposit',
    assignedUid: winner.uid,
    assignedName: winner.displayName,
    // streamUrl remains the default (shrood) until confirmed
  })

  await addUserNotification(winner.uid, {
    type: 'auction_won',
    slotId: slot.id,
    slotLabel: slot.label,
    slotStart: slot.startTime,
    message: `You won the auction for ${slot.label} with a bid of ${formatCSGN(winner.amount)}! Your slot has been confirmed.`,
    depositDeadline,
  })

  return { winnerUid: winner.uid, amount: winner.amount }
}
