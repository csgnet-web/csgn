/**
 * Render tests for the profile page (/account).
 *
 * The real <Dashboard /> mounted against fakes for auth, Firestore and the
 * on-chain balance read. jsdom has no layout engine, so these can't assert
 * "nothing overlaps" in pixels — what they CAN pin down is the structural
 * reason the old header overlapped, and every regression that would bring it
 * back:
 *
 *   • no negative margins and no absolutely-positioned identity elements, so
 *     the avatar cannot ride up over the name at any width
 *   • long display names and long slot labels wrap instead of being truncated
 *     into nothing or pushing figures off the card
 *   • the games and holder panels render honest zero/empty states rather than
 *     invented numbers, before any settlement job exists
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

/* ── Fakes ─────────────────────────────────────────────────────────────── */

const mockProfile = {
  uid: 'u1',
  email: 'streamer@example.com',
  username: 'csgnstreamer',
  displayName: 'CSGN Streamer',
  role: 'streamer' as const,
  createdAt: null,
  xp: 4200,
  phantom: { verified: true, walletAddress: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1', verifiedAt: null },
  twitch: { verified: true, twitchUserId: '1', username: 'csgnet', displayName: 'csgnet', profileImageUrl: '', verifiedAt: null },
  notifications: [],
}

const authState = {
  user: { uid: 'u1', emailVerified: true } as unknown,
  profile: mockProfile as unknown,
  signIn: vi.fn(),
  resendVerification: vi.fn(),
  refreshProfile: vi.fn(),
}

vi.mock('@/contexts/useAuth', () => ({ useAuth: () => authState }))

vi.mock('@/contexts/useLiveSlot', () => ({
  useLiveSlot: () => ({
    currentSlot: null, allSlots: [], manualOverride: null, nowMs: Date.now(),
    slotsReady: true, networkBlockEnabled: true, gameBanner: null,
    tokenStats: { marketCapUsd: 4_000_000, priceUsd: 0.004 },
  }),
}))

const slots: unknown[] = []
vi.mock('@/lib/slots', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/slots')>()),
  fetchSlotsByAssignee: async () => slots,
}))

vi.mock('@/config/firebase', () => ({ db: {}, auth: {}, storage: {} }))
vi.mock('firebase/firestore', () => ({
  doc: () => ({}),
  updateDoc: vi.fn(),
  onSnapshot: () => () => {},
}))

// 1% of a 1B supply — enough to exercise the allowance curve.
vi.mock('@/lib/csgnBalance', () => ({ fetchCsgnBalance: async () => 10_000_000 }))

vi.mock('@/components/MemeVoteCard', () => ({ default: () => null }))

const { default: Dashboard } = await import('./Dashboard')
// The page renders <Link>s, which need a router in context to mount at all.
const { MemoryRouter } = await import('react-router-dom')

/* ── Harness ───────────────────────────────────────────────────────────── */

let container: HTMLDivElement
let root: Root

async function render() {
  await act(async () => {
    root.render(<MemoryRouter><Dashboard /></MemoryRouter>)
  })
  // Let the balance + slot promises resolve.
  await act(async () => { await Promise.resolve() })
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  slots.length = 0
})

const text = () => container.textContent ?? ''
const all = (selector: string) => Array.from(container.querySelectorAll(selector))

describe('the identity header', () => {
  it('shows the name, handle and role', async () => {
    await render()
    expect(text()).toContain('CSGN Streamer')
    expect(text()).toContain('@csgnstreamer')
    expect(text()).toContain('streamer')
  })

  it('uses NO negative margins — the overlap the old header shipped with', async () => {
    await render()
    const offenders = all('[class*="-mt-"]').filter((el) => /(^|\s)-mt-\d/.test(el.className))
    expect(offenders).toHaveLength(0)
  })

  it('positions nothing absolutely in the identity block', async () => {
    await render()
    const header = container.querySelector('section')!
    expect(header.querySelectorAll('.absolute')).toHaveLength(0)
  })

  it('lets a long display name WRAP rather than truncate to nothing', async () => {
    const longName = 'A Very Long Display Name That Would Certainly Overflow A Narrow Phone'
    ;(mockProfile as { displayName: string }).displayName = longName
    await render()
    const heading = container.querySelector('h1')!
    expect(heading.textContent).toBe(longName)
    expect(heading.className).toContain('break-words')
    expect(heading.className).not.toContain('truncate')
    ;(mockProfile as { displayName: string }).displayName = 'CSGN Streamer'
  })

  it('renders every stat with a value and a label', async () => {
    await render()
    for (const label of ['XP', 'Slots played', 'Live minutes', 'Fees earned']) {
      expect(text()).toContain(label)
    }
    expect(text()).toContain('4,200')
  })
})

describe('connections', () => {
  it('reports each connection honestly', async () => {
    await render()
    expect(text()).toContain('Twitch')
    expect(text()).toContain('Wallet')
    expect(text()).toContain('Email')
    // A verified wallet shows its truncated address, never "Not connected".
    expect(text()).toContain('5Q54')
  })

  it('says "Not connected" when a connection is genuinely missing', async () => {
    const saved = mockProfile.phantom
    ;(mockProfile as { phantom?: unknown }).phantom = undefined
    await render()
    expect(text()).toContain('Not connected')
    ;(mockProfile as { phantom?: unknown }).phantom = saved
  })
})

describe('the games panel', () => {
  it('shows both games with their cadence', async () => {
    await render()
    expect(text()).toContain('Starting 5')
    expect(text()).toContain('Squares')
    expect(text()).toContain('Daily')
    expect(text()).toContain('Weekly')
  })

  it('shows the 100,000 $CSGN perfect-card purse', async () => {
    await render()
    expect(text()).toContain('100.0K $CSGN')
    expect(text()).toContain('Perfect card (5/5)')
  })

  it('renders honest zeroes rather than invented stats', async () => {
    await render()
    expect(text()).toContain('Entries')
    expect(text()).toContain('Perfect cards')
    // No settlement job has run, so lifetime winnings are zero, not fabricated.
    expect(text()).toContain('0 $CSGN won')
  })
})

describe('the holder panel', () => {
  it('translates the balance into supply share and entitlements', async () => {
    await render()
    expect(text()).toContain('10.00M')     // balance
    expect(text()).toContain('1.00%')      // share of a 1B supply
    expect(text()).toContain('Squares per board')
    expect(text()).toContain('Starting 5 lineups')
  })

  it('says the allowance is maxed instead of showing an impossible target', async () => {
    await render()
    expect(text()).toContain('Maxed')
  })

  it('states that nothing is locked or spent', async () => {
    await render()
    expect(text()).toContain('Nothing is locked or spent')
  })
})

describe('slots and fees', () => {
  it('gives an empty, actionable state when nothing is booked', async () => {
    await render()
    expect(text()).toContain("You don't have a slot booked")
    expect(text()).toContain('No assigned slot history yet.')
  })

  it('wraps a long slot label instead of pushing the figures off the card', async () => {
    slots.push({
      id: 's1',
      label: 'An Extremely Long Slot Label That Would Overflow A Narrow Card',
      startTime: new Date(Date.now() + 3_600_000).toISOString(),
      endTime: new Date(Date.now() + 7_200_000).toISOString(),
      assignedUid: 'u1',
      status: 'confirmed',
      type: 'open',
      streamTitle: 'A stream title long enough to need its own line as well',
    })
    await render()
    expect(text()).toContain('An Extremely Long Slot Label')
    const wrapped = all('.break-words').some((el) => el.textContent?.includes('An Extremely Long Slot Label'))
    expect(wrapped).toBe(true)
  })
})

describe('signed out', () => {
  it('shows the sign-in form and none of the profile', async () => {
    const saved = authState.user
    authState.user = null
    await render()
    expect(text()).toContain('Sign in')
    expect(text()).not.toContain('Holder standing')
    authState.user = saved
  })
})
