type Variant = 'default' | 'live' | 'gold' | 'blue' | 'purple' | 'green' | 'red'

interface BadgeProps {
  variant?: Variant
  children: React.ReactNode
  pulse?: boolean
  className?: string
}

const variants: Record<Variant, string> = {
  default: 'bg-navy-700 text-gray-300 border-navy-500/50',
  live:    'bg-field-600/30 text-field-300 border-field-500/50',
  gold:    'bg-gold-500/20 text-gold-400 border-gold-500/40',
  blue:    'bg-navy-600/60 text-navy-200 border-navy-400/50',
  purple:  'bg-accent-500/20 text-accent-400 border-accent-500/30',
  green:   'bg-field-500/20 text-field-300 border-field-500/40',
  red:     'bg-red-500/20 text-red-300 border-red-500/40',
}

export function Badge({ variant = 'default', children, pulse, className = '' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-3 py-0.5
        text-xs font-bold tracking-widest uppercase
        border ${variants[variant]} ${className}
      `}
      style={{ borderRadius: '2px' }}
    >
      {pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
        </span>
      )}
      {children}
    </span>
  )
}
