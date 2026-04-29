export function LiveIndicator({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-field-400 opacity-80" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-field-500" />
      </span>
      <span
        className="text-[10px] font-bold tracking-[0.25em] uppercase text-field-400"
        style={{ fontFamily: "'Share Tech Mono', monospace" }}
      >
        Live
      </span>
    </span>
  )
}
