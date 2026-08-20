/**
 * The card exists to answer "why is THIS what's on?" — so the tests pin the two
 * things that make an answer trustworthy: it appears with a real reason
 * attached, and it DISAPPEARS rather than guessing when the server has not
 * published one or the verdict has gone stale.
 *
 * That second case is the one worth a test. Every serious bug in this project
 * has been an unknown rendered as a fact.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import type { ChannelModeDoc } from '@/hooks/useChannelMode'

const state: { channelMode: ChannelModeDoc | null; stale: boolean } = { channelMode: null, stale: false }
vi.mock('@/hooks/useChannelMode', () => ({ useChannelMode: () => state }))

const { default: ChannelModeCard } = await import('./ChannelModeCard')

const doc = (over: Partial<ChannelModeDoc> = {}): ChannelModeDoc => ({
  mode: 'clips',
  label: 'Clip Mode',
  who: null,
  isGuest: false,
  because: 'Nobody from the roster is streaming right now, so the member clip reel is carrying the channel.',
  nextSwitch: 'The moment a connected member goes live, the network can cut to them.',
  since: '2026-08-20T18:00:00.000Z',
  log: [
    { at: '2026-08-20T18:00:00.000Z', mode: 'clips', who: null, because: 'Reel took over.' },
    { at: '2026-08-20T16:00:00.000Z', mode: 'live', who: 'roblito', because: 'roblito went live.' },
    { at: '2026-08-20T14:00:00.000Z', mode: 'clips', who: null, because: 'Reel took over.' },
  ],
  liveCount: 0,
  updatedAt: '2026-08-20T18:01:00.000Z',
  ...over,
})

let host: HTMLDivElement
let root: Root

function mount() {
  act(() => { root.render(<MemoryRouter><ChannelModeCard /></MemoryRouter>) })
}
const text = () => host.textContent ?? ''

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  state.channelMode = null
  state.stale = false
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('ChannelModeCard', () => {
  it('renders nothing before the server has published a verdict', () => {
    mount()
    expect(text()).toBe('')
  })

  // A stalled poller must not leave an hours-old "LIVE: someone" on the page.
  it('renders nothing when the verdict is stale', () => {
    state.channelMode = doc({ mode: 'live', who: 'roblito', label: 'Live' })
    state.stale = true
    mount()
    expect(text()).toBe('')
  })

  it('states the mode and the reason', () => {
    state.channelMode = doc()
    mount()
    expect(text()).toContain('Clip Mode')
    expect(text()).toContain('member clip reel is carrying the channel')
    expect(text()).toContain('cut to them')
  })

  it('names who is on in live mode', () => {
    state.channelMode = doc({ mode: 'live', label: 'Live', who: 'roblito', because: 'roblito is live on their own channel.' })
    mount()
    expect(text()).toContain('roblito')
  })

  // A guest that reads identically to a member makes the roster meaningless.
  it('marks a guest as a guest', () => {
    state.channelMode = doc({ mode: 'live', label: 'Live', who: 'ansem', isGuest: true })
    mount()
    expect(text()).toContain('Guest')
  })

  it('hides the switch history until asked, then shows it with times', () => {
    state.channelMode = doc()
    mount()
    expect(text()).not.toContain('roblito went live')

    const button = host.querySelector('button')
    expect(button).not.toBeNull()
    act(() => { button!.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(text()).toContain('roblito went live')
  })

  // The first log entry IS the current mode — showing it again under "recent
  // switches" makes the card look like it is repeating itself.
  it('does not repeat the current switch in the history', () => {
    state.channelMode = doc()
    mount()
    const button = host.querySelector('button')
    act(() => { button!.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    const occurrences = text().split('Reel took over.').length - 1
    expect(occurrences).toBe(1)
  })

  it('offers no history control when there is nothing but the current mode', () => {
    state.channelMode = doc({ log: [{ at: '2026-08-20T18:00:00.000Z', mode: 'clips', who: null, because: 'Reel took over.' }] })
    mount()
    expect(host.querySelector('button')).toBeNull()
  })
})
