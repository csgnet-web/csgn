// Collapsible "decided history" ledger shared by Creator Fees and Vote History.
//
// The admin panel's job is to surface what still needs a decision. Anything
// already decided is archive: it stays reachable, but it collapses into
// day/week/month buckets so it never competes with the live queue for attention.
import { useState, type ReactNode } from 'react'
import { ChevronRight, History } from 'lucide-react'
import { groupByPeriod, HISTORY_PERIODS, type HistoryPeriod } from '@/lib/history'
import { Card } from '@/components/ui/Card'

const PERIOD_LABEL: Record<HistoryPeriod, string> = { day: 'Day', week: 'Week', month: 'Month' }

interface HistoryLedgerProps<T> {
  title: string
  items: T[]
  /** When each item was decided — drives which bucket it lands in. */
  at: (item: T) => string | Date | number
  keyOf: (item: T) => string
  renderItem: (item: T) => ReactNode
  /** Optional right-aligned roll-up for a bucket, e.g. total SOL paid. */
  summary?: (items: T[]) => ReactNode
  emptyLabel?: string
  /** Buckets past this many stay collapsed on first render. */
  openCount?: number
  defaultPeriod?: HistoryPeriod
}

export function HistoryLedger<T>({
  title, items, at, keyOf, renderItem, summary, emptyLabel = 'Nothing here yet.', openCount = 1, defaultPeriod = 'day',
}: HistoryLedgerProps<T>) {
  const [period, setPeriod] = useState<HistoryPeriod>(defaultPeriod)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const groups = groupByPeriod(items, period, at)

  const isOpen = (key: string, index: number) => (key in collapsed ? !collapsed[key] : index < openCount)
  const toggle = (key: string, index: number) =>
    setCollapsed((prev) => ({ ...prev, [key]: isOpen(key, index) }))

  return (
    <Card hover={false} className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-white/[0.06]">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-300">
          <History className="w-4 h-4 text-gray-500" />
          {title}
          <span className="text-gray-500 font-normal">({items.length})</span>
        </h3>
        <div className="flex items-center gap-1 rounded-lg bg-white/[0.04] p-0.5">
          {HISTORY_PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                period === p ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="px-4 sm:px-5 py-8 text-center text-sm text-gray-500">{emptyLabel}</p>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {groups.map((group, index) => {
            const open = isOpen(group.key, index)
            return (
              <div key={group.key}>
                <button
                  onClick={() => toggle(group.key, index)}
                  className="w-full flex flex-wrap items-center gap-x-2 gap-y-1 px-4 sm:px-5 py-2.5 text-left hover:bg-white/[0.03] transition-colors cursor-pointer"
                >
                  <ChevronRight className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
                  <span className="text-sm font-medium text-white">{group.label}</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-white/[0.07] text-[11px] text-gray-400 leading-none">{group.items.length}</span>
                  {/* Rolls onto its own line on narrow screens instead of squeezing the label. */}
                  <span className="w-full pl-6 sm:w-auto sm:pl-0 sm:ml-auto text-xs text-gray-400 sm:text-right">{summary?.(group.items)}</span>
                </button>
                {open && <div className="divide-y divide-white/[0.04] border-t border-white/[0.04]">{group.items.map((item) => (
                  <div key={keyOf(item)}>{renderItem(item)}</div>
                ))}</div>}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

export default HistoryLedger
