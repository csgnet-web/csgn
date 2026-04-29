import { useState } from 'react'
import { PanelShell } from '@/components/menu/PanelShell'
import { openSlots } from '@/data/dummy'

export default function RaceForSlot() {
  const [selected, setSelected] = useState(openSlots[0]?.time ?? '')
  const [submitted, setSubmitted] = useState(false)

  return (
    <PanelShell
      eyebrow="GAME MODE 04"
      title="Race for the Slot"
      subtitle="Audition for an open broadcast slot. Win the call, get on air, build dynasty points."
      badge="OPEN"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Open slots list */}
        <div className="metal-panel rounded-sm p-5 lg:col-span-1">
          <div className="font-display font-black tracking-[0.2em] text-white text-sm mb-3">OPEN SLOTS</div>
          <div className="space-y-2">
            {openSlots.map(s => {
              const active = selected === s.time
              return (
                <button
                  key={s.time}
                  onClick={() => setSelected(s.time)}
                  className={[
                    'w-full text-left rounded-sm p-3 flex items-center justify-between gap-3 transition-all',
                    active ? 'metal-panel-hot' : 'metal-panel hover:border-primary-500/60',
                  ].join(' ')}
                >
                  <div>
                    <div className="scoreboard-digits text-lg text-primary-400">{s.time} ET</div>
                    <div className="font-mono text-[10px] tracking-[0.22em] text-white/55 uppercase mt-0.5">{s.tag}</div>
                  </div>
                  <span className="font-mono text-[10px] tracking-[0.25em] text-white/55 uppercase">{active ? 'SELECTED' : 'OPEN'}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Audition form */}
        <div className="lg:col-span-2 metal-panel rounded-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-mono text-[10px] tracking-[0.3em] text-primary-400 uppercase">AUDITION TAPE</div>
              <div className="font-display font-black text-2xl text-white tracking-[0.04em] uppercase">For Slot {selected || '—'} ET</div>
            </div>
            <span className="font-mono text-[10px] tracking-[0.25em] text-white/50 uppercase">DRAFT MODE</span>
          </div>

          {submitted ? (
            <div className="metal-panel-hot rounded-sm p-6 text-center">
              <div className="font-mono text-[10px] tracking-[0.4em] text-[color:var(--color-live)] uppercase mb-2">SUBMITTED</div>
              <div className="font-display font-black text-2xl tracking-[0.04em] text-white uppercase mb-2">TAPE IN THE QUEUE</div>
              <div className="font-mono text-xs tracking-[0.18em] text-white/65 uppercase">Commissioner will review within 12 hours.</div>
              <button
                onClick={() => setSubmitted(false)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-sm border border-white/20 hover:border-white/50 transition-colors font-display font-black tracking-[0.18em] text-xs text-white/85"
              >
                NEW TAPE
              </button>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={e => {
                e.preventDefault()
                setSubmitted(true)
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="HANDLE" placeholder="@your_handle" />
                <Field label="REAL NAME / BRAND" placeholder="Captain Volatility" />
                <Field label="CATEGORY" placeholder="TRADING / CULTURE / NFTS / PvP" />
                <Field label="STREAM URL (Twitch / X / YT)" placeholder="https://..." />
              </div>
              <div>
                <div className="font-mono text-[10px] tracking-[0.25em] text-white/55 uppercase mb-1">PITCH (1 SENTENCE)</div>
                <textarea
                  rows={3}
                  placeholder="Why this slot is yours."
                  className="w-full bg-black/40 border border-white/10 focus:border-primary-500/60 px-3 py-2 rounded-sm font-mono text-xs text-white outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {['TRADING','CULTURE','NFTS','PvP','CHARTS','DRAMA'].map(t => (
                  <label key={t} className="flex items-center gap-1.5 px-2 py-1 rounded-sm border border-white/15 text-[10px] tracking-[0.2em] uppercase font-mono text-white/70 cursor-pointer hover:border-primary-500/60">
                    <input type="checkbox" className="accent-primary-500" />
                    {t}
                  </label>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <div className="font-mono text-[10px] tracking-[0.22em] text-white/45 uppercase">
                  Submitting locks your tape into Combine queue.
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-sm bg-primary-600 hover:bg-primary-500 transition-colors font-display font-black tracking-[0.22em] text-xs text-white"
                >
                  ▶ SUBMIT TAPE
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </PanelShell>
  )
}

function Field({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <label className="block">
      <div className="font-mono text-[10px] tracking-[0.25em] text-white/55 uppercase mb-1">{label}</div>
      <input
        placeholder={placeholder}
        className="w-full bg-black/40 border border-white/10 focus:border-primary-500/60 px-3 py-2 rounded-sm font-mono text-xs text-white outline-none"
      />
    </label>
  )
}
