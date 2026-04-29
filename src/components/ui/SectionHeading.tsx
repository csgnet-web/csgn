import { motion } from 'framer-motion'

interface SectionHeadingProps {
  badge?: string
  title: string
  highlight?: string
  description?: string
  center?: boolean
}

export function SectionHeading({ badge, title, highlight, description, center = true }: SectionHeadingProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className={`max-w-3xl ${center ? 'mx-auto text-center' : ''} mb-16`}
    >
      {badge && (
        <span
          className="inline-flex items-center gap-2 px-3 py-1 mb-4
            text-[11px] font-bold tracking-[0.3em] uppercase
            text-gold-400 bg-gold-500/10 border border-gold-500/30"
          style={{ borderRadius: '2px' }}
        >
          {/* hash-mark decoration */}
          <span className="w-3 h-px bg-gold-500/60" />
          {badge}
          <span className="w-3 h-px bg-gold-500/60" />
        </span>
      )}

      {/* Yard-line rule above heading */}
      <div className="flex items-center gap-3 mb-3" style={{ justifyContent: center ? 'center' : 'flex-start' }}>
        <span className="h-[3px] w-8 bg-gold-500" />
        <span className="h-px w-4 bg-gold-500/40" />
      </div>

      <h2
        className="text-3xl md:text-4xl lg:text-5xl font-bold uppercase tracking-wide text-white"
        style={{ fontFamily: "'Oswald', system-ui, sans-serif", letterSpacing: '0.06em' }}
      >
        {title}{' '}
        {highlight && <span className="text-gradient">{highlight}</span>}
      </h2>

      {description && (
        <p className="mt-4 text-lg text-gray-400 leading-relaxed" style={{ fontFamily: "'Barlow Condensed', system-ui, sans-serif" }}>
          {description}
        </p>
      )}
    </motion.div>
  )
}
