import { createSign, createVerify } from 'node:crypto'
import { forbidden, unauthorized } from './errors'

type Fields = Record<string, FirestoreValue>
type FirestoreValue = { stringValue?: string; integerValue?: string; doubleValue?: number; booleanValue?: boolean; nullValue?: null; timestampValue?: string; mapValue?: { fields: Fields }; arrayValue?: { values?: FirestoreValue[] } }

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
let cachedAccessToken: { token: string; exp: number } | null = null
let certCache: { certs: Record<string, string>; exp: number } | null = null

export interface DecodedIdToken { uid: string; email?: string; [key: string]: unknown }

export function projectId(): string {
  const id = process.env.FIREBASE_PROJECT_ID
  if (!id) throw new Error('FIREBASE_PROJECT_ID is not configured')
  return id
}

function clientEmail(): string {
  const email = process.env.FIREBASE_CLIENT_EMAIL
  if (!email) throw new Error('FIREBASE_CLIENT_EMAIL is not configured')
  return email
}

function privateKey(): string {
  const key = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!key) throw new Error('FIREBASE_PRIVATE_KEY is not configured')
  return key
}

function b64urlJson(value: unknown): string { return Buffer.from(JSON.stringify(value)).toString('base64url') }

async function accessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedAccessToken && cachedAccessToken.exp - 60 > now) return cachedAccessToken.token
  const claim = {
    iss: clientEmail(),
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/userinfo.email',
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }
  const unsigned = `${b64urlJson({ alg: 'RS256', typ: 'JWT' })}.${b64urlJson(claim)}`
  const signer = createSign('RSA-SHA256')
  signer.update(unsigned)
  const assertion = `${unsigned}.${signer.sign(privateKey(), 'base64url')}`
  const res = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) })
  if (!res.ok) throw new Error(`Google OAuth failed: ${res.status}`)
  const data = await res.json() as { access_token: string; expires_in: number }
  cachedAccessToken = { token: data.access_token, exp: now + data.expires_in }
  return data.access_token
}

function docUrl(path: string): string { return `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents/${path}` }
function commitUrl(): string { return `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents:commit` }
function beginUrl(): string { return `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents:beginTransaction` }
function runQueryUrl(): string { return `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents:runQuery` }
function docName(path: string): string { return `projects/${projectId()}/databases/(default)/documents/${path}` }

export function encodeValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null }
  if (typeof value === 'string') return { stringValue: value }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
  if (value instanceof Date) return { timestampValue: value.toISOString() }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } }
  return { mapValue: { fields: encodeFields(value as Record<string, unknown>) } }
}

export function encodeFields(data: Record<string, unknown>): Fields {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined).map(([k, v]) => [k, encodeValue(v)]))
}

export function decodeValue(value: FirestoreValue): unknown {
  if ('stringValue' in value) return value.stringValue || ''
  if ('integerValue' in value) return Number(value.integerValue || 0)
  if ('doubleValue' in value) return value.doubleValue || 0
  if ('booleanValue' in value) return !!value.booleanValue
  if ('timestampValue' in value) return value.timestampValue
  if ('arrayValue' in value) return (value.arrayValue?.values || []).map(decodeValue)
  if ('mapValue' in value) return decodeFields(value.mapValue?.fields || {})
  return null
}

export function decodeFields(fields: Fields): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields || {}).map(([k, v]) => [k, decodeValue(v)]))
}

async function authedFetch(url: string, init: RequestInit = {}) {
  const token = await accessToken()
  return fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } })
}

export async function getDoc<T = Record<string, unknown>>(path: string, transaction?: string): Promise<T | null> {
  const url = new URL(docUrl(path)); if (transaction) url.searchParams.set('transaction', transaction)
  const res = await authedFetch(url.toString())
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Firestore get failed ${path}: ${res.status}`)
  const data = await res.json() as { fields?: Fields }
  return decodeFields(data.fields || {}) as T
}

export async function writeDoc(path: string, data: Record<string, unknown>, options: { exists?: boolean; merge?: boolean } = {}) {
  const write: Record<string, unknown> = { update: { name: docName(path), fields: encodeFields(data) } }
  if (options.exists === false) write.currentDocument = { exists: false }
  if (options.merge) write.updateMask = { fieldPaths: Object.keys(data) }
  const res = await authedFetch(commitUrl(), { method: 'POST', body: JSON.stringify({ writes: [write] }) })
  if (!res.ok) throw new Error(`Firestore write failed ${path}: ${res.status} ${await res.text()}`)
}

export async function beginTransaction(): Promise<string> {
  const res = await authedFetch(beginUrl(), { method: 'POST', body: '{}' })
  if (!res.ok) throw new Error(`Firestore begin transaction failed: ${res.status}`)
  const data = await res.json() as { transaction: string }
  return data.transaction
}

export async function commitWrites(writes: unknown[], transaction?: string) {
  const res = await authedFetch(commitUrl(), { method: 'POST', body: JSON.stringify({ writes, transaction }) })
  if (!res.ok) throw new Error(`Firestore commit failed: ${res.status} ${await res.text()}`)
}

export function updateWrite(path: string, data: Record<string, unknown>, exists = true) { return { update: { name: docName(path), fields: encodeFields(data) }, updateMask: { fieldPaths: Object.keys(data) }, currentDocument: { exists } } }
export function createWrite(path: string, data: Record<string, unknown>) { return { update: { name: docName(path), fields: encodeFields(data) }, currentDocument: { exists: false } } }
export function deleteWrite(path: string) { return { delete: docName(path) } }

export async function queryCollection(collectionId: string, where: unknown[], orderBy: unknown[] = [], limit = 50): Promise<Array<{ path: string; data: Record<string, unknown> }>> {
  const structuredQuery = { from: [{ collectionId }], where: where.length ? { compositeFilter: { op: 'AND', filters: where } } : undefined, orderBy, limit }
  const res = await authedFetch(runQueryUrl(), { method: 'POST', body: JSON.stringify({ structuredQuery }) })
  if (!res.ok) throw new Error(`Firestore query failed: ${res.status} ${await res.text()}`)
  const rows = await res.json() as Array<{ document?: { name: string; fields?: Fields } }>
  return rows.filter((r) => r.document).map((r) => ({ path: r.document!.name.split('/documents/')[1], data: decodeFields(r.document!.fields || {}) }))
}

/** COUNT aggregation — bills ~1 read per 1000 index entries instead of one read per document. */
export async function countCollection(collectionId: string, where: unknown[]): Promise<number> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents:runAggregationQuery`
  const body = {
    structuredAggregationQuery: {
      structuredQuery: { from: [{ collectionId }], where: where.length ? { compositeFilter: { op: 'AND', filters: where } } : undefined },
      aggregations: [{ alias: 'n', count: {} }],
    },
  }
  const res = await authedFetch(url, { method: 'POST', body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`Firestore count failed: ${res.status} ${await res.text()}`)
  const rows = await res.json() as Array<{ result?: { aggregateFields?: { n?: { integerValue?: string } } } }>
  return Number(rows[0]?.result?.aggregateFields?.n?.integerValue ?? 0)
}

export const fieldFilter = (fieldPath: string, op: string, value: unknown) => ({ fieldFilter: { field: { fieldPath }, op, value: encodeValue(value) } })
export const order = (fieldPath: string, direction = 'ASCENDING') => ({ field: { fieldPath }, direction })

async function firebaseCerts(): Promise<Record<string, string>> {
  const now = Date.now()
  if (certCache && certCache.exp > now) return certCache.certs
  const res = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com')
  if (!res.ok) throw new Error('Could not fetch Firebase certs')
  const maxAge = Number(res.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] || 300)
  certCache = { certs: await res.json() as Record<string, string>, exp: now + maxAge * 1000 }
  return certCache.certs
}

export async function verifyIdToken(idToken: string): Promise<DecodedIdToken> {
  const [headerB64, payloadB64, sigB64] = String(idToken || '').split('.')
  if (!headerB64 || !payloadB64 || !sigB64) throw unauthorized('Invalid Firebase ID token')
  const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as { kid?: string; alg?: string }
  if (header.alg !== 'RS256' || !header.kid) throw unauthorized('Invalid Firebase ID token')
  const cert = (await firebaseCerts())[header.kid]
  if (!cert) throw unauthorized('Invalid Firebase ID token')
  const verifier = createVerify('RSA-SHA256')
  verifier.update(`${headerB64}.${payloadB64}`)
  if (!verifier.verify(cert, sigB64, 'base64url')) throw unauthorized('Invalid Firebase ID token')
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as Record<string, unknown>
  const now = Math.floor(Date.now() / 1000)
  if (payload.aud !== projectId() || payload.iss !== `https://securetoken.google.com/${projectId()}` || Number(payload.exp) <= now) throw unauthorized('Invalid Firebase ID token')
  return { ...payload, uid: String(payload.sub), email: typeof payload.email === 'string' ? payload.email : undefined }
}

export async function requireAdmin(uid: string): Promise<void> {
  const user = await getDoc<{ role?: string }>(`users/${uid}`)
  if (user?.role !== 'admin') throw forbidden('Admin access required')
}
