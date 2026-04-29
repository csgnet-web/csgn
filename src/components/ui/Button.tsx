import { forwardRef } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'size'> {
  variant?: Variant
  size?: Size
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-gold-400 to-gold-500 hover:from-gold-300 hover:to-gold-400 ' +
    'text-navy-900 border border-gold-300/60 shadow-lg shadow-gold-500/30 ' +
    'font-bold tracking-widest uppercase',
  secondary:
    'bg-navy-800 border-2 border-gold-500/50 hover:border-gold-400 hover:bg-navy-700 ' +
    'text-gold-400 hover:text-gold-300 font-bold tracking-widest uppercase',
  ghost:
    'hover:bg-navy-800/70 text-gray-300 hover:text-gold-300 ' +
    'border border-transparent hover:border-gold-500/25 font-bold tracking-widest uppercase',
  danger:
    'bg-gradient-to-b from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 ' +
    'text-white border border-red-400/40 shadow-lg shadow-red-700/25 ' +
    'font-bold tracking-widest uppercase',
  gold:
    'bg-gradient-to-b from-gold-400 to-gold-600 hover:from-gold-300 hover:to-gold-500 ' +
    'text-navy-900 font-bold shadow-lg shadow-gold-500/35 ' +
    'border border-gold-300/50 tracking-widest uppercase',
}

const sizes: Record<Size, string> = {
  sm: 'px-4 py-1.5 text-sm gap-1.5',
  md: 'px-6 py-2.5 text-sm gap-2',
  lg: 'px-8 py-3.5 text-base gap-2.5',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', isLoading, leftIcon, rightIcon, children, className = '', disabled, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.02, y: -1 }}
        whileTap={{ scale: 0.97, y: 0 }}
        className={`
          inline-flex items-center justify-center
          transition-all duration-150 cursor-pointer
          disabled:opacity-40 disabled:cursor-not-allowed
          ${variants[variant]} ${sizes[size]} ${className}
        `}
        style={{ borderRadius: '2px' }}
        disabled={isLoading || disabled}
        {...props}
      >
        {isLoading ? (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <>
            {leftIcon}
            {children}
            {rightIcon}
          </>
        )}
      </motion.button>
    )
  }
)
