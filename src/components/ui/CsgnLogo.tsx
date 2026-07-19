/**
 * CsgnLogo — the CSGN brand mark: the heavy forward-leaning wordmark over the
 * red swoosh, vectorized from the network avatar so it renders crisp at any
 * size and composites on any background (the avatar PNG carries a baked-in
 * black square, which would show as a box over gradients and video).
 *
 * Colors are fixed brand values, deliberately not theme-dependent: warm
 * broadcast white for the letters, CSGN red for the swoosh. Size with the
 * `className` height (width follows the viewBox ratio).
 */
export function CsgnLogo({
  className = 'h-12 w-auto',
  title = 'CSGN',
}: {
  className?: string
  title?: string
}) {
  return (
    <svg
      viewBox="0 0 152 64"
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <text
        x="10"
        y="44"
        transform="skewX(-8)"
        fontFamily="'Arial Black', 'Archivo Black', system-ui, sans-serif"
        fontStyle="italic"
        fontWeight="900"
        fontSize="42"
        letterSpacing="-1"
        fill="#f2ede1"
      >
        CSGN
      </text>
      <path d="M6 50 Q 70 52 146 32 Q 66 64 6 50 Z" fill="#ff2346" />
    </svg>
  )
}
