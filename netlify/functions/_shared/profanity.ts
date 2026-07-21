// Courtesy profanity / slur filter for holder-submitted, on-air ticker text.
// It is deliberately conservative (word-boundary matched, with light leetspeak
// + spaced-letter normalization) and NOT exhaustive — the real spam deterrent
// is the 5,000,000-CSGN hold + one-per-day gate. Extend BLOCKED as needed.

const BLOCKED = [
  'fuck', 'shit', 'bitch', 'cunt', 'asshole', 'dick', 'pussy', 'bastard', 'slut',
  'whore', 'cock', 'jizz', 'wank', 'twat', 'bollocks',
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'spic', 'chink', 'kike', 'tranny',
  'coon', 'gook', 'wetback', 'beaner',
  'rape', 'rapist', 'pedo', 'pedophile', 'molest', 'kys', 'kill yourself',
]

/** Lowercase, de-leet, strip punctuation, and join spaced-out single letters
 *  (f u c k → fuck) so obvious evasions still trip the word-boundary match. */
function normalize(input: string): string {
  let t = input.toLowerCase()
  t = t
    .replace(/[@4]/g, 'a')
    .replace(/3/g, 'e')
    .replace(/[1!|]/g, 'i')
    .replace(/0/g, 'o')
    .replace(/[5$]/g, 's')
    .replace(/7/g, 't')
  t = t.replace(/[^a-z0-9\s]/g, ' ')
  // collapse runs of single spaced letters into a word
  t = t.replace(/\b(?:[a-z]\s+){2,}[a-z]\b/g, (m) => m.replace(/\s+/g, ''))
  // collapse 3+ repeated chars (fuuuuck → fuuck) so \b matches still land
  t = t.replace(/([a-z])\1{2,}/g, '$1$1')
  return t.replace(/\s+/g, ' ').trim()
}

export function containsProfanity(text: string): boolean {
  const norm = normalize(text)
  return BLOCKED.some((w) => new RegExp(`\\b${w.replace(/\s+/g, '\\s*')}\\b`).test(norm))
}
