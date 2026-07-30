/* eslint-disable @typescript-eslint/no-explicit-any, no-empty */
import { useState, useEffect, useCallback, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Shield, Users, Radio, Clock, X,
  BarChart3, Plus, Crown,
  Trash2, UserCheck, AlertTriangle, Tv, DollarSign,
  Wallet, CheckCircle2, XCircle, RefreshCw, Link as LinkIcon, ExternalLink, Monitor, Activity,
  Megaphone, Flame, Vote,
} from 'lucide-react'
import {
  collection, query, getDocs, doc, setDoc, onSnapshot, orderBy,
  limit,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { api } from '@/lib/api'
import { Modal } from '@/components/ui/Modal'
import { logAuthEvent } from '@/lib/authEvents'
import { useAuth } from '@/contexts/useAuth'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import TickerControlsCard from '@/components/admin/TickerControlsCard'
import { CreatorFeesTab } from '@/components/admin/CreatorFeesTab'
import { VoteHistoryTab } from '@/components/admin/VoteHistoryTab'
import { isVoteOpen, type VoteRecord } from '@/lib/votes'
import { PUMP_FUN_FEE_TIERS, estimateCreatorFeeSOL, formatTierRange, resolvePumpFeeTier } from '@/lib/dexscreener'
import { parseXPostId, isBroadcastUrl } from '@/lib/xembed'
import {
  appendNextThreeDays,
  wipeAndRegenerateSlots,
  syncSevenDaysFrom,
  reseedNextSevenDays,
  reseedNextYear,
  SLOTS_PER_DAY,
  fetchSlots,
  assignNetworkSlot,
  assignmentStatus,
  buildTwitchStreamUrl,
  assignSlot,
  updateSlotStreamUrl,
  updateSlotStatus,
  updateSlot,
  deleteSlot,
  acceptSlotRequest,
  declineSlotRequest,
  updateCreatorFees,
  markFeesPaid,
  declineFeesPayment,
  formatESTRange,
  isNetworkSlot,
  isFeePending,
  SLOT_STATUSES,
  DEFAULT_STREAM_URL,
  type Slot,
  type SlotType,
  type SlotStatus,
  type CreatorFees,
} from '@/lib/slots'

type Tab = 'overview' | 'streamers' | 'schedule' | 'fees' | 'votes' | 'auth'

interface AuthEventData {
  id: string
  kind: string
  ts: unknown
  uid: string | null
  twitchUsername: string | null
  errorMessage: string | null
  ua: string | null
}

/** Pull the Twitch login out of a stored stream URL (empty for a non-Twitch URL). */
function twitchHandleFromUrl(url?: string): string {
  const m = String(url || '').match(/twitch\.tv\/([^/?#]+)/i)
  return m ? m[1].replace(/^@/, '') : ''
}

interface UserData {
  uid: string
  displayName: string
  email: string
  role: string
  walletAddress?: string
  /** Linked Twitch login, used to auto-fill the assign modal. */
  twitchUsername?: string
  createdAt: any
}

// ── Broadcast ticker (config/ticker) ──
// The OBS ticker overlay (docs/obs/csgn-ticker.html) polls this doc over the
// public Firestore REST API roughly once a minute, so edits here reach the
// broadcast within ~60s without touching OBS.

interface TickerHeadline {
  tag: string
  text: string
}

interface TickerSpotlight {
  symbol: string
  coingeckoId?: string
  dexPair?: string
  dexChain?: string
  note?: string
  updatedAt?: string
}

const MAX_RIGHT_NOW_ITEMS = 8
const DEFAULT_RIGHT_NOW_TAG = 'RIGHT NOW'

/** One headline per line; optional `TAG | text` prefix (no pipe = RIGHT NOW). */
const parseRightNowLines = (raw: string): TickerHeadline[] =>
  raw
    .split('\n')
    .map((line): TickerHeadline | null => {
      const trimmed = line.trim()
      if (!trimmed) return null
      const pipe = trimmed.indexOf('|')
      const tag = pipe > -1 ? trimmed.slice(0, pipe).trim().toUpperCase() : ''
      const text = pipe > -1 ? trimmed.slice(pipe + 1).trim() : trimmed
      if (!text) return null
      return { tag: tag || DEFAULT_RIGHT_NOW_TAG, text }
    })
    .filter((item): item is TickerHeadline => item !== null)
    .slice(0, MAX_RIGHT_NOW_ITEMS)

/** Serialize saved headlines back into the textarea's one-per-line format. */
const serializeRightNowLines = (items: TickerHeadline[]): string =>
  items
    .map((item) => (item.tag && item.tag !== DEFAULT_RIGHT_NOW_TAG ? `${item.tag} | ${item.text}` : item.text))
    .join('\n')

/**
 * Accepts a bare DexScreener pair address or a full dexscreener.com URL —
 * https://dexscreener.com/solana/AbC123 → { dexChain: 'solana', dexPair: 'AbC123' }.
 */
const parseDexPairInput = (raw: string): { dexPair: string; dexChain: string } => {
  const value = raw.trim()
  if (!value) return { dexPair: '', dexChain: '' }
  const match = value.match(/dexscreener\.com\/([^/?#\s]+)\/([^/?#\s]+)/i)
  if (match) return { dexChain: match[1].toLowerCase(), dexPair: match[2] }
  return { dexPair: value, dexChain: '' }
}

export default function Admin() {
  const { profile, loading } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [users, setUsers] = useState<UserData[]>([])
  const [usersLoaded, setUsersLoaded] = useState(false)

  // Schedule state
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [scheduleDay, setScheduleDay] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [assignModal, setAssignModal] = useState<Slot | null>(null)
  const [assignUid, setAssignUid] = useState('')
  const [assignName, setAssignName] = useState('')
  const [assignStreamTitle, setAssignStreamTitle] = useState('')
  const [assignTwitch, setAssignTwitch] = useState('') // handle only — URL is built from it
  const [actionError, setActionError] = useState<string | null>(null)

  // Slot stream URL override
  const [streamOverrideModal, setStreamOverrideModal] = useState<Slot | null>(null)
  const [overrideUrl, setOverrideUrl] = useState('')

  // Slot request handling
  const [requestModal, setRequestModal] = useState<Slot | null>(null)
  const [declineReason, setDeclineReason] = useState('')

  // Live stream push state
  const [liveStreamUrl, setLiveStreamUrl] = useState('')
  const [currentLiveUrl, setCurrentLiveUrl] = useState('')
  const [currentLiveStreamer, setCurrentLiveStreamer] = useState('')
  const [currentLiveTitle, setCurrentLiveTitle] = useState('')
  const [onAirActions, setOnAirActions] = useState({ total: 0, votes: 0, submissions: 0, spotlights: 0, buys: 0 })
  const [networkBlockEnabled, setNetworkBlockEnabled] = useState(true)
  const [togglingNetwork, setTogglingNetwork] = useState(false)
  const [pushingStream, setPushingStream] = useState(false)
  const [wipingSlots, setWipingSlots] = useState(false)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [syncingWeek, setSyncingWeek] = useState(false)
  const [syncingYear, setSyncingYear] = useState(false)
  const [syncStartDate, setSyncStartDate] = useState(() => new Date().toISOString().slice(0, 10))

  // Auth events tab state
  const [authEvents, setAuthEvents] = useState<AuthEventData[]>([])
  const [authEventsLoading, setAuthEventsLoading] = useState(false)
  const [authEventsError, setAuthEventsError] = useState<string | null>(null)

  // Fees tab state
  const [feeSlots, setFeeSlots] = useState<Slot[]>([])
  const [feeSlotsLoading, setFeeSlotsLoading] = useState(false)
  const [feeModal, setFeeModal] = useState<Slot | null>(null)
  const [feeVolume, setFeeVolume] = useState('')
  const [feeMarketCap, setFeeMarketCap] = useState('')
  const [feeWallet, setFeeWallet] = useState('')
  const [feeActionLoading, setFeeActionLoading] = useState<string | null>(null)

  // Vote history tab state
  const [votes, setVotes] = useState<VoteRecord[]>([])
  const [votesLoading, setVotesLoading] = useState(false)
  const [closingVoteId, setClosingVoteId] = useState<string | null>(null)

  // Network block (7 PM–3 AM ET) on/off — off returns those hours to open claiming
  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'scheduleMeta'), (snap) => {
      const d = snap.exists() ? snap.data() : {}
      setNetworkBlockEnabled(d.networkBlockEnabled !== false)
    }, () => {})
  }, [])

  const [normalizingSlots, setNormalizingSlots] = useState(false)

  const handleNormalizeSlots = async () => {
    setNormalizingSlots(true)
    setActionError(null)
    try {
      const res = await api.normalizeSlots()
      await loadSlots()
      setActionError(`Re-typed ${res.retyped} of ${res.normalized} slots to the 7 PM–3 AM network / open split.`)
    } catch (err: any) {
      setActionError(err?.message || 'Failed to normalize slots.')
    }
    setNormalizingSlots(false)
  }

  const handleToggleNetworkBlock = async () => {
    setTogglingNetwork(true)
    setActionError(null)
    try {
      await setDoc(doc(db, 'config', 'scheduleMeta'), { networkBlockEnabled: !networkBlockEnabled, updatedAt: new Date().toISOString() }, { merge: true })
    } catch (err: any) {
      setActionError(err?.message || 'Failed to toggle the network block.')
    }
    setTogglingNetwork(false)
  }

  // Live fan-action counter for the dashboard hero
  useEffect(() => {
    return onSnapshot(doc(db, 'public', 'onAirActions'), (snap) => {
      const d = snap.exists() ? snap.data() : {}
      const n = (k: string) => Number(d[k]) || 0
      setOnAirActions({ total: n('total'), votes: n('votes'), submissions: n('submissions'), spotlights: n('spotlights'), buys: n('buys') })
    }, () => {})
  }, [])

  // Listen to current live stream config
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'config', 'liveStream'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data()
          setCurrentLiveUrl(data.url || '')
          setCurrentLiveStreamer(data.streamerName || '')
          setCurrentLiveTitle(data.title || '')
        }
      },
      () => {}
    )
    return unsub
  }, [])

  const handlePushStream = async () => {
    if (!liveStreamUrl.trim()) return
    setPushingStream(true)
    setActionError(null)
    try {
      // Merge-write ONLY the URL: the stream title / streamer name shown on
      // /watch come from the slot data, and pushing a new broadcast link must
      // never overwrite them.
      await setDoc(
        doc(db, 'config', 'liveStream'),
        { url: liveStreamUrl.trim(), updatedAt: new Date().toISOString() },
        { merge: true },
      )
      setLiveStreamUrl('')
    } catch (err: any) {
      setActionError('Push Stream failed: ' + (err?.message || 'Unknown error. Check Firestore rules for config/liveStream.'))
    }
    setPushingStream(false)
  }

  const handleClearStream = async () => {
    setActionError(null)
    try {
      await setDoc(doc(db, 'config', 'liveStream'), {
        url: '',
        streamerName: '',
        title: '',
        updatedAt: new Date().toISOString(),
      })
    } catch (err: any) {
      setActionError('Clear failed: ' + (err?.message || 'Unknown error.'))
    }
  }

  // Intermission VOD playlist (config/vodPlaylist) — rotated by /player
  // between animated board segments whenever no streamer is live.
  const [vodItems, setVodItems] = useState<Array<{ url: string; title?: string }>>([])
  const [vodUrl, setVodUrl] = useState('')
  const [vodTitle, setVodTitle] = useState('')
  const [savingVods, setSavingVods] = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'config', 'vodPlaylist'),
      (snap) => {
        const items = snap.exists() ? (snap.data().items as Array<{ url: string; title?: string }> | undefined) : undefined
        setVodItems(Array.isArray(items) ? items : [])
      },
      () => {}
    )
    return unsub
  }, [])

  const saveVodItems = async (items: Array<{ url: string; title?: string }>) => {
    setSavingVods(true)
    setActionError(null)
    try {
      await setDoc(doc(db, 'config', 'vodPlaylist'), { items, updatedAt: new Date().toISOString() })
    } catch (err: any) {
      setActionError('Playlist save failed: ' + (err?.message || 'Unknown error.'))
    }
    setSavingVods(false)
  }

  const handleAddVod = async () => {
    const url = vodUrl.trim()
    if (!/^https:\/\/.+/.test(url)) {
      setActionError('VOD URL must be a direct https:// link to an MP4/WebM file.')
      return
    }
    await saveVodItems([...vodItems, { url, ...(vodTitle.trim() ? { title: vodTitle.trim() } : {}) }])
    setVodUrl('')
    setVodTitle('')
  }

  const handleRemoveVod = async (index: number) => {
    await saveVodItems(vodItems.filter((_, i) => i !== index))
  }

  // Broadcast ticker (config/ticker) — RIGHT NOW headline rail + coin
  // spotlight shown on the OBS ticker overlay. See helpers above the component.
  const [rightNowText, setRightNowText] = useState('')
  const [savedRightNow, setSavedRightNow] = useState<TickerHeadline[]>([])
  const [savingRightNow, setSavingRightNow] = useState(false)
  const [rightNowMsg, setRightNowMsg] = useState<string | null>(null)
  const [savedSpotlight, setSavedSpotlight] = useState<TickerSpotlight | null>(null)
  const [spotSymbol, setSpotSymbol] = useState('')
  const [spotCoingeckoId, setSpotCoingeckoId] = useState('')
  const [spotDexPair, setSpotDexPair] = useState('')
  const [spotNote, setSpotNote] = useState('')
  const [savingSpotlight, setSavingSpotlight] = useState(false)
  const [spotlightMsg, setSpotlightMsg] = useState<string | null>(null)
  // Mid-edit guards: while true, incoming snapshots don't overwrite the inputs.
  const rightNowDirtyRef = useRef(false)
  const spotlightDirtyRef = useRef(false)

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'config', 'ticker'),
      (snap) => {
        const data = snap.exists() ? snap.data() : null
        const items = (Array.isArray(data?.rightNow) ? data.rightNow : [])
          .filter((it: any): it is TickerHeadline => it && typeof it.text === 'string' && it.text.length > 0)
          .map((it: any) => ({ tag: typeof it.tag === 'string' && it.tag ? it.tag : DEFAULT_RIGHT_NOW_TAG, text: it.text }))
        setSavedRightNow(items)
        const spot = data?.spotlight && typeof data.spotlight === 'object' && typeof data.spotlight.symbol === 'string'
          ? (data.spotlight as TickerSpotlight)
          : null
        setSavedSpotlight(spot)
        // Prefill editors from the saved doc unless the admin is mid-edit.
        if (!rightNowDirtyRef.current) setRightNowText(serializeRightNowLines(items))
        if (!spotlightDirtyRef.current) {
          setSpotSymbol(spot?.symbol || '')
          setSpotCoingeckoId(spot?.coingeckoId || '')
          setSpotDexPair(spot?.dexPair ? (spot.dexChain ? `https://dexscreener.com/${spot.dexChain}/${spot.dexPair}` : spot.dexPair) : '')
          setSpotNote(spot?.note || '')
        }
      },
      () => {}
    )
    return unsub
  }, [])

  const handleSaveRightNow = async () => {
    setSavingRightNow(true)
    setActionError(null)
    setRightNowMsg(null)
    try {
      const items = parseRightNowLines(rightNowText)
      await setDoc(
        doc(db, 'config', 'ticker'),
        { rightNow: items, updatedAt: new Date().toISOString() },
        { merge: true },
      )
      rightNowDirtyRef.current = false
      setRightNowMsg(items.length === 0
        ? 'Rail cleared — the ticker drops it within ~60s.'
        : `Saved ${items.length} headline${items.length === 1 ? '' : 's'} — live on the ticker within ~60s.`)
    } catch (err: any) {
      setActionError('Ticker rail save failed: ' + (err?.message || 'Unknown error. Check Firestore rules for config/ticker.'))
    }
    setSavingRightNow(false)
  }

  const handleClearRightNow = async () => {
    setSavingRightNow(true)
    setActionError(null)
    setRightNowMsg(null)
    try {
      await setDoc(
        doc(db, 'config', 'ticker'),
        { rightNow: [], updatedAt: new Date().toISOString() },
        { merge: true },
      )
      setRightNowText('')
      rightNowDirtyRef.current = false
      setRightNowMsg('Rail cleared — the ticker drops it within ~60s.')
    } catch (err: any) {
      setActionError('Ticker rail clear failed: ' + (err?.message || 'Unknown error.'))
    }
    setSavingRightNow(false)
  }

  const handleSaveSpotlight = async () => {
    const symbol = spotSymbol.trim().toUpperCase()
    if (!symbol) return
    setSavingSpotlight(true)
    setActionError(null)
    setSpotlightMsg(null)
    try {
      const { dexPair, dexChain } = parseDexPairInput(spotDexPair)
      const coingeckoId = spotCoingeckoId.trim().toLowerCase()
      const note = spotNote.trim()
      const spotlight: TickerSpotlight = {
        symbol,
        ...(coingeckoId ? { coingeckoId } : {}),
        ...(dexPair ? { dexPair } : {}),
        ...(dexChain ? { dexChain } : {}),
        ...(note ? { note } : {}),
        updatedAt: new Date().toISOString(),
      }
      await setDoc(doc(db, 'config', 'ticker'), { spotlight }, { merge: true })
      spotlightDirtyRef.current = false
      setSpotlightMsg(`$${symbol} spotlight saved — on the ticker within ~60s.`)
    } catch (err: any) {
      setActionError('Spotlight save failed: ' + (err?.message || 'Unknown error. Check Firestore rules for config/ticker.'))
    }
    setSavingSpotlight(false)
  }

  const handleClearSpotlight = async () => {
    setSavingSpotlight(true)
    setActionError(null)
    setSpotlightMsg(null)
    try {
      await setDoc(doc(db, 'config', 'ticker'), { spotlight: null }, { merge: true })
      setSpotSymbol('')
      setSpotCoingeckoId('')
      setSpotDexPair('')
      setSpotNote('')
      spotlightDirtyRef.current = false
      setSpotlightMsg('Spotlight removed — the ticker drops it within ~60s.')
    } catch (err: any) {
      setActionError('Spotlight clear failed: ' + (err?.message || 'Unknown error.'))
    }
    setSavingSpotlight(false)
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const usersSnap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(500)))
        setUsers(usersSnap.docs.map((d) => ({ ...d.data() } as UserData)))
      } catch {}
      setUsersLoaded(true)
    }
    fetchData()
  }, [])

  const loadSlots = useCallback(async () => {
    setSlotsLoading(true)
    const now = new Date()
    // Include enough range for 7 ET days + safety buffer.
    const from = new Date(now.getTime() - 16 * 60 * 60 * 1000)
    const future = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000)
    try {
      const data = await fetchSlots(from, future, 120)
      const sorted = [...data].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      setSlots(sorted)
    } catch (err) {
      console.warn('Failed to fetch slots:', err)
    }
    setSlotsLoading(false)
  }, [])

  const loadFeeSlots = useCallback(async () => {
    setFeeSlotsLoading(true)
    // 60 days back — enough completed slots for the day/week/month history
    // ledger to actually have something in every bucket.
    const now = new Date()
    const past = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
    try {
      const data = await fetchSlots(past, now, 800)
      const completedWithStreamer = data.filter((s) => s.assignedUid && (s.status === 'completed' || new Date(s.endTime).getTime() < Date.now()))

      // Backfill missing creatorFees, then merge locally instead of re-reading
      // the whole 14-day window a second time.
      const backfilled = new Map<string, Slot>()
      await Promise.all(completedWithStreamer.map(async (slot) => {
        if (slot.creatorFees) return

        const durationMinutes = Math.max(0, Math.round((new Date(slot.endTime).getTime() - new Date(slot.startTime).getTime()) / (60 * 1000)))
        const autoFees: CreatorFees = {
          tradingVolumeSOL: 0,
          feeOwedSOL: 0,
          paymentStatus: 'pending',
          streamerWalletAddress: users.find((u) => u.uid === slot.assignedUid)?.walletAddress || '',
          activeChannels: [{
            name: slot.assignedName || 'Unknown Channel',
            streamUrl: slot.streamUrl || DEFAULT_STREAM_URL,
            durationMinutes,
          }],
          updatedAt: new Date().toISOString(),
        }

        await updateCreatorFees(slot.id, autoFees)
        backfilled.set(slot.id, { ...slot, creatorFees: autoFees })
      }))

      setFeeSlots(completedWithStreamer.map((s) => backfilled.get(s.id) ?? s))
    } catch {}
    setFeeSlotsLoading(false)
  }, [users])

  const [testingAuthLog, setTestingAuthLog] = useState(false)

  /** Write a real event through the same server path the app uses, then reload —
   *  proves the whole pipeline (function → Firestore → admin read) in one click. */
  const handleTestAuthEvent = async () => {
    setTestingAuthLog(true)
    setAuthEventsError(null)
    try {
      await logAuthEvent('signin-start', { meta: { source: 'admin-selftest' } })
      await new Promise((r) => setTimeout(r, 900)) // let the write land
      await loadAuthEvents()
    } catch (err: any) {
      setAuthEventsError(err?.message || 'Test event failed.')
    }
    setTestingAuthLog(false)
  }

  const loadAuthEvents = useCallback(async () => {
    setAuthEventsLoading(true)
    setAuthEventsError(null)
    try {
      const snap = await getDocs(query(
        collection(db, 'auth_events'),
        orderBy('ts', 'desc'),
        limit(50),
      ))
      setAuthEvents(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuthEventData, 'id'>) })))
    } catch (err: any) {
      setAuthEventsError(err?.message || 'Failed to load auth events.')
      setAuthEvents([])
    }
    setAuthEventsLoading(false)
  }, [])

  /** Every vote ever run. Sorted client-side because the earliest docs predate
   *  createdAt, and an orderBy would silently drop them from the history. */
  const loadVotes = useCallback(async () => {
    setVotesLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'votes'), limit(300)))
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VoteRecord, 'id'>) }))
      rows.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime())
      setVotes(rows)
    } catch {}
    setVotesLoading(false)
  }, [])

  /**
   * Closing settles the vote against LIVE on-chain balances before freezing it.
   * The running tally is incremental, so a wallet that sold — or that moved its
   * bag to a second wallet and voted twice — is still counted in it. The settle
   * pass rebuilds the tally from what each voter actually holds, which is what
   * makes the published result trustworthy. It also closes the on-air card so
   * the overlay and the ledger never disagree.
   */
  const handleCloseVote = async (vote: VoteRecord, close = true) => {
    setClosingVoteId(vote.id)
    setActionError(null)
    try {
      const res = await api.settleVote(vote.id, close)
      await loadVotes()
      const moved = res.dropped > 0 ? `, ${res.dropped} wallet${res.dropped !== 1 ? 's' : ''} dropped to zero` : ''
      setActionError(`${close ? 'Closed' : 'Re-settled'} — ${res.counted} of ${res.ballots} ballots still hold $CSGN${moved}.`)
    } catch (err: any) {
      setActionError(err?.message || 'Failed to settle the vote.')
    }
    setClosingVoteId(null)
  }

  useEffect(() => {
    if (activeTab === 'overview' || activeTab === 'schedule') loadSlots()
    if (activeTab === 'fees') loadFeeSlots()
    if (activeTab === 'votes') loadVotes()
    if (activeTab === 'auth') loadAuthEvents()
  }, [activeTab, loadSlots, loadFeeSlots, loadVotes, loadAuthEvents])

  // Load the fee + vote ledgers once on mount so their "needs a decision"
  // counts can ride on the tab labels before you ever open those tabs.
  const feePrimed = useRef(false)
  useEffect(() => {
    if (feePrimed.current || !usersLoaded) return
    feePrimed.current = true
    loadFeeSlots()
    loadVotes()
  }, [usersLoaded, loadFeeSlots, loadVotes])

  const handleGenerateThreeDays = async () => {
    setGenerating(true)
    setActionError(null)
    try {
      const result = await appendNextThreeDays()
      setActionError(null)
      await loadSlots()
      if (result.generated === 0) {
        setActionError('No additional future slots were appended.')
      }
    } catch (err: any) {
      setActionError(err?.message || 'Failed to generate slots.')
    }
    setGenerating(false)
  }



  const handleSyncSevenDays = async () => {
    setSyncingWeek(true)
    setActionError(null)
    try {
      const [y, m, d] = syncStartDate.split('-').map((v) => parseInt(v, 10))
      const start = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0))
      await syncSevenDaysFrom(start)
      const result = await reseedNextSevenDays(start)
      await loadSlots()

      if (result.conflicts.length > 0) {
        setActionError(`Schedule synced with ${result.conflicts.length} conflict(s): ${result.conflicts[0]}`)
      }
    } catch (err: any) {
      setActionError(err?.message || 'Failed to sync 7-day schedule.')
    }
    setSyncingWeek(false)
  }

  const handleWipeAndRegenerate = async () => {
    setWipingSlots(true)
    setActionError(null)
    setConfirmWipe(false)
    try {
      // Start from today — wipeAndRegenerateSlots generates slots for today (ET)
      // and the next 2 days. Pass the current time so the ET date resolves correctly.
      const result = await wipeAndRegenerateSlots(new Date())
      await loadSlots()
      if (result.generated === 0) {
        setActionError('No slots were generated.')
      }
    } catch (err: any) {
      setActionError(err?.message || 'Failed to wipe and regenerate slots.')
    }
    setWipingSlots(false)
  }

  const handleReseedYear = async () => {
    setSyncingYear(true)
    setActionError(null)
    try {
      const [y, m, d] = syncStartDate.split('-').map((v) => parseInt(v, 10))
      const start = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0))
      const result = await reseedNextYear(start)
      await loadSlots()
      if (result.conflicts.length > 0) {
        setActionError(`365-day reseed completed with ${result.conflicts.length} conflict(s): ${result.conflicts[0]}`)
      }
    } catch (err: any) {
      setActionError(err?.message || 'Failed to reseed 365 days.')
    }
    setSyncingYear(false)
  }

  const handleAssignSlot = async () => {
    if (!assignModal || !assignUid.trim() || !assignName.trim()) return
    setActionError(null)
    try {
      // Assigning the hour on the air right now flips it live immediately; a
      // future hour parks as 'confirmed' until the clock reaches it.
      const status = assignmentStatus(assignModal, Date.now())
      if (assignModal.type === 'network') {
        await assignNetworkSlot(assignModal.id, assignUid, assignName, buildTwitchStreamUrl(assignTwitch), assignStreamTitle, status)
      } else {
        await assignSlot(assignModal.id, assignUid, assignName, buildTwitchStreamUrl(assignTwitch), assignStreamTitle, status)
      }
      setAssignModal(null)
      setAssignUid('')
      setAssignName('')
      setAssignStreamTitle('')
      setAssignTwitch('')
      await loadSlots()
    } catch (err: any) {
      setActionError(err?.message || 'Failed to assign slot.')
    }
  }

  const handleStreamOverride = async () => {
    if (!streamOverrideModal) return
    setActionError(null)
    try {
      await updateSlotStreamUrl(streamOverrideModal.id, overrideUrl || DEFAULT_STREAM_URL)
      setStreamOverrideModal(null)
      setOverrideUrl('')
      await loadSlots()
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update stream URL.')
    }
  }

  const handleDeleteSlot = async (slotId: string) => {
    try {
      await deleteSlot(slotId)
      await loadSlots()
    } catch (err: any) {
      setActionError(err?.message || 'Failed to delete slot.')
    }
  }

  const handleAcceptRequest = async (slotId: string, requestId: string, note?: string) => {
    setActionError(null)
    try {
      await acceptSlotRequest(slotId, requestId, note)
      setRequestModal(null)
      await loadSlots()
    } catch (err: any) {
      setActionError(err?.message || 'Failed to accept request.')
    }
  }

  const handleDeclineRequest = async (slotId: string, requestId: string) => {
    if (!declineReason.trim()) {
      setActionError('Please provide a reason for declining.')
      return
    }
    setActionError(null)
    try {
      await declineSlotRequest(slotId, requestId, declineReason)
      setDeclineReason('')
      setRequestModal(null)
      await loadSlots()
    } catch (err: any) {
      setActionError(err?.message || 'Failed to decline request.')
    }
  }

  // Fees management
  const handleSaveFeeRecord = async (slot: Slot) => {
    if (!feeModal || !feeVolume) return
    setFeeActionLoading(slot.id)
    try {
      const volumeSOL = parseFloat(feeVolume)
      if (isNaN(volumeSOL) || volumeSOL < 0) throw new Error('Invalid volume amount')

      const marketCapSOL = Math.max(0, parseFloat(feeMarketCap || '0'))
      const tier = resolvePumpFeeTier(marketCapSOL)
      const feeOwedSOL = estimateCreatorFeeSOL(volumeSOL, marketCapSOL)
      const creatorFeeSOL = volumeSOL * tier.creatorFeeRate

      const fees: CreatorFees = {
        tradingVolumeSOL: volumeSOL,
        feeOwedSOL,
        marketCapSOL,
        creatorFeeRate: tier.creatorFeeRate,
        streamerShareRate: tier.creatorFeeRate * 0.3,
        marketCapTierRange: formatTierRange(tier),
        marketCapTierLabel: `${formatTierRange(tier)} (${(tier.creatorFeeRate * 100).toFixed(3)}%)`,
        tierFeeBreakdown: [{
          tierLabel: `${formatTierRange(tier)} (${(tier.creatorFeeRate * 100).toFixed(3)}%)`,
          marketCapRange: formatTierRange(tier),
          creatorFeeRate: tier.creatorFeeRate,
          streamerShareRate: tier.creatorFeeRate * 0.3,
          volumeSOL,
          creatorFeeSOL,
          streamerFeeSOL: feeOwedSOL,
        }],
        marketCapCheckpoints: [{
          capturedAt: new Date().toISOString(),
          marketCapSOL,
          tierLabel: `${formatTierRange(tier)} (${(tier.creatorFeeRate * 100).toFixed(3)}%)`,
          creatorFeeRate: tier.creatorFeeRate,
        }],
        paymentStatus: 'pending',
        streamerWalletAddress: feeWallet || slot.creatorFees?.streamerWalletAddress || '',
        activeChannels: slot.creatorFees?.activeChannels || [{
          name: slot.assignedName || 'Unknown Channel',
          streamUrl: slot.streamUrl || DEFAULT_STREAM_URL,
          durationMinutes: Math.max(0, Math.round((new Date(slot.endTime).getTime() - new Date(slot.startTime).getTime()) / (60 * 1000))),
        }],
        updatedAt: new Date().toISOString(),
      }
      await updateCreatorFees(slot.id, fees)
      setFeeModal(null)
      setFeeVolume('')
      setFeeWallet('')
      await loadFeeSlots()
    } catch (err: any) {
      setActionError(err?.message || 'Failed to save fee record.')
    }
    setFeeActionLoading(null)
  }

  const handleMarkPaid = async (slot: Slot) => {
    if (!slot.assignedUid) return
    setFeeActionLoading(slot.id)
    try {
      await markFeesPaid(slot.id)
      await loadFeeSlots()
    } catch (err: any) {
      setActionError(err?.message || 'Failed to mark as paid.')
    }
    setFeeActionLoading(null)
  }

  const handleDeclineFee = async (slot: Slot, reason: string) => {
    if (!reason.trim()) {
      setActionError('Please provide a reason.')
      return
    }
    setFeeActionLoading(slot.id)
    try {
      await declineFeesPayment(slot.id, reason.trim())
      await loadFeeSlots()
    } catch (err: any) {
      setActionError(err?.message || 'Failed to decline payment.')
    }
    setFeeActionLoading(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!profile || profile.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  const streamerCount = users.filter((u) => u.role === 'streamer').length
  const liveNowCount = slots.filter((s) => {
    const t = Date.now()
    return t >= new Date(s.startTime).getTime() && t < new Date(s.endTime).getTime() && (s.status === 'confirmed' || s.status === 'live')
  }).length

  // Counts ride on the tab labels so an admin can see there's work waiting
  // without opening anything — Creator Fees (6), Vote History (1).
  const pendingFeeCount = feeSlots.filter(isFeePending).length
  const openVoteCount = votes.filter(isVoteOpen).length

  const tabs = [
    { id: 'overview' as Tab, label: 'Overview', icon: BarChart3 },
    { id: 'streamers' as Tab, label: 'Streamers', icon: Users },
    { id: 'schedule' as Tab, label: 'Schedule', icon: Clock },
    { id: 'fees' as Tab, label: 'Creator Fees', icon: DollarSign, count: pendingFeeCount, tone: 'amber' },
    { id: 'votes' as Tab, label: 'Vote History', icon: Vote, count: openVoteCount, tone: 'cyan' },
    { id: 'auth' as Tab, label: 'Auth Events', icon: Activity },
  ]

  // Gold crown = the CSGN Originals (network) block; open slots read as neutral.
  const typeIcon = (slot: Slot) => (isNetworkSlot(slot) ? <Crown className="w-4 h-4" /> : <Radio className="w-4 h-4" />)
  const typeColor = (slot: Slot) => (isNetworkSlot(slot) ? 'text-gold' : 'text-blue-300')

  const scheduleDays = ['Today', 'Tomorrow', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7']
  const etDayKey = (date: Date) => date.toLocaleDateString('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const etMiddayFromOffset = (offset: number) => {
    const now = new Date()
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(now)
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || '0')
    const base = new Date(Date.UTC(get('year'), get('month') - 1, get('day'), 12, 0, 0, 0))
    base.setUTCDate(base.getUTCDate() + offset)
    return base
  }

  const targetDayKey = etDayKey(etMiddayFromOffset(scheduleDay))
  const daySlotsRaw = slots.filter((slot) => etDayKey(new Date(slot.startTime)) === targetDayKey)
  const nowMs = Date.now()
  const currentDayLive = daySlotsRaw.find((slot) => nowMs >= new Date(slot.startTime).getTime() && nowMs < new Date(slot.endTime).getTime())
  const daySlots = scheduleDay === 0
    ? [
        ...(currentDayLive ? [currentDayLive] : []),
        ...daySlotsRaw.filter((slot) => new Date(slot.startTime).getTime() > nowMs).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
      ]
    : [...daySlotsRaw].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

  return (
    <div className="min-h-screen pt-24 lg:pt-32 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-10">
          <Shield className="w-8 h-8 text-gold" />
          <div>
            <h1 className="text-3xl font-bold font-display text-white">Admin Panel</h1>
            <p className="text-gray-400 mt-0.5">Manage the CSGN network</p>
          </div>
        </div>

        {/* Tab Nav */}
        <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2 border-b border-white/[0.06]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all cursor-pointer border-b-2 -mb-[2px] ${
                activeTab === tab.id
                  ? 'text-white border-primary-500'
                  : 'text-gray-400 hover:text-white border-transparent'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {!!tab.count && (
                <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold leading-none ${
                  tab.tone === 'cyan' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Global error */}
        {actionError && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{actionError}</p>
            <button onClick={() => setActionError(null)} className="ml-auto text-gray-400 hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Overview Tab ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Dashboard hero — network status + the live fan-action counter */}
            <div className={`rounded-2xl border p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4 ${currentLiveUrl ? 'border-red-500/30 bg-gradient-to-r from-red-600/20 via-red-500/[0.07] to-transparent' : 'border-white/[0.08] bg-white/[0.03]'}`}>
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.2em] text-gray-500 mb-1">Network status</div>
                <div className={`text-3xl font-black font-display flex items-center gap-2.5 ${currentLiveUrl ? 'text-white' : 'text-gray-300'}`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${currentLiveUrl ? 'bg-red-500 animate-pulse' : 'bg-gray-600'}`} />
                  {currentLiveUrl ? 'ON AIR' : 'OFFLINE'}
                </div>
                <div className="text-sm text-gray-400 mt-1 truncate">
                  {currentLiveUrl ? `${currentLiveStreamer || 'CSGN'}${currentLiveTitle ? ` · "${currentLiveTitle}"` : ''}` : 'No broadcast live on /watch'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-4xl sm:text-5xl font-black font-mono text-white tabular-nums leading-none">{onAirActions.total.toLocaleString()}</div>
                <div className="text-[11px] uppercase tracking-[0.15em] text-amber-300/90 mt-1.5">fan actions on air</div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              {[
                { label: 'Total Users', value: users.length, icon: Users, color: 'text-primary-400', bg: 'bg-primary-500/10' },
                { label: 'Active Streamers', value: streamerCount, icon: Radio, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                { label: 'Live / Confirmed', value: liveNowCount, icon: Tv, color: 'text-red-400', bg: 'bg-red-500/10' },
                { label: 'Slots Loaded', value: slots.length, icon: Clock, color: 'text-accent-400', bg: 'bg-accent-500/10' },
                { label: 'Fan Votes', value: onAirActions.votes, icon: BarChart3, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
                { label: 'Coin Spotlights', value: onAirActions.spotlights, icon: Activity, color: 'text-amber-400', bg: 'bg-amber-500/10' },
              ].map((stat) => (
                <Card key={stat.label} hover={false} className="p-4">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${stat.bg}`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <div className="text-2xl font-bold font-display text-white tabular-nums">{stat.value}</div>
                  <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
                </Card>
              ))}
            </div>

            {/* CSGN Stream Output */}
            <Card hover={false} className="overflow-hidden">
              <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tv className="w-5 h-5 text-red-400" />
                  <h3 className="font-semibold text-white">CSGN Stream Output</h3>
                </div>
                <a
                  href="/player"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-300 border border-primary-500/30 rounded-lg hover:bg-primary-500/10 hover:border-primary-500/50 transition-all"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  Open /player
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              </div>
              <div className="p-4 space-y-4">
                {/* Workflow hint */}
                <div className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-gray-500 leading-relaxed space-y-1">
                  <p className="text-gray-400 font-medium">Setup flow (OBS → X, no Restream) — full guide: <span className="font-mono text-primary-400">docs/obs-setup.md</span></p>
                  <p>1. Add <span className="font-mono text-primary-400">/player</span> as an OBS <span className="text-gray-300">Browser Source</span> (1920×1080) — it runs the 24/7 logic itself: live feed, BRB, intermission VODs, transitions</p>
                  <p>2. X Media Studio (studio.x.com → Producer) → create broadcast → copy RTMPS URL + key into OBS → Start Streaming</p>
                  <p>3. Go live from Media Studio, open the broadcast's post on @CSGNet, copy the post URL</p>
                  <p>4. Paste it below → viewers on <span className="font-mono text-primary-400">/watch</span> see the embedded broadcast</p>
                  <p>5. Session over: stop OBS + Clear below → /watch shows the offline panel</p>
                </div>

                {currentLiveUrl && (
                  <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] text-red-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" /> Live on /watch
                        </p>
                        <p className="text-sm font-medium text-white">{currentLiveStreamer || 'CSGN'}</p>
                        {currentLiveTitle && <p className="text-xs text-primary-300 font-medium mt-0.5">"{currentLiveTitle}"</p>}
                        <p className="text-xs text-gray-400 font-mono truncate mt-0.5">{currentLiveUrl}</p>
                      </div>
                      <button
                        onClick={handleClearStream}
                        className="shrink-0 px-2 py-1 text-xs text-red-400 border border-red-500/30 rounded hover:bg-red-500/10 transition-colors cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm text-gray-300 mb-1">X Broadcast Post URL <span className="text-gray-500 text-xs">(paste once per OBS session)</span></label>
                  <input
                    type="text"
                    value={liveStreamUrl}
                    onChange={(e) => setLiveStreamUrl(e.target.value)}
                    placeholder="https://x.com/CSGNet/status/1234567890"
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50"
                  />
                  {liveStreamUrl.trim() && (
                    parseXPostId(liveStreamUrl) ? (
                      <p className="mt-1.5 text-xs text-emerald-300 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                        Valid X post — /watch will embed this broadcast
                      </p>
                    ) : isBroadcastUrl(liveStreamUrl) ? (
                      <p className="mt-1.5 text-xs text-amber-300">
                        This is a raw x.com/i/broadcasts link — it can't be embedded. Paste the URL of the X <em>post</em> containing the broadcast instead (open the post on @CSGNet, copy its link).
                      </p>
                    ) : (
                      <p className="mt-1.5 text-xs text-gray-500">
                        Not an X post URL — /watch will show the offline panel with an outbound link.
                      </p>
                    )
                  )}
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Streamer name and stream title on /watch come from the slot itself
                  (assign a streamer / set the title on the slot) — pushing a broadcast
                  link never changes them.
                </p>
                <Button
                  variant="primary"
                  size="md"
                  className="w-full"
                  disabled={!liveStreamUrl.trim()}
                  isLoading={pushingStream}
                  leftIcon={<Tv className="w-4 h-4" />}
                  onClick={handlePushStream}
                >
                  Push to /watch
                </Button>
              </div>
            </Card>

            {/* Intermission VOD Playlist */}
            <Card hover={false} className="overflow-hidden">
              <div className="p-4 border-b border-white/[0.06] flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary-400" />
                <h3 className="font-semibold text-white">Intermission VOD Playlist</h3>
              </div>
              <div className="p-4 space-y-4">
                <p className="text-xs text-gray-500 leading-relaxed">
                  When no streamer is live, <span className="font-mono text-primary-400">/player</span> rotates these clips with the animated network board.
                  Empty playlist = board only. Direct https MP4/WebM links (Firebase Storage or any CDN).
                </p>

                {vodItems.length > 0 && (
                  <div className="space-y-2">
                    {vodItems.map((item, i) => (
                      <div key={`${item.url}-${i}`} className="flex items-center gap-2 p-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                        <div className="min-w-0 flex-1">
                          {item.title && <p className="text-sm text-white font-medium">{item.title}</p>}
                          <p className="text-xs text-gray-500 font-mono truncate">{item.url}</p>
                        </div>
                        <button
                          onClick={() => void handleRemoveVod(i)}
                          disabled={savingVods}
                          className="shrink-0 px-2 py-1 text-xs text-red-400 border border-red-500/30 rounded hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={vodUrl}
                    onChange={(e) => setVodUrl(e.target.value)}
                    placeholder="https://…/promo.mp4"
                    className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50"
                  />
                  <input
                    type="text"
                    value={vodTitle}
                    onChange={(e) => setVodTitle(e.target.value)}
                    placeholder="Title (optional)"
                    className="sm:w-48 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50"
                  />
                  <Button
                    variant="secondary"
                    size="md"
                    disabled={!vodUrl.trim()}
                    isLoading={savingVods}
                    onClick={handleAddVod}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </Card>

            {/* Broadcast Control — one console; the rail + spotlight ride inside it
                as the "Rail & Coins" module (state stays here). */}
            <TickerControlsCard railModule={(
              <div className="space-y-4">
                <p className="text-xs text-gray-500 leading-relaxed">
                  Drives the OBS ticker overlay (<span className="font-mono text-primary-400">docs/obs/csgn-ticker.html</span>).
                  The overlay polls this config over the public Firestore REST API, so saves here reach the broadcast within ~60s — no OBS restart needed.
                </p>

                {/* RIGHT NOW headline rail */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm text-gray-300 font-medium">"Right Now" Headline Rail</label>
                    {savedRightNow.length > 0 && (
                      <span className="text-xs text-emerald-400">{savedRightNow.length} headline{savedRightNow.length !== 1 ? 's' : ''} live</span>
                    )}
                  </div>
                  <textarea
                    value={rightNowText}
                    onChange={(e) => {
                      setRightNowText(e.target.value)
                      rightNowDirtyRef.current = true
                    }}
                    rows={5}
                    placeholder={'BREAKING | SOL flips $300\nCSGN | Open stage claimed — live at 9PM ET\nMARKETS | BTC reclaims $120K'}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 font-mono focus:outline-none focus:border-primary-500/50 resize-y"
                  />
                  <p className="text-xs text-gray-500 leading-relaxed">
                    One headline per line, max {MAX_RIGHT_NOW_ITEMS}. Optional tag before a pipe —
                    <span className="font-mono text-primary-400"> BREAKING | SOL flips $300</span>; no pipe = tagged {DEFAULT_RIGHT_NOW_TAG}.
                    The OBS ticker picks changes up within ~60s.
                  </p>
                  {rightNowMsg && (
                    <p className="text-xs text-emerald-300 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                      {rightNowMsg}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      size="md"
                      className="flex-1"
                      isLoading={savingRightNow}
                      leftIcon={<Megaphone className="w-4 h-4" />}
                      onClick={handleSaveRightNow}
                    >
                      Save Rail
                    </Button>
                    <Button
                      variant="secondary"
                      size="md"
                      disabled={savingRightNow || (savedRightNow.length === 0 && !rightNowText.trim())}
                      onClick={handleClearRightNow}
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {/* Coin spotlight */}
                <div className="pt-4 border-t border-white/[0.06] space-y-2">
                  <label className="block text-sm text-gray-300 font-medium">Coin Spotlight</label>

                  {savedSpotlight && (
                    <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                      <p className="text-[11px] text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Flame className="w-3 h-3" /> Spotlight live on ticker
                      </p>
                      <p className="text-sm font-medium text-white">
                        ${savedSpotlight.symbol}
                        {savedSpotlight.note && <span className="text-gray-400 font-normal"> — {savedSpotlight.note}</span>}
                      </p>
                      <p className="text-xs text-gray-500 font-mono truncate mt-0.5">
                        {[
                          savedSpotlight.coingeckoId && `cg:${savedSpotlight.coingeckoId}`,
                          savedSpotlight.dexPair && `dex:${savedSpotlight.dexChain ? `${savedSpotlight.dexChain}/` : ''}${savedSpotlight.dexPair}`,
                        ].filter(Boolean).join(' · ') || 'symbol only'}
                      </p>
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Symbol <span className="text-red-400">*</span></label>
                      <input
                        type="text"
                        value={spotSymbol}
                        onChange={(e) => {
                          setSpotSymbol(e.target.value.toUpperCase())
                          spotlightDirtyRef.current = true
                        }}
                        placeholder="SOL"
                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">CoinGecko ID <span className="text-gray-500 text-xs">(optional)</span></label>
                      <input
                        type="text"
                        value={spotCoingeckoId}
                        onChange={(e) => {
                          setSpotCoingeckoId(e.target.value)
                          spotlightDirtyRef.current = true
                        }}
                        placeholder="solana"
                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">DexScreener Pair <span className="text-gray-500 text-xs">(optional — pair address or full URL)</span></label>
                    <input
                      type="text"
                      value={spotDexPair}
                      onChange={(e) => {
                        setSpotDexPair(e.target.value)
                        spotlightDirtyRef.current = true
                      }}
                      placeholder="https://dexscreener.com/solana/… or bare pair address"
                      className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 font-mono focus:outline-none focus:border-primary-500/50"
                    />
                    {spotDexPair.trim() && (() => {
                      const parsed = parseDexPairInput(spotDexPair)
                      return (
                        <p className="mt-1.5 text-xs text-emerald-300 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                          {parsed.dexChain
                            ? `URL parsed — chain ${parsed.dexChain}, pair ${parsed.dexPair}`
                            : `Bare pair address — ${parsed.dexPair}`}
                        </p>
                      )
                    })()}
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Note <span className="text-gray-500 text-xs">(optional, short)</span></label>
                    <input
                      type="text"
                      value={spotNote}
                      onChange={(e) => {
                        setSpotNote(e.target.value)
                        spotlightDirtyRef.current = true
                      }}
                      maxLength={80}
                      placeholder="e.g. Community takeover trending on X"
                      className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50"
                    />
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Shows a 30s on-fire spotlight in the ticker every 10 minutes until cleared; changes appear within ~60s.
                  </p>
                  {spotlightMsg && (
                    <p className="text-xs text-emerald-300 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                      {spotlightMsg}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      size="md"
                      className="flex-1"
                      disabled={!spotSymbol.trim()}
                      isLoading={savingSpotlight}
                      leftIcon={<Flame className="w-4 h-4" />}
                      onClick={handleSaveSpotlight}
                    >
                      Save Spotlight
                    </Button>
                    <Button
                      variant="secondary"
                      size="md"
                      disabled={savingSpotlight || !savedSpotlight}
                      onClick={handleClearSpotlight}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            )} />

          </div>
        )}

        {/* ── Streamers Tab ── */}
        {activeTab === 'streamers' && (
          <Card hover={false} className="overflow-hidden">
            <div className="p-4 border-b border-white/[0.06] flex items-center justify-between gap-3">
              <h3 className="font-semibold text-white">Active Streamers</h3>
              <Badge variant="green">{streamerCount} active</Badge>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {users.filter((u) => u.role === 'streamer').map((user) => (
                <div key={user.uid} className="flex items-center gap-4 px-4 sm:px-6 py-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-600/20 flex items-center justify-center text-sm font-bold text-emerald-400 shrink-0">
                    {(user.displayName || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-white">{user.displayName}</span>
                    <span className="text-xs text-gray-500 block">{user.email}</span>
                    {user.walletAddress && (
                      <span className="text-xs text-gray-600 font-mono flex items-center gap-1 mt-0.5">
                        <Wallet className="w-3 h-3" /> {user.walletAddress.slice(0, 8)}...{user.walletAddress.slice(-6)}
                      </span>
                    )}
                  </div>
                  <Badge variant="green">Streamer</Badge>
                </div>
              ))}
              {users.filter((u) => u.role === 'streamer').length === 0 && (
                <div className="text-center py-12 text-gray-500 text-sm">No streamers yet.</div>
              )}
            </div>
          </Card>
        )}

        {/* ── Schedule Tab ── */}
        {activeTab === 'schedule' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">Scheduling Module</h3>
                <p className="text-sm text-gray-400">Reseed tools maintain 12 ET slots/day: 3 AM–7 PM open for anyone to claim, 7 PM–3 AM the CSGN Originals network block. No auctions.</p>
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                <Button
                  variant={networkBlockEnabled ? 'secondary' : 'gold'}
                  size="sm"
                  leftIcon={<Crown className="w-4 h-4" />}
                  isLoading={togglingNetwork}
                  onClick={handleToggleNetworkBlock}
                  title={networkBlockEnabled
                    ? 'Network block ON — 7 PM–3 AM ET is reserved for CSGN Originals. Click to open those hours to claiming.'
                    : 'Network block OFF — every slot is open to claim. Click to reserve 7 PM–3 AM ET again.'}
                >
                  {networkBlockEnabled ? 'Network block: ON' : 'Network block: OFF — all open'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<RefreshCw className="w-4 h-4" />}
                  isLoading={normalizingSlots}
                  onClick={handleNormalizeSlots}
                  title="Re-type every existing and future slot by its ET airtime: 7 PM–3 AM becomes CSGN Originals, every other hour becomes open and claimable. Assignments are kept."
                >
                  Fix all slot types
                </Button>
                <Button variant="ghost" size="sm" leftIcon={<RefreshCw className="w-4 h-4" />} onClick={loadSlots}>
                  Refresh
                </Button>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={syncStartDate}
                    onChange={(e) => setSyncStartDate(e.target.value)}
                    className="px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Plus className="w-4 h-4" />}
                    isLoading={syncingWeek}
                    onClick={handleSyncSevenDays}
                  >
                    Reseed 7 Days
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Plus className="w-4 h-4" />}
                  isLoading={generating}
                  onClick={handleGenerateThreeDays}
                >
                  Append Next 3 Days
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-4 h-4" />}
                  isLoading={syncingYear}
                  onClick={handleReseedYear}
                >
                  Reseed 365 Days
                </Button>

                {!confirmWipe ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300 border border-red-500/30"
                    onClick={() => setConfirmWipe(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" /> Wipe & Reseed
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-400">Wipe all slots & reseed from today (ET)?</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300"
                      isLoading={wipingSlots}
                      onClick={handleWipeAndRegenerate}
                    >
                      Yes, Wipe
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmWipe(false)}>
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {scheduleDays.map((day, idx) => (
                <button
                  key={day}
                  onClick={() => setScheduleDay(idx)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                    scheduleDay === idx
                      ? 'bg-primary-500/20 text-primary-300 border-primary-500/30'
                      : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>

            {slotsLoading ? (
              <div className="py-16 text-center">
                <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-500">Loading slots...</p>
              </div>
            ) : daySlots.length === 0 ? (
              <Card hover={false} className="p-8 text-center">
                <Clock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No Slots for This ET Day</h3>
                <p className="text-sm text-gray-400 max-w-md mx-auto">
                  This day currently has no live/upcoming slots to show. Use "Sync 7 Days" to enforce canonical coverage.
                </p>
              </Card>
            ) : (
              <Card hover={false} className="overflow-hidden">
                <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <Radio className="w-4 h-4 text-primary-400" />
                    {daySlots.length} shown · target {SLOTS_PER_DAY}/day
                  </h3>
                </div>

                <div className="divide-y divide-white/[0.04]">
                  {daySlots.map((slot) => {
                    const startTime = new Date(slot.startTime)
                    const nowMs = Date.now()
                    const isActive = nowMs >= startTime.getTime() && nowMs < new Date(slot.endTime).getTime()
                    const pendingRequests = slot.requests?.filter((r) => r.status === 'pending') ?? []

                    return (
                      <div key={slot.id} className={`px-4 sm:px-6 py-4 transition-colors ${isActive ? 'bg-red-500/5 border-l-2 border-red-500' : 'hover:bg-white/[0.02]'}`}>
                        <div className="flex items-center gap-4">
                          <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 ${typeColor(slot)}`}>
                            {typeIcon(slot)}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-white">{formatESTRange(slot)}</span>
                              {isActive && <Badge variant="red">● LIVE NOW</Badge>}
                              {/* Inline type selector — 'ceo' is the DB value behind "Open Slot" */}
                              <select
                                value={slot.type}
                                onChange={async (e) => {
                                  try {
                                    await updateSlot(slot.id, { type: e.target.value as SlotType })
                                    await loadSlots()
                                  } catch (err: any) {
                                    setActionError(err?.message || 'Failed to update slot type.')
                                  }
                                }}
                                className={`px-2 py-0.5 bg-white/5 border border-white/10 rounded text-xs focus:outline-none focus:border-primary-500/50 cursor-pointer appearance-none ${slot.type === 'network' ? 'text-gold' : 'text-blue-300'}`}
                              >
                                <option value="open">Open — anyone can claim</option>
                                <option value="network">Network — CSGN Originals</option>
                              </select>
                              {/* Inline status selector */}
                              <select
                                value={slot.status}
                                onChange={async (e) => {
                                  try {
                                    await updateSlotStatus(slot.id, e.target.value as SlotStatus)
                                    await loadSlots()
                                  } catch (err: any) {
                                    setActionError(err?.message || 'Failed to update status.')
                                  }
                                }}
                                className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-xs text-white focus:outline-none focus:border-primary-500/50 cursor-pointer appearance-none"
                              >
                                {SLOT_STATUSES.map((st) => (
                                  <option key={st} value={st}>{st}</option>
                                ))}
                              </select>
                              {pendingRequests.length > 0 && (
                                <Badge variant="purple">{pendingRequests.length} request{pendingRequests.length !== 1 ? 's' : ''}</Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {startTime.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' })} {startTime.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}
                              {slot.assignedName && <span className="text-emerald-400"> — {slot.assignedName}</span>}
                            </p>
                            <p className="text-xs text-gray-600 font-mono truncate mt-0.5">
                              Stream: {slot.streamUrl || DEFAULT_STREAM_URL}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            {pendingRequests.length > 0 && (
                              <Button variant="secondary" size="sm" onClick={() => setRequestModal(slot)}>
                                Requests ({pendingRequests.length})
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-blue-400 hover:text-blue-300"
                              onClick={() => {
                                setStreamOverrideModal(slot)
                                setOverrideUrl(slot.streamUrl || DEFAULT_STREAM_URL)
                              }}
                            >
                              <LinkIcon className="w-3 h-3" />
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => {
                              setAssignModal(slot)
                              setAssignTwitch(twitchHandleFromUrl(slot.streamUrl))
                              setAssignName(slot.assignedName || '')
                              setAssignUid(slot.assignedUid || '')
                              setAssignStreamTitle(slot.streamTitle || '')
                            }}>
                              <UserCheck className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={() => handleDeleteSlot(slot.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}

            {/* Assign / Switch Slot Modal */}
            {assignModal && (
              <Modal
                open
                onClose={() => setAssignModal(null)}
                title={assignModal.type === 'network' ? 'Assign Network Slot' : 'Switch Slot Assignment'}
              >
                <div className="space-y-4">
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2">
                    <p className="text-white font-medium text-sm">{assignModal.label}</p>
                    <p className="text-xs text-gray-500">{new Date(assignModal.startTime).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} ET</p>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Streamer</label>
                    <select
                      value={assignUid}
                      onChange={(e) => {
                        setAssignUid(e.target.value)
                        const u = users.find((u) => u.uid === e.target.value)
                        // Auto-fill the name and Twitch handle from the account.
                        if (u) {
                          setAssignName(u.displayName)
                          if (u.twitchUsername) setAssignTwitch(u.twitchUsername)
                        }
                      }}
                      className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-primary-500/50"
                    >
                      <option value="">Select a streamer…</option>
                      {users.filter((u) => u.role === 'streamer' || u.role === 'admin').map((u) => (
                        <option key={u.uid} value={u.uid}>{u.displayName} ({u.email})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Twitch username</label>
                    <div className="flex items-stretch rounded-xl bg-white/5 border border-white/10 focus-within:border-primary-500/50 overflow-hidden">
                      <span className="px-3 flex items-center text-xs text-gray-500 font-mono bg-white/[0.03] border-r border-white/10 shrink-0">twitch.tv/</span>
                      <input
                        type="text"
                        value={assignTwitch}
                        onChange={(e) => setAssignTwitch(e.target.value.replace(/^@/, '').trim())}
                        className="flex-1 min-w-0 px-3 py-2.5 bg-transparent text-sm text-white font-mono focus:outline-none"
                        placeholder="csgnet"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">Just the username — we build the link.</p>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Display name</label>
                    <input
                      type="text"
                      value={assignName}
                      onChange={(e) => setAssignName(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-primary-500/50"
                      placeholder="Streamer name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Stream title <span className="text-gray-500 text-xs">(shows on /watch + /schedule)</span></label>
                    <input
                      type="text"
                      value={assignStreamTitle}
                      onChange={(e) => setAssignStreamTitle(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-primary-500/50"
                      placeholder="e.g. Crypto Drama Roundup"
                    />
                  </div>

                  <Button variant="primary" size="md" className="w-full" disabled={!assignName.trim()} onClick={handleAssignSlot}>
                    Assign & Notify
                  </Button>
                </div>
              </Modal>
            )}

            {/* Stream URL Override Modal */}
            {streamOverrideModal && (
              <Modal open onClose={() => setStreamOverrideModal(null)} title={"Override Stream URL"} maxWidth="max-w-md">
                  <div className="p-6 space-y-4">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Slot: {streamOverrideModal.label}</p>
                      <p className="text-xs text-gray-500">This URL will be auto-loaded when this slot goes live.</p>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Stream URL</label>
                      <input
                        type="text"
                        value={overrideUrl}
                        onChange={(e) => setOverrideUrl(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-primary-500/50"
                        placeholder={DEFAULT_STREAM_URL}
                      />
                    </div>
                    <Button variant="primary" size="md" className="w-full" onClick={handleStreamOverride}>
                      Save URL
                    </Button>
                  </div>
              </Modal>
            )}

            {/* Slot Requests Modal */}
            {requestModal && (
              <Modal open onClose={() => setRequestModal(null)} title={<>Slot Requests — {requestModal.label}</>} maxWidth="max-w-lg">
                  <div className="p-6 space-y-4">
                    {(requestModal.requests ?? []).length === 0 ? (
                      <p className="text-sm text-gray-500">No requests for this slot.</p>
                    ) : (
                      requestModal.requests!.map((req) => (
                        <div key={req.id} className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-white font-medium text-sm">{req.displayName}</p>
                              <p className="text-xs text-gray-500">{new Date(req.createdAt).toLocaleString()}</p>
                            </div>
                            <Badge variant={req.status === 'accepted' ? 'green' : req.status === 'declined' ? 'red' : 'gold'}>
                              {req.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-300">{req.message}</p>
                          {req.responseNote && (
                            <p className="text-xs text-gray-500 italic">Response: {req.responseNote}</p>
                          )}
                          {req.status === 'pending' && (
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <Button
                                  variant="primary"
                                  size="sm"
                                  className="flex-1"
                                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                                  onClick={() => handleAcceptRequest(requestModal.id, req.id)}
                                >
                                  Accept
                                </Button>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  className="flex-1"
                                  leftIcon={<XCircle className="w-4 h-4" />}
                                  onClick={() => handleDeclineRequest(requestModal.id, req.id)}
                                >
                                  Decline
                                </Button>
                              </div>
                              <input
                                type="text"
                                placeholder="Decline reason (required to decline)"
                                value={declineReason}
                                onChange={(e) => setDeclineReason(e.target.value)}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none"
                              />
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
              </Modal>
            )}
          </div>
        )}

        {/* ── Creator Fees Tab ── */}
        {activeTab === 'fees' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white">Creator Fee Payouts</h3>
              <p className="text-sm text-gray-400 mt-1">
                Undecided payouts sit up top. Once you mark one paid or declined it drops into the history ledger below.
              </p>
            </div>

            <CreatorFeesTab
              feeSlots={feeSlots}
              feeSlotsLoading={feeSlotsLoading}
              users={users}
              feeActionLoading={feeActionLoading}
              onEnterFees={(slot) => {
                setFeeModal(slot)
                setFeeVolume(slot.creatorFees?.tradingVolumeSOL?.toString() ?? '')
                setFeeMarketCap(slot.creatorFees?.marketCapSOL?.toString() ?? '')
                setFeeWallet(slot.creatorFees?.streamerWalletAddress ?? users.find((u) => u.uid === slot.assignedUid)?.walletAddress ?? '')
              }}
              onMarkPaid={handleMarkPaid}
              onDecline={handleDeclineFee}
            />

            {/* Fee Entry Modal */}
            {feeModal && (
              <Modal open onClose={() => setFeeModal(null)} title={<>Enter Fee Data — {feeModal.label}</>} maxWidth="max-w-md">
                  <div className="p-6 space-y-4">
                    <div>
                      <p className="text-sm text-gray-400">Streamer: <span className="text-white">{feeModal.assignedName}</span></p>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">CSGN Trading Volume (in SOL) during this slot</label>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={feeVolume}
                        onChange={(e) => setFeeVolume(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-primary-500/50"
                        placeholder="e.g. 1000.5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Token Market Cap (SOL) for this slot period</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={feeMarketCap}
                        onChange={(e) => setFeeMarketCap(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-primary-500/50"
                        placeholder="e.g. 380"
                      />
                    </div>
                    {feeVolume && !isNaN(parseFloat(feeVolume)) && (
                      <div className="p-3 bg-white/[0.03] rounded-lg border border-white/[0.06] text-sm space-y-1">
                        {(() => {
                          const volume = parseFloat(feeVolume)
                          const mcap = Math.max(0, parseFloat(feeMarketCap || '0'))
                          const tier = resolvePumpFeeTier(mcap)
                          return (
                            <>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Market cap tier</span>
                                <span className="text-white font-mono">{formatTierRange(tier)} ({(tier.creatorFeeRate * 100).toFixed(3)}%)</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Creator fee (tier)</span>
                                <span className="text-white font-mono">{(volume * tier.creatorFeeRate).toFixed(6)} SOL</span>
                              </div>
                              <div className="flex justify-between font-semibold">
                                <span className="text-gray-300">Owed to streamer (30%)</span>
                                <span className="text-yellow-400 font-mono">{estimateCreatorFeeSOL(volume, mcap).toFixed(6)} SOL</span>
                              </div>
                            </>
                          )
                        })()}
                      </div>
                    )}
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Streamer Wallet Address (SOL)</label>
                      <input
                        type="text"
                        value={feeWallet}
                        onChange={(e) => setFeeWallet(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-primary-500/50"
                        placeholder="Solana wallet address"
                      />
                    </div>
                    <Button
                      variant="primary"
                      size="md"
                      className="w-full"
                      disabled={!feeVolume}
                      isLoading={feeActionLoading === feeModal.id}
                      onClick={() => handleSaveFeeRecord(feeModal)}
                    >
                      Save Fee Record
                    </Button>
                    <div className="pt-2 border-t border-white/[0.06]">
                      <p className="text-xs text-gray-500 mb-1">Pump.fun SOL market-cap creator fee tiers:</p>
                      <div className="max-h-28 overflow-auto space-y-1 pr-1">
                        {PUMP_FUN_FEE_TIERS.map((tier) => (
                          <p key={`${tier.minMarketCapSOL}-${tier.maxMarketCapSOL ?? 'max'}`} className="text-[11px] text-gray-400 font-mono">
                            {formatTierRange(tier)} → {(tier.creatorFeeRate * 100).toFixed(3)}%
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
              </Modal>
            )}
          </div>
        )}

        {/* ── Vote History Tab ── */}
        {activeTab === 'votes' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white">Vote History</h3>
              <p className="text-sm text-gray-400 mt-1">
                Every token-weighted vote the network has run. Open votes need closing; closed ones archive by day, week, and month.
              </p>
            </div>

            <VoteHistoryTab
              votes={votes}
              votesLoading={votesLoading}
              closingId={closingVoteId}
              onCloseVote={(vote) => void handleCloseVote(vote, true)}
              onResettleVote={(vote) => void handleCloseVote(vote, false)}
            />
          </div>
        )}

        {activeTab === 'auth' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Auth Events</h2>
                <p className="text-sm text-gray-400">Latest 50 sign-up / sign-in / Twitch link attempts.</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleTestAuthEvent} isLoading={testingAuthLog} variant="ghost" title="Writes a real event through the server pipeline and reloads — proves logging works end to end.">
                  Send test event
                </Button>
                <Button onClick={loadAuthEvents} disabled={authEventsLoading} variant="secondary">
                  <RefreshCw className={`w-4 h-4 mr-2 ${authEventsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>

            {authEventsError && (
              <Card className="p-4 border-red-400/30 bg-red-500/10">
                <p className="text-sm text-red-200">{authEventsError}</p>
              </Card>
            )}

            <Card className="p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.04] text-gray-400">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Time</th>
                    <th className="text-left px-4 py-2 font-medium">Kind</th>
                    <th className="text-left px-4 py-2 font-medium">Twitch</th>
                    <th className="text-left px-4 py-2 font-medium">UID</th>
                    <th className="text-left px-4 py-2 font-medium">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {authEvents.length === 0 && !authEventsLoading && (
                    <tr><td className="px-4 py-3 text-gray-500" colSpan={5}>
                      No auth events recorded yet. Events are written server-side on every sign-in/sign-up attempt — including failures. Hit <span className="text-gray-300">Send test event</span> to confirm the pipeline works.
                    </td></tr>
                  )}
                  {authEvents.map((ev) => {
                    const tsDate = ev.ts && typeof ev.ts === 'object' && 'toDate' in ev.ts && typeof (ev.ts as { toDate: unknown }).toDate === 'function'
                      ? (ev.ts as { toDate: () => Date }).toDate()
                      : null
                    const tsLabel = tsDate ? tsDate.toLocaleString() : '—'
                    const isFailure = ev.kind.endsWith('-failure')
                    return (
                      <tr key={ev.id} className="border-t border-white/[0.06]">
                        <td className="px-4 py-2 text-gray-300 whitespace-nowrap">{tsLabel}</td>
                        <td className={`px-4 py-2 whitespace-nowrap ${isFailure ? 'text-red-300' : 'text-gray-200'}`}>{ev.kind}</td>
                        <td className="px-4 py-2 text-gray-300">{ev.twitchUsername || '—'}</td>
                        <td className="px-4 py-2 text-gray-500 font-mono text-xs">{ev.uid || '—'}</td>
                        <td className="px-4 py-2 text-red-200 text-xs break-all">{ev.errorMessage || ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
