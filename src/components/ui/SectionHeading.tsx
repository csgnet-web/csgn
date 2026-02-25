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
      transition={{ duration: 0.6 }}
      className={`max-w-3xl ${center ? 'mx-auto text-center' : ''} mb-16`}
    >
      {badge && (
        <span className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary-400 bg-primary-500/10 border border-primary-500/20 rounded-full mb-4">
          {badge}
        </span>
      )}
      <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold font-display tracking-tight text-white">
        {title}{' '}
        {highlight && <span className="text-gradient">{highlight}</span>}
      </h2>
      {description && (
        <p className="mt-4 text-lg text-gray-400 leading-relaxed">{description}</p>
      )}
    </motion.div>
  )
}
