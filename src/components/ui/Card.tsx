import { motion, type HTMLMotionProps } from 'framer-motion'

interface CardProps extends HTMLMotionProps<'div'> {
  glow?: boolean
  hover?: boolean
}

export function Card({ glow, hover = true, children, className = '', ...props }: CardProps) {
  return (
    <motion.div
      whileHover={hover ? { y: -2 } : undefined}
      className={`
        relative rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm
        ${hover ? 'transition-all duration-300 hover:bg-white/[0.05] hover:border-white/[0.12]' : ''}
        ${glow ? 'glow-blue' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </motion.div>
  )
}
