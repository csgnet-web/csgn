import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, FileText, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/useAuth'
import { api } from '@/lib/api'
import { TOS_VERSION } from '@/lib/tos'

interface TosAcceptPromptProps {
  isOpen: boolean
  onClose: () => void
  onAccepted: () => void
}

// Prompts an existing logged-in user (created before the ToS gate) to accept the
// Terms of Service before they can claim a slot. On accept it records acceptance
// server-side, refreshes the profile, then hands control back to the caller.
export function TosAcceptPrompt({ isOpen, onClose, onAccepted }: TosAcceptPromptProps) {
  const { refreshProfile } = useAuth()
  const [checked, setChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleClose = () => { if (submitting) return; setChecked(false); setError(''); onClose() }

  const handleAccept = async () => {
    if (!checked) return
    setSubmitting(true); setError('')
    try {
      await api.acceptTos()
      await refreshProfile()
      setChecked(false)
      onAccepted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record acceptance. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md bg-[#0c0c1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-6">
              <button onClick={handleClose} disabled={submitting} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5 cursor-pointer disabled:opacity-50"><X className="w-5 h-5" /></button>
              <div className="w-12 h-12 rounded-xl bg-primary-500/15 border border-primary-500/30 flex items-center justify-center mb-4"><FileText className="w-6 h-6 text-primary-400" /></div>
              <h2 className="text-2xl font-bold font-display text-white">Accept the Terms</h2>
              <p className="text-sm text-gray-400 mt-1">Before claiming a slot, please review and accept our Terms of Service.</p>
              <div className="mt-5 space-y-4">
                {error && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-300"><AlertCircle className="w-4 h-4 shrink-0" /> {error}</div>}
                <label className="flex items-start gap-2.5 text-sm text-gray-300 cursor-pointer select-none">
                  <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} disabled={submitting} className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-white/5 text-primary-500 focus:ring-primary-500/50 cursor-pointer" />
                  <span>I agree to the{' '}<a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:text-primary-300 underline">Terms of Service</a>{' '}<span className="text-gray-500">(v{TOS_VERSION})</span>.</span>
                </label>
                <Button variant="primary" size="lg" className="w-full" type="button" onClick={handleAccept} isLoading={submitting} disabled={!checked}>Accept &amp; Continue</Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
