interface TwitchLogoProps {
  className?: string
}

export function TwitchLogo({ className = 'w-7 h-7' }: TwitchLogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path fill="currentColor" d="M2 1h20v14l-5 5h-4l-3 3v-3H2z" />
      <rect x="4.5" y="3.5" width="15" height="12" fill="white" />
      <rect x="8.5" y="7.2" width="2" height="5.5" fill="currentColor" />
      <rect x="13.5" y="7.2" width="2" height="5.5" fill="currentColor" />
    </svg>
  )
}
