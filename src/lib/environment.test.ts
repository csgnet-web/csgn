import { describe, it, expect, afterEach } from 'vitest'
import { isOBS, obsVersion } from './environment'

afterEach(() => {
  delete (window as unknown as { obsstudio?: unknown }).obsstudio
})

describe('environment detection', () => {
  it('reports a normal browser when obsstudio is absent', () => {
    expect(isOBS()).toBe(false)
    expect(obsVersion()).toBeNull()
  })

  it('detects an OBS Browser Source via window.obsstudio', () => {
    ;(window as unknown as { obsstudio: { pluginVersion: string } }).obsstudio = { pluginVersion: '2.18.3' }
    expect(isOBS()).toBe(true)
    expect(obsVersion()).toBe('2.18.3')
  })

  it('detects OBS even when the plugin version is missing', () => {
    ;(window as unknown as { obsstudio: Record<string, never> }).obsstudio = {}
    expect(isOBS()).toBe(true)
    expect(obsVersion()).toBeNull()
  })
})
