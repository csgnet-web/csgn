type Variant = 'default' | 'live' | 'gold' | 'blue' | 'purple' | 'green' | 'red'

interface BadgeProps {
  variant?: Variant
  children: React.ReactNode
  pulse?: boolean
  className?: string
}

const variants: Record<Variant, string> = {
  default: 'bg-white/10 text-gray-300 border-white/10',
  live: 'bg-red-500/20 text-red-400 border-red-500/30',
  gold: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  blue: 'bg-primary-500/20 text-primary-400 border-primary-500/30',
  purple: 'bg-accent-500/20 text-accent-400 border-accent-500/30',
  green: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  red: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export function Badge({ variant = 'default', children, pulse, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${variants[variant]} ${className}`}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
        </span>
      )}
      {children}
    </span>
  )
}
