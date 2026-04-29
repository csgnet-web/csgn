import { motion, type HTMLMotionProps } from 'framer-motion'

interface CardProps extends HTMLMotionProps<'div'> {
  glow?: boolean
  hover?: boolean
  accent?: 'gold' | 'green' | 'none'
}

export function Card({ glow, hover = true, accent = 'gold', children, className = '', ...props }: CardProps) {
  const accentBorder = {
    gold:  'border-t-gold-500',
    green: 'border-t-field-500',
    none:  'border-t-transparent',
  }[accent]

  return (
    <motion.div
      whileHover={hover ? { y: -2, boxShadow: '0 8px 32px -8px rgba(255,179,0,0.25)' } : undefined}
      className={`
        relative bg-gradient-to-b from-navy-800 to-navy-900
        border border-gold-500/10 border-t-2 ${accentBorder}
        ${glow ? 'animate-card-glow' : ''}
        ${hover ? 'transition-all duration-300 hover:border-gold-500/20' : ''}
        ${className}
      `}
      style={{ borderRadius: '2px' }}
      {...props}
    >
      {children}
    </motion.div>
  )
}
