export interface SlotBid {
  id: string
  uid: string
  slotId: string
  slotLabel: string
  slotStart: string
  amount: number
  status: 'pending' | 'won' | 'lost'
  createdAt: string
}

export interface LotteryEntry {
  id: string
  uid: string
  slotId: string
  slotLabel: string
  slotStart: string
  dayKey: string
  status: 'pending' | 'selected' | 'not_selected'
  createdAt: string
}

export interface AssignedSlot {
  id: string
  uid: string
  slotLabel: string
  slotStart: string
  source: 'admin'
}

const BID_KEY = 'csgn_queue_bids'
const LOTTERY_KEY = 'csgn_queue_lottery'
const ASSIGNED_KEY = 'csgn_assigned_slots'

function read<T>(key: string): T[] {
  try {
    const value = localStorage.getItem(key)
    return value ? (JSON.parse(value) as T[]) : []
  } catch {
    return []
  }
}

function write<T>(key: string, items: T[]) {
  localStorage.setItem(key, JSON.stringify(items))
}

export const queueStore = {
  getBids: () => read<SlotBid>(BID_KEY),
  saveBid: (bid: SlotBid) => write(BID_KEY, [bid, ...read<SlotBid>(BID_KEY)]),
  getLotteryEntries: () => read<LotteryEntry>(LOTTERY_KEY),
  saveLotteryEntry: (entry: LotteryEntry) => write(LOTTERY_KEY, [entry, ...read<LotteryEntry>(LOTTERY_KEY)]),
  getAssignedSlots: () => read<AssignedSlot>(ASSIGNED_KEY),
}
