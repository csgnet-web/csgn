import { Link } from 'react-router-dom'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  showTagline?: boolean
  className?: string
  linkTo?: string
}

export function CSGNMark({ className = 'w-9 h-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="markGradA" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ff2346" />
          <stop offset="55%" stopColor="#ff5e1a" />
          <stop offset="100%" stopColor="#ffb020" />
        </linearGradient>
        <filter id="markGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Background */}
      <rect width="44" height="44" rx="11" fill="#0b0b17" />
      <rect x="0.75" y="0.75" width="42.5" height="42.5" rx="10.25" stroke="url(#markGradA)" strokeWidth="1.5" strokeOpacity="0.65" />

      {/* Broadcast signal arcs */}
      <path d="M13 30 C13 21 17 15 22 15" stroke="url(#markGradA)" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.45" />
      <path d="M31 30 C31 21 27 15 22 15" stroke="url(#markGradA)" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.45" />
      <path d="M16.5 32 C16.5 24 18.8 19 22 19" stroke="url(#markGradA)" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.7" />
      <path d="M27.5 32 C27.5 24 25.2 19 22 19" stroke="url(#markGradA)" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.7" />

      {/* Center broadcast dot */}
      <circle cx="22" cy="32" r="3.5" fill="url(#markGradA)" filter="url(#markGlow)" />
      <circle cx="22" cy="32" r="1.8" fill="white" fillOpacity="0.9" />
    </svg>
  )
}

export function Logo({ size = 'md', showText = true, showTagline = false, className = '', linkTo = '/' }: LogoProps) {
  const iconSize = { sm: 'w-8 h-8', md: 'w-9 h-9', lg: 'w-12 h-12' }[size]
  const textSize = { sm: 'text-base', md: 'text-[17px]', lg: 'text-2xl' }[size]

  return (
    <Link to={linkTo} className={`flex items-center gap-2.5 group ${className}`}>
      <CSGNMark className={`${iconSize} transition-all duration-300 group-hover:drop-shadow-[0_0_10px_rgba(255,35,70,0.55)]`} />
      {showText && (
        <div className="flex flex-col">
          <span className={`font-display font-black ${textSize} tracking-tight text-white leading-none`}>CSGN</span>
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
