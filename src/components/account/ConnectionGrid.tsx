import type { ReactNode } from 'react'
import { X } from 'lucide-react'

interface ConnectionItem {
  id: string
  label: string
  connected: boolean
  username?: string
  icon: ReactNode
  onConnect?: () => void
  onDisconnect?: () => void
  loading?: boolean
}

export function ConnectionGrid({ items }: { items: ConnectionItem[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((item) => (
        <div key={item.id} className="space-y-1.5">
          <button
            type="button"
            onClick={() => !item.connected && item.onConnect?.()}
            className={`relative w-full h-20 rounded-xl border transition-colors flex items-center justify-center ${
              item.connected
                ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
            } ${item.loading ? 'opacity-60 cursor-wait' : ''}`}
            disabled={item.loading}
            title={item.connected ? `${item.label} connected` : `Connect ${item.label}`}
          >
            {item.connected && item.onDisconnect && (
              <span
                className="absolute top-1.5 right-1.5 text-white/70 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation()
                  item.onDisconnect?.()
                }}
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
            {item.icon}
          </button>
          <p className="text-center text-xs text-gray-400 min-h-4">
            {item.connected ? item.username || 'Connected' : 'Not connected'}
          </p>
        </div>
      ))}
    </div>
  )
}
