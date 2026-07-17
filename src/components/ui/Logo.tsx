import { Link } from 'react-router-dom'

// Local vector twin of the network avatar (black square + wordmark + swoosh) —
// served from public/ so the mark never depends on Twitter's CDN staying up.
const LOGO_URL = '/csgn-logo.svg'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  showTagline?: boolean
  className?: string
  linkTo?: string
}

/** Standalone image mark — use wherever you need just the icon */
export function CSGNMark({ className = 'w-9 h-9' }: { className?: string }) {
  return (
    <img
      src={LOGO_URL}
      alt="CSGN"
      className={`${className} rounded-xl object-cover`}
    />
  )
}

/** Full logo: image mark + wordmark */
export function Logo({
  size = 'md',
  showText = true,
  showTagline = false,
  className = '',
  linkTo = '/',
}: LogoProps) {
  const iconSize = { sm: 'w-8 h-8', md: 'w-9 h-9', lg: 'w-12 h-12' }[size]
  const textSize = { sm: 'text-base', md: 'text-[17px]', lg: 'text-2xl' }[size]

  return (
    <Link to={linkTo} className={`flex items-center gap-2.5 group ${className}`}>
      <img
        src={LOGO_URL}
        alt="CSGN Logo"
        className={`${iconSize} rounded-xl object-cover shrink-0 transition-all duration-300 group-hover:shadow-[0_0_14px_rgba(255,35,70,0.55)]`}
      />
      {showText && (
        <div className="flex flex-col">
          <span className={`font-display font-black ${textSize} tracking-tight text-white leading-none`}>
            CSGN
          </span>
          {showTagline && (
            <div className="flex flex-col mt-[2px]">
              <span className="text-[13px] sm:text-[15px] font-black tracking-[0.12em] uppercase leading-none text-white/90">
                CRYPTO SPORTS &
              </span>
              <span className="text-[13px] sm:text-[15px] font-black tracking-[0.12em] uppercase leading-none text-white/90 mt-[2px]">
                GAMING NETWORK
              </span>
            </div>
          )}
        </div>
      )}
    </Link>
  )
}
