import { Link } from 'react-router-dom'

const LOGO_URL = 'https://pbs.twimg.com/profile_images/1966988305255276544/3Qz3tNAa_200x200.jpg'

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
            <span className="text-[9.5px] text-gray-500 tracking-[0.18em] uppercase leading-none mt-[3px]">
              Crypto Sports &amp; Gaming
            </span>
          )}
        </div>
      )}
    </Link>
  )
}
