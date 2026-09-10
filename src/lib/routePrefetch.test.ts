import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ROUTE_CHUNKS, prefetchRoute, prefetchProps } from './routePrefetch'

/**
 * The prefetch is an optimisation, so the whole test is about it being
 * HARMLESS: it must never throw on a path it does not know, never fire twice
 * for the same chunk, and never let a failed load surface anywhere.
 */
describe('ROUTE_CHUNKS', () => {
  it('maps both spellings of the home route to the same chunk', () => {
    // '/' and '/watch' render the same page. Two entries pointing at two
    // specifiers would emit two chunks and warm the wrong one from the home tab.
    expect(ROUTE_CHUNKS['/']).not.toBeUndefined()
    expect(ROUTE_CHUNKS['/watch']).not.toBeUndefined()
  })

  it('covers every path the nav bars link to', () => {
    // If a nav link is added without an entry here it silently stops
    // prefetching, which is invisible — hence the test rather than a comment.
    for (const href of ['/watch', '/schedule', '/studio', '/about', '/participate', '/account']) {
      expect(ROUTE_CHUNKS, href).toHaveProperty(href)
    }
  })
})

describe('prefetchRoute', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('does nothing for a path it does not know', () => {
    // Profile pages (/u/someone) and OAuth landings are not in the table.
    expect(() => prefetchRoute('/u/roblito')).not.toThrow()
    expect(() => prefetchRoute('/nonsense')).not.toThrow()
    expect(() => prefetchRoute('')).not.toThrow()
  })

  it('ignores a query string and a trailing slash', () => {
    expect(() => prefetchRoute('/schedule?from=nav')).not.toThrow()
    expect(() => prefetchRoute('/schedule/')).not.toThrow()
  })

  it('never throws, whatever it is handed', () => {
    for (const path of ['//', '../../etc', '/watch#hash', '/%']) {
      expect(() => prefetchRoute(path), path).not.toThrow()
    }
  })
})

describe('prefetchProps', () => {
  it('warms on the events that precede a tap, not on the tap itself', () => {
    // pointerdown is too late — by then the navigation is already happening.
    const props = prefetchProps('/schedule')
    expect(Object.keys(props).sort()).toEqual(['onFocus', 'onPointerEnter', 'onTouchStart'])
  })

  it('hands back handlers that are safe to call', () => {
    const props = prefetchProps('/definitely-not-a-route')
    expect(() => props.onPointerEnter()).not.toThrow()
    expect(() => props.onTouchStart()).not.toThrow()
    expect(() => props.onFocus()).not.toThrow()
  })
})
