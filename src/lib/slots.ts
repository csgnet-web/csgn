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
  startTime: string           // ISO
  endTime: string             // ISO
  status: SlotStatus
  streamUrl: string           // defaults to twitch.tv/shrood
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
  hourOffsetET: number  // hours from midnight ET (can exceed 24 for cross-midnight slots)
  duration: number      // hours
  type: SlotType
}

/**
 * Schedule (ET, DST-aware):
 *  CEO Schedule (admin):  11:00 PM – 3:00 AM  (2 two-hour slots)
 *  Auction (bidding):      3:00 AM – 7:00 PM  (8 two-hour slots)
 *  CEO Schedule (admin):   7:00 PM – 11:00 PM (2 two-hour slots)
 *
 * Each calendar day is anchored to its own 11 PM start.
 * hourOffsetET is hours from midnight ET of the target date.
 */
const SCHEDULE_TEMPLATE: TemplateSlot[] = [
  // CEO block: 11 PM – 3 AM
  { hourOffsetET: 23, duration: 2, type: 'ceo' },    // 11 PM – 1 AM  (crosses midnight)
  { hourOffsetET: 25, duration: 2, type: 'ceo' },    // 1 AM – 3 AM
  // Auction block: 3 AM – 7 PM
  { hourOffsetET: 3,  duration: 2, type: 'auction' }, // 3 AM – 5 AM
  { hourOffsetET: 5,  duration: 2, type: 'auction' }, // 5 AM – 7 AM
  { hourOffsetET: 7,  duration: 2, type: 'auction' }, // 7 AM – 9 AM
  { hourOffsetET: 9,  duration: 2, type: 'auction' }, // 9 AM – 11 AM
  { hourOffsetET: 11, duration: 2, type: 'auction' }, // 11 AM – 1 PM
  { hourOffsetET: 13, duration: 2, type: 'auction' }, // 1 PM – 3 PM
  { hourOffsetET: 15, duration: 2, type: 'auction' }, // 3 PM – 5 PM
  { hourOffsetET: 17, duration: 2, type: 'auction' }, // 5 PM – 7 PM
  // CEO block: 7 PM – 11 PM
  { hourOffsetET: 19, duration: 2, type: 'ceo' },    // 7 PM – 9 PM
  { hourOffsetET: 21, duration: 2, type: 'ceo' },    // 9 PM – 11 PM
]

/* ─── Helpers ─── */

/**
 * Returns the UTC offset (in hours, positive = behind UTC) for America/New_York
 * on the given date. Handles DST correctly: EDT = 4, EST = 5.
 */
function getNewYorkUtcOffsetHours(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10)
  const nyAsUtcMs = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return Math.round((date.getTime() - nyAsUtcMs) / 3_600_000)
}

/**
 * Build a UTC Date representing a specific hour in ET on a given calendar date.
 * Handles DST automatically.
 * @param etMidnight - UTC Date representing midnight ET of the target day
 * @param hourOffsetET - hours from midnight ET (may exceed 24)
 */
function etHourToUtc(etMidnight: Date, hourOffsetET: number): Date {
  // Approximate UTC timestamp for midnight + hourOffsetET in ET
  const approx = new Date(etMidnight.getTime() + hourOffsetET * 3_600_000)
  const offset = getNewYorkUtcOffsetHours(approx)
  return new Date(etMidnight.getTime() + (hourOffsetET + offset) * 3_600_000)
}

/**
 * Returns a UTC Date representing midnight ET for the given calendar date string "YYYY-MM-DD".
 */
function etMidnightUtc(dateStr: string): Date {
  // Parse the date in ET by using noon UTC as a reference, then computing ET midnight
  const [y, m, d] = dateStr.split('-').map(Number)
  const noonUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  const offset = getNewYorkUtcOffsetHours(noonUtc) // 4 (EDT) or 5 (EST)
  return new Date(Date.UTC(y, m - 1, d, offset, 0, 0))  // midnight ET = offset hours UTC
}

function dateToSlotId(dateStr: string, hourOffsetET: number): string {
  return `slot-${dateStr}-${String(hourOffsetET).padStart(2, '0')}`
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

/**
 * Generate slot documents for a given calendar date string "YYYY-MM-DD".
 * The schedule starts at 11 PM ET on targetDateStr and covers 12 two-hour slots
 * (identical to 24 hours of programming starting at 11 PM ET).
 */
export async function generateSlotsForDate(targetDateStr: string): Promise<Slot[]> {
  const slots: Slot[] = []
  const midnight = etMidnightUtc(targetDateStr)

  for (const template of SCHEDULE_TEMPLATE) {
    const startDate = etHourToUtc(midnight, template.hourOffsetET)
    const endDate = new Date(startDate.getTime() + template.duration * 3_600_000)

    const slotId = dateToSlotId(targetDateStr, template.hourOffsetET)
    const label = `${formatTimeLabel(template.hourOffsetET)} – ${formatTimeLabel(template.hourOffsetET + template.duration)}`

    // Check if slot already exists to avoid duplicates
    const existingSnap = await getDocs(query(collection(db, SLOTS_COLLECTION), where('id', '==', slotId)))
    if (!existingSnap.empty) continue

    const slot: Slot = {
      id: slotId,
      type: template.type,
      label,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      status: 'open',
      streamUrl: DEFAULT_STREAM_URL,
      assignedUid: null,
      assignedName: null,
      description: '',
      bids: [],
      lotteryEntrants: [],
      requests: [],
      createdAt: serverTimestamp(),
    }

    await setDoc(doc(db, SLOTS_COLLECTION, slotId), slot)
    slots.push(slot)
  }

  return slots
}

/**
 * Auto-generate slots for the next 3 days (72 hours ahead).
 * Should be called 72 hours before each day begins.
 */
export async function generateNextThreeDays(): Promise<{ generated: number; dates: string[] }> {
  const dates: string[] = []
  let generated = 0

  for (let i = 1; i <= 3; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) // YYYY-MM-DD in ET

    const newSlots = await generateSlotsForDate(dateStr)
    generated += newSlots.length
    dates.push(dateStr)
  }

  return { generated, dates }
}

/**
 * Delete ALL slots in Firestore. Use before regenerating from scratch.
 */
export async function clearAllSlots(): Promise<number> {
  const snap = await getDocs(collection(db, SLOTS_COLLECTION))
  const deletes = snap.docs.map((d) => deleteDoc(doc(db, SLOTS_COLLECTION, d.id)))
  await Promise.all(deletes)
  return snap.docs.length
}

/**
 * Clear all existing slots and regenerate fresh slots for today + next 6 days.
 * Slots start at 11 PM ET on each day and run for 24 hours.
 */
export async function clearAndRegenerateSlots(): Promise<{ deleted: number; generated: number; dates: string[] }> {
  const deleted = await clearAllSlots()

  const dates: string[] = []
  let generated = 0

  for (let i = 0; i < 7; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) // YYYY-MM-DD in ET
    const newSlots = await generateSlotsForDate(dateStr)
    generated += newSlots.length
    dates.push(dateStr)
  }

  return { deleted, generated, dates }
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
