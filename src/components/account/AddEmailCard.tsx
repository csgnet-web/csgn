import { useState } from 'react'
import { EmailAuthProvider, linkWithCredential, sendEmailVerification } from 'firebase/auth'
import { Mail } from 'lucide-react'
import { auth } from '@/config/firebase'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'

/**
 * Add an email to a wallet-first account.
 *
 * A Phantom sign-up has no email, and email verification is what gates claiming
 * a slot — so this is the one step between "I have an account" and "I can go on
 * air". It only renders when there's genuinely no email on the account.
 *
 * The credential link happens CLIENT-SIDE on purpose. `linkWithCredential`
 * attaches an email/password credential to the live session, which means the
 * password never travels to our servers and we never store or handle it. The
 * server call afterwards does one narrow thing: mirror the address onto the
 * user document and take the uniqueness lock so two accounts can't share an
 * email.
 *
 * Ordering matters and is deliberate: link → record → send the verification
 * mail. If the record step fails we have not yet told the user to check their
 * inbox for a link that would verify an account we couldn't finish setting up.
 */
export default function AddEmailCard({ onLinked }: { onLinked: () => void | Promise<void> }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [sent, setSent] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      const user = auth.currentUser
      if (!user) throw new Error('Sign in again to add your email.')

      await linkWithCredential(user, EmailAuthProvider.credential(email.trim(), password))
      // Refresh the ID token so it carries the newly linked email — the server
      // reads the address from the token, never from the request body.
      await user.getIdToken(true)
      await api.setAccountEmail()
      await sendEmailVerification(user)

      setSent(true)
      await onLinked()
    } catch (e) {
      const code = e instanceof Error && 'code' in e ? String((e as { code?: string }).code || '') : ''
      if (code === 'auth/email-already-in-use') setErr('That email is already on another CSGN account.')
      else if (code === 'auth/invalid-email') setErr('That doesn’t look like a valid email address.')
      else if (code === 'auth/weak-password') setErr('Use at least six characters for the password.')
      else if (code === 'auth/requires-recent-login') setErr('For security, sign in again and retry.')
      else setErr(e instanceof Error ? e.message : 'Could not add your email.')
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <Notice tone="success" title="Check your inbox">
        We sent a verification link to {email}. Click it and you can claim a slot.
      </Notice>
    )
  }

  return (
    <section className="rounded-xl border border-amber-500/25 bg-amber-500/[0.05] p-5">
      <h2 className="text-sm font-semibold text-amber-100 flex items-center gap-2">
        <Mail className="w-4 h-4 shrink-0 text-amber-400" /> Add an email to claim slots
      </h2>
      <p className="mt-1.5 text-xs text-gray-400 leading-relaxed">
        Your wallet is your sign-in and that isn't changing. An email is only needed to claim an
        hour — it's what stops one person taking the whole week. Only you will ever see it.
      </p>

      {err && <Notice tone="error" compact className="mt-3">{err}</Notice>}

      <form onSubmit={submit} className="mt-4 grid gap-2.5 sm:grid-cols-[1fr_1fr_auto]">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          disabled={busy}
          className="px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary-500/50"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Create a password"
          required
          minLength={6}
          disabled={busy}
          className="px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary-500/50"
        />
        <Button variant="primary" size="sm" type="submit" isLoading={busy}>Add email</Button>
      </form>
      <p className="mt-2 text-[11px] text-gray-600">
        The password is a second way into this account. We never see it — it goes straight to
        Firebase from your browser.
      </p>
    </section>
  )
}
