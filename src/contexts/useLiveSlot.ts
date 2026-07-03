import { useContext } from 'react'
import { LiveSlotContext, type LiveSlotContextValue } from './LiveSlotContextCore'

export function useLiveSlot(): LiveSlotContextValue {
  return useContext(LiveSlotContext)
}
