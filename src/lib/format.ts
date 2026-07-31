/**
 * Display formatting shared by every surface that renders money.
 *
 * These used to be copy-pasted per component (the $CSGN sidebar panel, the
 * on-air intermission board, the treasury balance sheet), which meant the same
 * price could render three different ways depending on which surface a viewer
 * looked at — and the OBS board is composited next to the site in clips, so the
 * disagreement was visible. One module, one answer, unit-tested.
 */

/** Compact money/notation formatter — 1.2M, 843.5K. */
const compactFormatter = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 })

/** `1234567 → "1.23M"`. Plain number, no currency symbol. */
export function compact(value: number): string {
  return compactFormatter.format(value)
}

/** `1234567 → "$1.23M"`, or the em-dash placeholder when there's nothing to show. */
export function compactUsd(value: number | null | undefined): string {
  return value ? `$${compact(value)}` : '—'
}

/**
 * Price with precision that scales to the magnitude — a memecoin trading at
 * $0.0000034 and SOL at $184.20 both have to read correctly from the same
 * function. Above $1 → 2 decimals; down to a cent → 4; below that, enough
 * significant digits to show the value instead of a row of zeros.
 * Non-positive (or missing) prices render the em-dash placeholder.
 */
export function formatPrice(price: number | null | undefined): string {
  if (!price || price <= 0) return '—'
  if (price >= 1) return `$${price.toFixed(2)}`
  if (price >= 0.01) return `$${price.toFixed(4)}`
  return `$${Number(price.toPrecision(3)).toFixed(Math.max(0, -Math.floor(Math.log10(price)) + 2))}`
}
