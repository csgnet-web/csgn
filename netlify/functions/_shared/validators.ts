import { createHash } from 'node:crypto'
import { badRequest } from './errors'

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/

export function normalizeEmail(email: string): string {
  const normalized = String(email || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw badRequest('Enter a valid email address.', 'invalid_email')
  return normalized
}

export function emailKey(email: string): string {
  return createHash('sha256').update(normalizeEmail(email)).digest('hex')
}

export function normalizeUsername(username: string): string {
  const value = String(username || '').trim()
  if (!USERNAME_RE.test(value)) {
    throw badRequest('Username must be 3-20 characters and use only letters, numbers, and underscores.', 'invalid_username')
  }
  return value
}

export function usernameKey(username: string): string {
  return normalizeUsername(username).toLowerCase()
}

export function normalizeWalletAddress(address: string): string {
  const value = String(address || '').trim()
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) throw badRequest('Invalid Phantom wallet address.', 'invalid_wallet')
  return value
}

export function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw badRequest(`${field} is required.`, 'missing_field')
  return value.trim()
}

export function twitchChannelUrl(username: string): string {
  const clean = String(username || '').trim().replace(/^@/, '').toLowerCase()
  if (!/^[a-z0-9_]{3,25}$/.test(clean)) throw badRequest('Invalid Twitch username.', 'invalid_twitch_username')
  return `https://www.twitch.tv/${clean}`
}
