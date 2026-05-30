import { writeDoc } from './firebaseAdmin'

export async function auditLog(action: string, uid: string | null, data: Record<string, unknown> = {}) {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  await writeDoc(`auditLogs/${id}`, {
    action,
    uid,
    data,
    createdAt: new Date(),
  }).catch((err) => console.warn('auditLog failed', err))
}
