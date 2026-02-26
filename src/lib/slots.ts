import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot, serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/config/firebase'

/* ─── Types ─── */

export type SlotType = 'auction' | 'lottery' | 'prime'

export type SlotStatus =
  | 'open'          // accepting bids / entries
  | 'closing'       // within 2h of airtime — bidding closed, winner notified
  | 'pending_deposit'// auction winner must deposit within 1h
  | 'confirmed'     // deposit received or lottery/prime confirmed
  | 'live'          // currently airing
  | 'completed'     // finished airing
  | 'unfilled'      // nobody won / deposited

export interface SlotBid {
  uid: string
  displayName: string
  amount: number
  createdAt: string
}

export interface Slot {
  id: string
  type: SlotType
  label: string
  startTime: string         // ISO
  endTime: string           // ISO
  status: SlotStatus
  assignedUid: string | null
  assignedName: string | null
  description: string
  bids: SlotBid[]           // auction only
  lotteryEntrants: string[] // lottery only — array of uids
  createdAt: unknown
}

/* ─── Quadratic bid pricing ─── */

const BASE_BID = 0.03 // SOL

/** Positive quadratic: y = 0.03 + 0.005 * x^2 where x = number of existing bids */
export function getMinimumBid(existingBidCount: number): number {
  return Number((BASE_BID + 0.005 * Math.pow(existingBidCount, 2)).toFixed(4))
}

/* ─── Schedule template ─── */

interface TemplateSlot {
  hourOffset: number // hours from midnight EST
  duration: number   // hours
  type: SlotType
}

const SCHEDULE_TEMPLATE: TemplateSlot[] = [
  // Auction block: 3 AM – 2 PM (5 two-hour slots + 1 one-hour slot)
  { hourOffset: 3,  duration: 2, type: 'auction' },
  { hourOffset: 5,  duration: 2, type: 'auction' },
  { hourOffset: 7,  duration: 2, type: 'auction' },
  { hourOffset: 9,  duration: 2, type: 'auction' },
  { hourOffset: 11, duration: 2, type: 'auction' },
  { hourOffset: 13, duration: 1, type: 'auction' },
  // Lottery block: 2 PM – 6 PM (4 one-hour slots)
  { hourOffset: 14, duration: 1, type: 'lottery' },
  { hourOffset: 15, duration: 1, type: 'lottery' },
  { hourOffset: 16, duration: 1, type: 'lottery' },
  { hourOffset: 17, duration: 1, type: 'lottery' },
  // Prime Time block: 6 PM – 3 AM (4 slots)
  { hourOffset: 18, duration: 2, type: 'prime' },
  { hourOffset: 20, duration: 2, type: 'prime' },
  { hourOffset: 22, duration: 2, type: 'prime' },
  { hourOffset: 24, duration: 3, type: 'prime' }, // midnight–3 AM next day
]

/* ─── Helpers ─── */

function toEST(date: Date): Date {
  // Approximate EST (UTC-5). For production, use a timezone library.
  return new Date(date.getTime() - 5 * 60 * 60 * 1000)
}

function dateToSlotId(date: Date, hourOffset: number): string {
  const d = toEST(date)
  const ymd = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  return `slot-${ymd}-${String(hourOffset).padStart(2, '0')}`
}

function formatTimeLabel(hour: number): string {
  const h = hour % 24
  const ampm = h >= 12 ? 'PM' : 'AM'
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${display}:00 ${ampm}`
}

/* ─── Firestore operations ─── */

const SLOTS_COLLECTION = 'slots'

/** Generate slot documents for a given day (24h ahead from now). */
export async function generateSlotsForDate(targetDate: Date): Promise<Slot[]> {
  const slots: Slot[] = []

  for (const template of SCHEDULE_TEMPLATE) {
    const startDate = new Date(targetDate)
    startDate.setUTCHours(template.hourOffset + 5, 0, 0, 0) // +5 to convert EST to UTC

    const endDate = new Date(startDate)
    endDate.setUTCHours(startDate.getUTCHours() + template.duration)

    const slotId = dateToSlotId(targetDate, template.hourOffset)
    const label = `${formatTimeLabel(template.hourOffset)} – ${formatTimeLabel(template.hourOffset + template.duration)}`

    const slot: Slot = {
      id: slotId,
      type: template.type,
      label,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      status: 'open',
      assignedUid: null,
      assignedName: null,
      description: '',
      bids: [],
      lotteryEntrants: [],
      createdAt: serverTimestamp(),
    }

    await setDoc(doc(db, SLOTS_COLLECTION, slotId), slot)
    slots.push(slot)
  }

  return slots
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

/** Place a bid on an auction slot. */
export async function placeBid(slotId: string, bid: SlotBid): Promise<void> {
  const ref = doc(db, SLOTS_COLLECTION, slotId)
  // We read current bids, append, and write back (no transaction needed for MVP).
  const snap = await getDocs(query(collection(db, SLOTS_COLLECTION), where('id', '==', slotId)))
  if (snap.empty) throw new Error('Slot not found')

  const slot = snap.docs[0].data() as Slot
  if (slot.status !== 'open') throw new Error('Bidding is closed for this slot')

  const minBid = getMinimumBid(slot.bids.length)
  if (bid.amount < minBid) throw new Error(`Bid must be at least ${minBid} SOL`)

  const updatedBids = [...slot.bids, bid]
  await updateDoc(ref, { bids: updatedBids })
}

/** Enter the lottery for a slot. */
export async function enterLottery(slotId: string, uid: string): Promise<void> {
  const ref = doc(db, SLOTS_COLLECTION, slotId)
  const snap = await getDocs(query(collection(db, SLOTS_COLLECTION), where('id', '==', slotId)))
  if (snap.empty) throw new Error('Slot not found')

  const slot = snap.docs[0].data() as Slot
  if (slot.status !== 'open') throw new Error('Lottery entry is closed for this slot')
  if (slot.lotteryEntrants.includes(uid)) throw new Error('Already entered')

  await updateDoc(ref, { lotteryEntrants: [...slot.lotteryEntrants, uid] })
}

/** Admin: assign a user to a prime time slot. */
export async function assignPrimeSlot(
  slotId: string,
  uid: string,
  displayName: string,
  description: string,
): Promise<void> {
  const ref = doc(db, SLOTS_COLLECTION, slotId)
  await updateDoc(ref, {
    assignedUid: uid,
    assignedName: displayName,
    description,
    status: 'confirmed',
  })
}

/** Admin: update slot status (e.g., close bidding, set live, etc.). */
export async function updateSlotStatus(slotId: string, status: SlotStatus): Promise<void> {
  await updateDoc(doc(db, SLOTS_COLLECTION, slotId), { status })
}

/** Admin: update slot details. */
export async function updateSlot(slotId: string, updates: Partial<Slot>): Promise<void> {
  await updateDoc(doc(db, SLOTS_COLLECTION, slotId), updates)
}

/** Admin: delete a slot. */
export async function deleteSlot(slotId: string): Promise<void> {
  await deleteDoc(doc(db, SLOTS_COLLECTION, slotId))
}

/** Add a notification to a user's profile. */
export async function addUserNotification(
  uid: string,
  notification: {
    type: 'auction_won' | 'lottery_selected' | 'prime_assigned'
    slotId: string
    slotLabel: string
    slotStart: string
    message: string
    depositRequired?: number
    depositDeadline?: string
  },
): Promise<void> {
  const userRef = doc(db, 'users', uid)
  const { getDoc: gd } = await import('firebase/firestore')
  const snap = await gd(userRef)
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
    await updateDoc(ref, { status: 'unfilled' })
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
  })

  await addUserNotification(winner.uid, {
    type: 'auction_won',
    slotId: slot.id,
    slotLabel: slot.label,
    slotStart: slot.startTime,
    message: `You won the auction for ${slot.label} with a bid of ${winner.amount} SOL! Deposit within 1 hour to confirm your slot.`,
    depositRequired: winner.amount,
    depositDeadline,
  })

  return { winnerUid: winner.uid, amount: winner.amount }
}

/** Resolve a lottery slot: pick random entrant, notify them. */
export async function resolveLottery(slotId: string): Promise<string | null> {
  const ref = doc(db, SLOTS_COLLECTION, slotId)
  const snap = await getDocs(query(collection(db, SLOTS_COLLECTION), where('id', '==', slotId)))
  if (snap.empty) return null

  const slot = snap.docs[0].data() as Slot
  if (slot.lotteryEntrants.length === 0) {
    await updateDoc(ref, { status: 'unfilled' })
    return null
  }

  const winnerIdx = Math.floor(Math.random() * slot.lotteryEntrants.length)
  const winnerUid = slot.lotteryEntrants[winnerIdx]

  await updateDoc(ref, {
    status: 'confirmed',
    assignedUid: winnerUid,
  })

  await addUserNotification(winnerUid, {
    type: 'lottery_selected',
    slotId: slot.id,
    slotLabel: slot.label,
    slotStart: slot.startTime,
    message: `Congratulations! You were selected in the lottery for ${slot.label}. This slot is free — just show up and stream!`,
  })

  return winnerUid
}
