export type NetworkMode = 'AUTO' | 'COMMUNITY' | 'OWNER_LIVE' | 'SAFE'

export interface AutoPilotConfig {
  enabled: boolean
  mode: NetworkMode
  hold: boolean
  holdSegment?: string
  headline: string
  analysis: string
  nextUpdate: string
  updatedAt?: string
}

export const DEFAULT_AUTOPILOT: AutoPilotConfig = {
  enabled: true,
  mode: 'AUTO',
  hold: false,
  headline: 'The CSGN 30 is building the next live rundown',
  analysis: 'Sports first. Markets in context. Every item sourced before air.',
  nextUpdate: 'Next update at the top of the hour',
}

export interface WheelSegment {
  id: string
  name: string
  eyebrow: string
  start: number
  duration: number
  accent: string
}

export const CSGN_30: WheelSegment[] = [
  { id: 'open', name: 'Cold Open', eyebrow: 'What matters now', start: 0, duration: 20, accent: '#ff2346' },
  { id: 'lead', name: 'First Takeaway', eyebrow: 'Three facts · one point', start: 20, duration: 220, accent: '#ff2346' },
  { id: 'scores', name: 'The Scoreboard', eyebrow: 'Live and final', start: 240, duration: 180, accent: '#35ff8a' },
  { id: 'markets', name: 'Market Season', eyebrow: 'Crypto as competition', start: 420, duration: 240, accent: '#8b5cf6' },
  { id: 'ident', name: 'CSGN ID', eyebrow: 'Live AI television', start: 660, duration: 30, accent: '#ffb020' },
  { id: 'board', name: 'The Board', eyebrow: 'Four stories · four minutes', start: 690, duration: 270, accent: '#38bdf8' },
  { id: 'film', name: 'Film Room', eyebrow: 'The durable idea', start: 960, duration: 240, accent: '#ffb020' },
  { id: 'numbers', name: 'Numbers Game', eyebrow: 'The data decides', start: 1200, duration: 180, accent: '#35ff8a' },
  { id: 'community', name: 'Community Break', eyebrow: 'Holder programmed', start: 1380, duration: 120, accent: '#f472b6' },
  { id: 'finish', name: 'The Finish', eyebrow: 'The last word', start: 1500, duration: 210, accent: '#ff2346' },
  { id: 'reset', name: 'Next / Reset', eyebrow: 'The channel never stops', start: 1710, duration: 90, accent: '#ffb020' },
]

export function wheelPosition(now: Date): number {
  return ((now.getMinutes() % 30) * 60) + now.getSeconds()
}

export function segmentAt(second: number): WheelSegment {
  return CSGN_30.find((segment) => second >= segment.start && second < segment.start + segment.duration) ?? CSGN_30[0]
}

export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}
