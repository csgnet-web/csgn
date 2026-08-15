import { useState } from 'react'
import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react'

/**
 * What an in-app browser sees instead of a broken Twitch login.
 *
 * The user is inside Phantom (or X, or Instagram) where Twitch's "Continue with
 * Google / Apple / Amazon" buttons return "Something went wrong" by design —
 * identity providers refuse to authenticate in an embedded webview. So we stop
 * pretending the hop can happen here and hand them a door out, with three
 * things on it that all matter:
 *
 *  1. A real tap target, because a scheme handoff works far more reliably from
 *     a user gesture than from a scripted navigation.
 *  2. A visible copy fallback, because `x-safari-https://` is an undocumented
 *     Apple scheme and when a host app declines it, NOTHING happens on screen.
 *     Without a second route that is a dead end with no error message.
 *  3. A live "waiting" state, because the whole promise is that they don't have
 *     to come back and do anything — this panel fills itself in.
 */
export function TwitchHandoffPanel({
  href,
  rawUrl,
  browserName,
  onCancel,
}: {
  href: string
  rawUrl: string
  browserName: string
  onCancel: () => void
}) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(rawUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Clipboard is permission-gated in some webviews. Selecting the URL below
      // still works, which is why it is rendered as text and not hidden.
      setCopied(false)
    }
  }

  return (
    <div className="rounded-xl border border-[#9146FF]/30 bg-[#9146FF]/[0.07] p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-white">Finish in {browserName}</p>
        <p className="text-xs text-gray-400 leading-relaxed mt-1">
          Twitch's sign-in doesn't work inside in-app browsers — that's Twitch and Google's rule,
          not ours. Open it in {browserName}, where you're probably already signed in, and this
          page updates itself. Nothing here is lost.
        </p>
      </div>

      <a
        href={href}
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 h-12 rounded-xl bg-[#9146FF] hover:bg-[#a970ff] text-white text-sm font-bold transition-colors"
      >
        <ExternalLink className="w-4 h-4" aria-hidden />
        Open Twitch in {browserName}
      </a>

      <button
        type="button"
        onClick={copy}
        className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-medium transition-colors cursor-pointer"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden /> : <Copy className="w-3.5 h-3.5" aria-hidden />}
        {copied ? 'Link copied — paste it in ' + browserName : 'Copy the link instead'}
      </button>

      <div className="flex items-center gap-2 text-xs text-gray-400" role="status" aria-live="polite">
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
        Waiting for Twitch… come back to this screen when you're done.
      </div>

      <button
        type="button"
        onClick={onCancel}
        className="w-full text-[11px] text-gray-500 hover:text-gray-300 underline cursor-pointer"
      >
        Skip Twitch for now
      </button>
    </div>
  )
}
