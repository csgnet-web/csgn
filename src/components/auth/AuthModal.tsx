import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Mail, Wallet, X } from 'lucide-react'
import { useAuth } from '@/contexts/useAuth'
import { api } from '@/lib/api'
import { getPhantomProvider, usePhantomWallet } from '@/hooks/usePhantomWallet'
import { CsgnLogo } from '@/components/ui/CsgnLogo'
import { suggestUsername } from '@/lib/username'
import { isEmbeddedBrowser, openInSystemBrowser, systemBrowserName } from '@/lib/webview'

/**
 * SIGN IN OR SIGN UP — one sheet, four doors, no fork.
 *
 * ── What this replaced, and why ────────────────────────────────────────────
 *
 * The old modal was a wallet-first funnel: connect Phantom, approve a
 * signature, pass an on-chain history check, pick a name. Good for a crypto
 * native and a locked door for everyone else — a person with no wallet could
 * not create an account AT ALL, which put the entire non-crypto creator market
 * on the wrong side of the product.
 *
 * ── The rules this screen follows ──────────────────────────────────────────
 *
 * 1. NO SIGN-IN / SIGN-UP CHOICE. The provider already knows whether this
 *    person has been here. Asking a stranger to pick the right button first is
 *    asking them to know something we know.
 * 2. NO WALLET REQUIRED. It is offered, because holders want it and it is where
 *    fees land — but it is one option among four, not the gate.
 * 3. NO PASSWORD. Google, X and an email link. Nothing to invent, nothing to
 *    forget, nothing to leak.
 * 4. ONE SCREEN. Every extra step here costs people, and the things we used to
 *    ask for (a username, a Twitch channel) are either derivable or only needed
 *    later — so they are asked for later, in context.
 */

interface AuthModalProps { isOpen: boolean; onClose: () => void; initialMode?: 'login' | 'signup' }

/** Brand marks drawn inline. Two SVGs beat a dependency, and these two never
 *  change — a wrong-coloured Google "G" is the fastest way to look untrustworthy
 *  on the one screen where trust is the entire ask. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="w-5 h-5" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

function XMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

/** One door. Same height, same weight, same distance from the eye — because
 *  making one of them look like the "real" one is how you end up back with a
 *  wallet-first funnel wearing a different coat. */
function Door({
  icon, label, onClick, busy, disabled,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  busy?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-white/[0.09] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.14] transition-colors text-left disabled:opacity-50 disabled:cursor-wait cursor-pointer"
    >
      <span className="w-10 h-10 shrink-0 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
        {busy ? <Loader2 className="w-4 h-4 text-gray-400 animate-spin" /> : icon}
      </span>
      <span className="text-[15px] font-medium text-white">{label}</span>
    </button>
  )
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const {
    signInWithGoogle, signInWithX, sendEmailLink,
    signUpWithPhantom, signInWithPhantom, refreshProfile,
  } = useAuth()
  const { connect, signMessage } = usePhantomWallet()

  const [pending, setPending] = useState<'google' | 'x' | 'wallet' | 'email' | null>(null)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)

  // Reset on CLOSE rather than in an effect on `isOpen`: the effect version
  // writes state during render-commit and the modal is unmounted a moment later
  // anyway, so the work was never seen.
  const close = () => {
    setPending(null); setError(''); setEmail(''); setEmailSent(false)
    onClose()
  }

  // Escape closes, like every other sheet on the site.
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  if (!isOpen) return null

  const run = async (key: 'google' | 'x' | 'wallet' | 'email', fn: () => Promise<void>) => {
    setPending(key)
    setError('')
    try {
      await fn()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Try again.'
      // Firebase's raw codes are not sentences a person can act on.
      setError(
        message.includes('popup-closed-by-user') || message.includes('cancelled-popup-request')
          ? ''
          : message.includes('account-exists-with-different-credential')
            ? 'You already have an account using a different sign-in. Use that one and you can link this after.'
            : message.includes('operation-not-allowed')
              ? 'That sign-in method is not switched on for this site yet.'
              : message,
      )
    }
    setPending(null)
  }

  /**
   * The wallet door. Still the fastest route for a holder, and the only one
   * that arrives already able to be PAID — so it stays, just not as the gate.
   * Tries sign-in first: `loginWithPhantom` 404s for an unknown wallet without
   * creating anything, so we branch on the answer rather than asking the user
   * which they meant.
   */
  const continueWithWallet = () => run('wallet', async () => {
    if (!getPhantomProvider()) {
      if (isEmbeddedBrowser()) {
        openInSystemBrowser(window.location.href)
        throw new Error(`Opening in ${systemBrowserName()} — your wallet can sign there.`)
      }
      throw new Error('No Phantom wallet found on this device. Use Google, X or email instead.')
    }
    // connect() and signMessage() both answer null when the user declines or
    // the provider vanishes mid-flow; neither is an error worth a stack trace.
    const address = await connect()
    if (!address) throw new Error('Wallet connection was cancelled.')
    const challenge = await api.createPhantomChallenge(address)
    const signature = await signMessage(challenge.message)
    if (!signature) throw new Error('Signature was cancelled.')
    const verified = await api.verifyPhantomSignature(address, signature, challenge.challengeToken)
    try {
      await signInWithPhantom(verified.proofToken)
    } catch {
      // No account for this wallet yet — make one, with a derived handle.
      await signUpWithPhantom(suggestUsername(address), { phantomProofToken: verified.proofToken })
    }
    await refreshProfile()
    close()
  })

  const submitEmail = () => run('email', async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Enter a valid email address.')
    await sendEmailLink(email.trim())
    setEmailSent(true)
  })

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-default"
      />

      <div className="relative w-full sm:max-w-md bg-[#080a0f] border border-white/[0.08] rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Grab handle — the sheet is draggable-looking on a phone, which is
            what a phone user expects a bottom sheet to be. */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="hidden sm:flex absolute right-4 top-4 w-8 h-8 items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/5 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="px-6 pb-8 pt-6 sm:pt-10">
          <div className="flex justify-center">
            <CsgnLogo className="h-8 w-auto" />
          </div>

          <h2 className="mt-8 text-center text-2xl sm:text-3xl font-bold text-white">
            Sign in or sign up
          </h2>

          {emailSent ? (
            <div className="mt-8 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center mx-auto">
                <Mail className="w-5 h-5 text-emerald-400" />
              </div>
              <p className="mt-4 text-sm text-white font-medium">Check your email</p>
              <p className="mt-2 text-xs text-gray-400 leading-relaxed">
                We sent a sign-in link to <span className="text-gray-200 font-mono">{email}</span>.
                Open it on this device and you're in — there's no password to make.
              </p>
              <button
                type="button"
                onClick={() => { setEmailSent(false); setEmail('') }}
                className="mt-4 text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2 cursor-pointer"
              >
                Use a different address
              </button>
            </div>
          ) : (
            <>
              <div className="mt-8 space-y-3">
                <Door
                  icon={<GoogleMark />}
                  label="Continue with Google"
                  busy={pending === 'google'}
                  disabled={pending !== null}
                  onClick={() => run('google', async () => { await signInWithGoogle(); close() })}
                />
                <Door
                  icon={<XMark />}
                  label="Continue with X"
                  busy={pending === 'x'}
                  disabled={pending !== null}
                  onClick={() => run('x', async () => { await signInWithX(); close() })}
                />
                <Door
                  icon={<Wallet className="w-4 h-4 text-gray-300" />}
                  label="Continue with wallet"
                  busy={pending === 'wallet'}
                  disabled={pending !== null}
                  onClick={continueWithWallet}
                />

                {/* Email sits last and looks like the others, because it is the
                    others: one field, one tap, a link back. */}
                <div className="w-full flex items-center gap-3 pl-4 pr-2 py-2 rounded-xl border border-white/[0.09] bg-white/[0.02] focus-within:border-white/[0.18] transition-colors">
                  <span className="w-10 h-10 shrink-0 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                    <Mail className="w-4 h-4 text-gray-300" />
                  </span>
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitEmail() }}
                    placeholder="your@email.com"
                    disabled={pending !== null}
                    className="flex-1 min-w-0 bg-transparent text-[15px] text-white placeholder-gray-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={submitEmail}
                    disabled={pending !== null || !email.trim()}
                    className="shrink-0 px-3 py-2 text-sm font-medium text-gray-400 hover:text-white disabled:opacity-40 disabled:hover:text-gray-400 cursor-pointer"
                  >
                    {pending === 'email' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit'}
                  </button>
                </div>
              </div>

              {error && (
                <p className="mt-4 text-center text-xs text-red-300 leading-relaxed">{error}</p>
              )}

              <p className="mt-6 text-center text-[11px] text-gray-500 leading-relaxed">
                No wallet needed to watch, post a clip or claim a block.
                You'll be asked for one when you've actually earned fees.
              </p>
            </>
          )}

          <p className="mt-8 text-center text-[11px] text-gray-600">
            <Link to="/terms" onClick={close} className="hover:text-gray-400 underline underline-offset-2">Terms of Service</Link>
            <span className="mx-1.5">·</span>
            <Link to="/privacy" onClick={close} className="hover:text-gray-400 underline underline-offset-2">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default AuthModal
