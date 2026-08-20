/**
 * WHAT CAME IN THROUGH THE SHARE SHEET.
 *
 * Android's Web Share Target hands over three loosely-defined fields — title,
 * text, url — and every app fills them differently. The one thing you cannot do
 * is trust `url` to be the URL:
 *
 *   • Instagram usually puts the whole thing in `text`, as
 *     "Check this out https://www.instagram.com/reel/ABC/?igsh=…", and leaves
 *     `url` empty.
 *   • TikTok puts a caption in `text` with the link at the END of it.
 *   • X sends `url` properly, and repeats it inside `text`.
 *   • Some launchers send the lot in `title`.
 *
 * So the rule is: look in every field, take the first http(s) URL you find, and
 * treat whatever is left as a possible title. Pure and unit-tested, because the
 * failure mode — "you shared a clip and CSGN said it couldn't find a link" — is
 * the one thing that would make somebody never use the share sheet again.
 */

/** Sender-supplied fields, exactly as they arrive in the query string. */
export interface SharePayload {
  title?: string | null
  text?: string | null
  url?: string | null
}

export interface ParsedShare {
  /** The link to submit, or '' when the share carried no usable one. */
  url: string
  /** A title to pre-fill, when there was one worth keeping. */
  title: string
  /** True when SOMETHING was shared — used to tell "opened /share directly"
   *  apart from "the share sheet handed us something we couldn't read". */
  hadContent: boolean
}

// Trailing punctuation is stripped because a URL at the end of a sentence
// arrives with the sentence's full stop or closing bracket welded on.
const URL_RE = /https?:\/\/[^\s<>"']+/i
const TRAILING = /[.,;:!?)\]}'"]+$/

/** The first http(s) URL anywhere in a string, cleaned of trailing punctuation. */
export function firstUrl(value: string | null | undefined): string {
  const match = URL_RE.exec(String(value ?? ''))
  if (!match) return ''
  return match[0].replace(TRAILING, '')
}

/** Everything that is NOT the URL, tidied — the caption, usually. */
function withoutUrl(value: string | null | undefined): string {
  return String(value ?? '').replace(URL_RE, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Turn a share-sheet payload into a link and a title.
 *
 * Field order matters: `url` first because when an app fills it, it is right;
 * then `text`, which is where Instagram and TikTok actually put it; then
 * `title` as a last resort.
 */
export function parseShare(payload: SharePayload): ParsedShare {
  const hadContent = Boolean(
    String(payload.url ?? '').trim() || String(payload.text ?? '').trim() || String(payload.title ?? '').trim(),
  )

  const url = firstUrl(payload.url) || firstUrl(payload.text) || firstUrl(payload.title) || ''

  // A title is only worth keeping if it is prose rather than the URL again.
  // Instagram's caption lives in `text`; `title` is usually the app name or
  // empty, so `text` is preferred when both have something to say.
  const fromText = withoutUrl(payload.text)
  const fromTitle = withoutUrl(payload.title)
  const title = (fromText || fromTitle).slice(0, 80)

  return { url, title, hadContent }
}

/** Read a share out of a location's query string. */
export function parseShareSearch(search: string): ParsedShare {
  const q = new URLSearchParams(search)
  return parseShare({ title: q.get('title'), text: q.get('text'), url: q.get('url') })
}
