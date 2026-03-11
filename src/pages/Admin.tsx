import { useState, useEffect, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Shield, Users, FileText, Radio, Clock, Check, X, Eye,
  Search, BarChart3, TrendingUp, Plus, Gavel, Crown,
  Trash2, UserCheck, AlertTriangle, Tv, DollarSign,
  Wallet, CheckCircle2, XCircle, RefreshCw, Link as LinkIcon,
} from 'lucide-react'
import {
  collection, query, getDocs, doc, updateDoc, setDoc, onSnapshot, orderBy,
  where,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  generateNextThreeDays,
  wipeAndRegenerateSlots,
  fetchSlots,
  assignCEOSlot,
  assignSlot,
  updateSlotStreamUrl,
  updateSlotStatus,
  resolveAuction,
  deleteSlot,
  acceptSlotRequest,
  declineSlotRequest,
  updateCreatorFees,
  markFeesPaid,
  declineFeesPayment,
  getMinimumBid,
  DEFAULT_STREAM_URL,
  type Slot,
  type SlotType,
  type SlotStatus,
  type CreatorFees,
} from '@/lib/slots'

type Tab = 'overview' | 'applications' | 'streamers' | 'schedule' | 'fees'

interface AppData {
  id: string
  displayName: string
  email: string
  contentType: string
  experience: string
  whyCSGN: string
  twitterHandle: string
  sampleContent: string
  status: string
  createdAt: any
}

interface UserData {
  uid: string
  displayName: string
  email: string
  role: string
  walletAddress?: string
  createdAt: any
}

export default function Admin() {
  const { profile, loading } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [applications, setApplications] = useState<AppData[]>([])
  const [users, setUsers] = useState<UserData[]>([])
  const [selectedApp, setSelectedApp] = useState<AppData | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Schedule state
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [assignModal, setAssignModal] = useState<Slot | null>(null)
  const [assignUid, setAssignUid] = useState('')
  const [assignName, setAssignName] = useState('')
  const [assignDesc, setAssignDesc] = useState('')
  const [assignStreamUrl, setAssignStreamUrl] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  // Slot stream URL override
  const [streamOverrideModal, setStreamOverrideModal] = useState<Slot | null>(null)
  const [overrideUrl, setOverrideUrl] = useState('')

  // Slot request handling
  const [requestModal, setRequestModal] = useState<Slot | null>(null)
  const [declineReason, setDeclineReason] = useState('')

  // Live stream push state
  const [liveStreamUrl, setLiveStreamUrl] = useState('')
  const [liveStreamerName, setLiveStreamerName] = useState('')
  const [liveStreamTitle, setLiveStreamTitle] = useState('')
  const [currentLiveUrl, setCurrentLiveUrl] = useState('')
  const [currentLiveStreamer, setCurrentLiveStreamer] = useState('')
  const [currentLiveTitle, setCurrentLiveTitle] = useState('')
  const [pushingStream, setPushingStream] = useState(false)
  const [wipingSlots, setWipingSlots] = useState(false)
  const [confirmWipe, setConfirmWipe] = useState(false)

  // Fees tab state
  const [feeSlots, setFeeSlots] = useState<Slot[]>([])
  const [feeSlotsLoading, setFeeSlotsLoading] = useState(false)
  const [feeModal, setFeeModal] = useState<Slot | null>(null)
  const [feeVolume, setFeeVolume] = useState('')
  const [feeWallet, setFeeWallet] = useState('')
  const [feeDeclineReason, setFeeDeclineReason] = useState('')
  const [feeActionLoading, setFeeActionLoading] = useState<string | null>(null)

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
      await setDoc(doc(db, 'config', 'liveStream'), {
        url: liveStreamUrl.trim(),
        streamerName: liveStreamerName.trim() || 'CSGN',
        title: liveStreamTitle.trim(),
        updatedAt: new Date().toISOString(),
      })
      setLiveStreamUrl('')
      setLiveStreamerName('')
      setLiveStreamTitle('')
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const appsSnap = await getDocs(query(collection(db, 'applications'), orderBy('createdAt', 'desc')))
        setApplications(appsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AppData)))
      } catch {}

      try {
        const usersSnap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')))
        setUsers(usersSnap.docs.map((d) => ({ ...d.data() } as UserData)))
      } catch {}
    }
    fetchData()
  }, [])

  const loadSlots = useCallback(async () => {
    setSlotsLoading(true)
    const now = new Date()
    // Look back 4h so any currently-running slot is included
    const from = new Date(now.getTime() - 4 * 60 * 60 * 1000)
    const future = new Date(now.getTime() + 72 * 60 * 60 * 1000)
    try {
      const data = await fetchSlots(from, future)
      const nowMs = now.getTime()
      // Sort: currently-active slot first, then ascending by startTime
      const sorted = [...data].sort((a, b) => {
        const aActive = nowMs >= new Date(a.startTime).getTime() && nowMs < new Date(a.endTime).getTime()
        const bActive = nowMs >= new Date(b.startTime).getTime() && nowMs < new Date(b.endTime).getTime()
        if (aActive && !bActive) return -1
        if (bActive && !aActive) return 1
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      })
      setSlots(sorted)
    } catch (err) {
      console.warn('Failed to fetch slots:', err)
    }
    setSlotsLoading(false)
  }, [])

  const loadFeeSlots = useCallback(async () => {
    setFeeSlotsLoading(true)
    // Fetch completed slots from the past 14 days
    const now = new Date()
    const past = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    try {
      const data = await fetchSlots(past, now)
      // Show completed slots that had an assigned streamer
      setFeeSlots(data.filter((s) => s.assignedUid && (s.status === 'completed' || new Date(s.endTime).getTime() < Date.now())))
    } catch {}
    setFeeSlotsLoading(false)
  }, [])

  useEffect(() => {
    if (activeTab === 'schedule') loadSlots()
    if (activeTab === 'fees') loadFeeSlots()
  }, [activeTab, loadSlots, loadFeeSlots])

  const handleAppStatus = async (appId: string, status: 'approved' | 'rejected') => {
    await updateDoc(doc(db, 'applications', appId), { status })
    setApplications((prev) => prev.map((a) => (a.id === appId ? { ...a, status } : a)))
    if (status === 'approved') {
      const app = applications.find((a) => a.id === appId)
      if (app) {
        const usersQ = query(collection(db, 'users'), where('email', '==', app.email))
        const usersSnap = await getDocs(usersQ)
        if (!usersSnap.empty) {
          await updateDoc(doc(db, 'users', usersSnap.docs[0].id), { role: 'streamer' })
        }
      }
    }
    setSelectedApp(null)
  }

  const handleGenerateThreeDays = async () => {
    setGenerating(true)
    setActionError(null)
    try {
      const result = await generateNextThreeDays()
      setActionError(null)
      await loadSlots()
      if (result.generated === 0) {
        setActionError('All slots for the next 3 days already exist.')
      }
    } catch (err: any) {
      setActionError(err?.message || 'Failed to generate slots.')
    }
    setGenerating(false)
  }

  const handleWipeAndRegenerate = async () => {
    setWipingSlots(true)
    setActionError(null)
    setConfirmWipe(false)
    try {
      // Start from March 10, 2026 — wipeAndRegenerateSlots will generate slots
      // for that ET calendar day and the next 2 days.
      // Pass noon UTC on Mar 10 so the ET date resolves to Mar 10.
      const result = await wipeAndRegenerateSlots(new Date('2026-03-10T16:00:00.000Z'))
      await loadSlots()
      if (result.generated === 0) {
        setActionError('No slots were generated.')
      }
    } catch (err: any) {
      setActionError(err?.message || 'Failed to wipe and regenerate slots.')
    }
    setWipingSlots(false)
  }

  const handleResolveAuction = async (slotId: string) => {
    setActionError(null)
    try {
      await resolveAuction(slotId)
      await loadSlots()
    } catch (err: any) {
      setActionError(err?.message || 'Failed to resolve auction.')
    }
  }

  const handleAssignSlot = async () => {
    if (!assignModal || !assignUid.trim() || !assignName.trim()) return
    setActionError(null)
    try {
      if (assignModal.type === 'ceo') {
        await assignCEOSlot(assignModal.id, assignUid, assignName, assignStreamUrl || DEFAULT_STREAM_URL, assignDesc)
      } else {
        await assignSlot(assignModal.id, assignUid, assignName, assignStreamUrl || DEFAULT_STREAM_URL, assignDesc)
      }
      setAssignModal(null)
      setAssignUid('')
      setAssignName('')
      setAssignDesc('')
      setAssignStreamUrl('')
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

      // pump.fun creator fee: 0.5% creator fee on each trade
      // 30% of that goes to the streamer
      // So streamer gets: volume * 0.005 * 0.30 = volume * 0.0015
      const feeOwedSOL = volumeSOL * 0.005 * 0.30

      const fees: CreatorFees = {
        tradingVolumeSOL: volumeSOL,
        feeOwedSOL,
        paymentStatus: 'pending',
        streamerWalletAddress: feeWallet || slot.creatorFees?.streamerWalletAddress || '',
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

  const handleDeclineFee = async (slot: Slot) => {
    if (!feeDeclineReason.trim()) {
      setActionError('Please provide a reason.')
      return
    }
    setFeeActionLoading(slot.id)
    try {
      await declineFeesPayment(slot.id, feeDeclineReason)
      setFeeDeclineReason('')
      await loadFeeSlots()
    } catch (err: any) {
      setActionError(err?.message || 'Failed to decline payment.')
    }
    setFeeActionLoading(null)
  }

  const filteredApps = applications.filter((app) => {
    const matchesSearch =
      app.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.email?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter
    return matchesSearch && matchesStatus
  })

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

  const pendingCount = applications.filter((a) => a.status === 'pending').length
  const streamerCount = users.filter((u) => u.role === 'streamer').length

  const tabs = [
    { id: 'overview' as Tab, label: 'Overview', icon: BarChart3 },
    { id: 'applications' as Tab, label: `Applications${pendingCount ? ` (${pendingCount})` : ''}`, icon: FileText },
    { id: 'streamers' as Tab, label: 'Streamers', icon: Users },
    { id: 'schedule' as Tab, label: 'Schedule', icon: Clock },
    { id: 'fees' as Tab, label: 'Creator Fees', icon: DollarSign },
  ]

  const typeIcon = (type: SlotType) => {
    if (type === 'auction') return <Gavel className="w-4 h-4" />
    return <Crown className="w-4 h-4" />
  }

  const typeColor = (type: SlotType) => {
    if (type === 'auction') return 'text-cyan-400'
    return 'text-gold'
  }

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
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Users', value: users.length, icon: Users, color: 'text-primary-400' },
                { label: 'Active Streamers', value: streamerCount, icon: Radio, color: 'text-emerald-400' },
                { label: 'Pending Apps', value: pendingCount, icon: FileText, color: 'text-amber-400' },
                { label: 'Total Apps', value: applications.length, icon: TrendingUp, color: 'text-accent-400' },
              ].map((stat) => (
                <Card key={stat.label} hover={false} className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <div className="text-3xl font-bold font-display text-white">{stat.value}</div>
                  <p className="text-sm text-gray-500 mt-0.5">{stat.label}</p>
                </Card>
              ))}
            </div>

            {/* Push Stream Live */}
            <Card hover={false} className="overflow-hidden">
              <div className="p-4 border-b border-white/[0.06] flex items-center gap-2">
                <Tv className="w-5 h-5 text-red-400" />
                <h3 className="font-semibold text-white">Push Stream Live (Manual Override)</h3>
              </div>
              <div className="p-4 space-y-4">
                {currentLiveUrl && (
                  <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] text-red-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" /> Override Active
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
                  <label className="block text-sm text-gray-300 mb-1">Stream URL (Twitch or YouTube)</label>
                  <input
                    type="text"
                    value={liveStreamUrl}
                    onChange={(e) => setLiveStreamUrl(e.target.value)}
                    placeholder="https://twitch.tv/channel or https://youtube.com/watch?v=..."
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Streamer Name</label>
                  <input
                    type="text"
                    value={liveStreamerName}
                    onChange={(e) => setLiveStreamerName(e.target.value)}
                    placeholder="e.g. shrood"
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Stream Title <span className="text-gray-500 text-xs">(shown instead of "No Stream")</span></label>
                  <input
                    type="text"
                    value={liveStreamTitle}
                    onChange={(e) => setLiveStreamTitle(e.target.value)}
                    placeholder="e.g. Late Night Crypto Talk"
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50"
                  />
                </div>
                <Button
                  variant="primary"
                  size="md"
                  className="w-full"
                  disabled={!liveStreamUrl.trim()}
                  isLoading={pushingStream}
                  leftIcon={<Tv className="w-4 h-4" />}
                  onClick={handlePushStream}
                >
                  Push to Live
                </Button>
              </div>
            </Card>

            <Card hover={false} className="overflow-hidden">
              <div className="p-4 border-b border-white/[0.06]">
                <h3 className="font-semibold text-white">Recent Applications</h3>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {applications.slice(0, 5).map((app) => (
                  <div key={app.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <span className="text-sm font-medium text-white">{app.displayName}</span>
                      <span className="text-xs text-gray-500 block">{app.email}</span>
                    </div>
                    <Badge variant={app.status === 'approved' ? 'green' : app.status === 'rejected' ? 'red' : 'gold'}>
                      {app.status}
                    </Badge>
                  </div>
                ))}
                {applications.length === 0 && (
                  <div className="text-center py-8 text-gray-500 text-sm">No applications yet</div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ── Applications Tab ── */}
        {activeTab === 'applications' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-primary-500/50 appearance-none cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <Card hover={false} className="overflow-hidden">
              <div className="divide-y divide-white/[0.04]">
                {filteredApps.map((app) => (
                  <div key={app.id} className="flex items-center gap-4 px-4 sm:px-6 py-4 hover:bg-white/[0.02] transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/20 to-accent-600/20 flex items-center justify-center text-sm font-bold text-primary-400 shrink-0">
                      {(app.displayName || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{app.displayName}</span>
                        <Badge variant={app.status === 'approved' ? 'green' : app.status === 'rejected' ? 'red' : 'gold'}>
                          {app.status}
                        </Badge>
                      </div>
                      <span className="text-xs text-gray-500">{app.email} &middot; {app.contentType}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedApp(app)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      {app.status === 'pending' && (
                        <>
                          <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300" onClick={() => handleAppStatus(app.id, 'approved')}>
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={() => handleAppStatus(app.id, 'rejected')}>
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {filteredApps.length === 0 && (
                  <div className="text-center py-12 text-gray-500 text-sm">No applications found</div>
                )}
              </div>
            </Card>

            {/* App Detail Modal */}
            {selectedApp && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedApp(null)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative w-full max-w-lg bg-[#0c0c1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] overflow-y-auto"
                >
                  <div className="p-6 border-b border-white/[0.06] flex items-center justify-between sticky top-0 bg-[#0c0c1a]">
                    <h3 className="font-bold text-white">Application Details</h3>
                    <button onClick={() => setSelectedApp(null)} className="p-1 text-gray-400 hover:text-white cursor-pointer">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-6 space-y-4">
                    {[
                      ['Name', selectedApp.displayName],
                      ['Email', selectedApp.email],
                      ['Content Type', selectedApp.contentType],
                      ['Twitter', selectedApp.twitterHandle || 'N/A'],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
                        <p className="text-white">{value}</p>
                      </div>
                    ))}
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wider">Experience</span>
                      <p className="text-gray-300 text-sm">{selectedApp.experience}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wider">Why CSGN</span>
                      <p className="text-gray-300 text-sm">{selectedApp.whyCSGN}</p>
                    </div>
                    {selectedApp.sampleContent && (
                      <div>
                        <span className="text-xs text-gray-500 uppercase tracking-wider">Sample Content</span>
                        <a href={selectedApp.sampleContent} target="_blank" rel="noopener noreferrer" className="text-primary-400 text-sm block hover:underline">
                          {selectedApp.sampleContent}
                        </a>
                      </div>
                    )}
                    {selectedApp.status === 'pending' && (
                      <div className="flex gap-3 pt-4 border-t border-white/[0.06]">
                        <Button variant="primary" size="md" className="flex-1" leftIcon={<Check className="w-4 h-4" />} onClick={() => handleAppStatus(selectedApp.id, 'approved')}>
                          Approve
                        </Button>
                        <Button variant="danger" size="md" className="flex-1" leftIcon={<X className="w-4 h-4" />} onClick={() => handleAppStatus(selectedApp.id, 'rejected')}>
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </div>
        )}

        {/* ── Streamers Tab ── */}
        {activeTab === 'streamers' && (
          <Card hover={false} className="overflow-hidden">
            <div className="p-4 border-b border-white/[0.06] flex items-center justify-between gap-3">
              <h3 className="font-semibold text-white">Active Streamers</h3>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<UserCheck className="w-4 h-4" />}
                onClick={async () => {
                  setActionError(null)
                  try {
                    const approvedApps = applications.filter((a) => a.status === 'approved')
                    let synced = 0
                    for (const app of approvedApps) {
                      const q = query(collection(db, 'users'), where('email', '==', app.email))
                      const snap = await getDocs(q)
                      if (!snap.empty) {
                        const userDoc = snap.docs[0]
                        if (userDoc.data().role !== 'streamer' && userDoc.data().role !== 'admin') {
                          await updateDoc(doc(db, 'users', userDoc.id), { role: 'streamer' })
                          synced++
                        }
                      }
                    }
                    const usersSnap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')))
                    setUsers(usersSnap.docs.map((d) => ({ ...d.data() } as UserData)))
                    setActionError(synced > 0 ? null : 'All approved applicants are already Active Streamers.')
                    if (synced > 0) alert(`Synced ${synced} user(s) to Active Streamer status.`)
                  } catch (err: any) {
                    setActionError(err?.message || 'Sync failed.')
                  }
                }}
              >
                Sync Approved → Streamer
              </Button>
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
                <h3 className="text-lg font-semibold text-white">Upcoming Slots (Next 72h)</h3>
                <p className="text-sm text-gray-400">Generate 3 days of slots, resolve auctions, assign CEO Schedule, manage stream URLs.</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="ghost" size="sm" leftIcon={<RefreshCw className="w-4 h-4" />} onClick={loadSlots}>
                  Refresh
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-4 h-4" />}
                  isLoading={generating}
                  onClick={handleGenerateThreeDays}
                >
                  Generate Next 3 Days
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
                    <span className="text-xs text-red-400">Wipe all slots & reseed from 3/10 1AM ET?</span>
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

            {slotsLoading ? (
              <div className="py-16 text-center">
                <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-500">Loading slots...</p>
              </div>
            ) : slots.length === 0 ? (
              <Card hover={false} className="p-8 text-center">
                <Clock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No Upcoming Slots</h3>
                <p className="text-sm text-gray-400 max-w-md mx-auto">
                  Click "Generate Next 3 Days" to create the upcoming schedule (72 hours of slots at once).
                </p>
              </Card>
            ) : (
              <Card hover={false} className="overflow-hidden">
                <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <Radio className="w-4 h-4 text-primary-400" />
                    {slots.length} slots
                  </h3>
                </div>

                <div className="divide-y divide-white/[0.04]">
                  {slots.map((slot) => {
                    const startTime = new Date(slot.startTime)
                    const nowMs = Date.now()
                    const isActive = nowMs >= startTime.getTime() && nowMs < new Date(slot.endTime).getTime()
                    const hoursUntil = (startTime.getTime() - nowMs) / (1000 * 60 * 60)
                    const canResolve = hoursUntil <= 2 && slot.status === 'open'
                    const pendingRequests = slot.requests?.filter((r) => r.status === 'pending') ?? []

                    return (
                      <div key={slot.id} className={`px-4 sm:px-6 py-4 transition-colors ${isActive ? 'bg-red-500/5 border-l-2 border-red-500' : 'hover:bg-white/[0.02]'}`}>
                        <div className="flex items-center gap-4">
                          <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 ${typeColor(slot.type)}`}>
                            {typeIcon(slot.type)}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-white">{slot.label}</span>
                              {isActive && <Badge variant="red">● LIVE NOW</Badge>}
                              <Badge variant={slot.type === 'ceo' ? 'gold' : 'blue'}>
                                {slot.type === 'auction' ? 'Auction' : 'CEO'}
                              </Badge>
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
                                <option value="open">open</option>
                                <option value="closing">closing</option>
                                <option value="pending_deposit">pending_deposit</option>
                                <option value="confirmed">confirmed</option>
                                <option value="live">live</option>
                                <option value="completed">completed</option>
                                <option value="unfilled">unfilled</option>
                              </select>
                              {pendingRequests.length > 0 && (
                                <Badge variant="purple">{pendingRequests.length} request{pendingRequests.length !== 1 ? 's' : ''}</Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {startTime.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' })} {startTime.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}
                              {slot.assignedName && <span className="text-emerald-400"> — {slot.assignedName}</span>}
                              {slot.type === 'auction' && ` — ${slot.bids.length} bid${slot.bids.length !== 1 ? 's' : ''}`}
                              {slot.type === 'auction' && slot.bids.length > 0 && ` (top: ${Math.max(...slot.bids.map(b => b.amount)).toLocaleString()} CSGN, next: ${getMinimumBid(slot.bids.length).toLocaleString()} CSGN)`}
                            </p>
                            <p className="text-xs text-gray-600 font-mono truncate mt-0.5">
                              Stream: {slot.streamUrl || DEFAULT_STREAM_URL}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            {slot.type === 'auction' && canResolve && slot.bids.length > 0 && (
                              <Button variant="primary" size="sm" onClick={() => handleResolveAuction(slot.id)}>
                                <Gavel className="w-3 h-3 mr-1" /> Resolve
                              </Button>
                            )}
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
                              setAssignStreamUrl(slot.streamUrl || '')
                              setAssignName(slot.assignedName || '')
                              setAssignUid(slot.assignedUid || '')
                              setAssignDesc(slot.description || '')
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
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setAssignModal(null)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative w-full max-w-md bg-[#0c0c1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                >
                  <div className="p-6 border-b border-white/[0.06] flex items-center justify-between">
                    <h3 className="font-bold text-white">
                      {assignModal.type === 'ceo' ? 'Assign CEO Schedule Slot' : 'Switch Slot Assignment'}
                    </h3>
                    <button onClick={() => setAssignModal(null)} className="p-1 text-gray-400 hover:text-white cursor-pointer">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Slot</p>
                      <p className="text-white font-medium">{assignModal.label}</p>
                      <p className="text-xs text-gray-500">{new Date(assignModal.startTime).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}</p>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Streamer</label>
                      <select
                        value={assignUid}
                        onChange={(e) => {
                          setAssignUid(e.target.value)
                          const u = users.find((u) => u.uid === e.target.value)
                          if (u) setAssignName(u.displayName)
                        }}
                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-primary-500/50 appearance-none cursor-pointer"
                      >
                        <option value="">Select a streamer...</option>
                        {users.filter((u) => u.role === 'streamer' || u.role === 'admin').map((u) => (
                          <option key={u.uid} value={u.uid}>{u.displayName} ({u.email})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Display Name</label>
                      <input
                        type="text"
                        value={assignName}
                        onChange={(e) => setAssignName(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-primary-500/50"
                        placeholder="Streamer name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Stream URL</label>
                      <input
                        type="text"
                        value={assignStreamUrl}
                        onChange={(e) => setAssignStreamUrl(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white font-mono text-xs focus:outline-none focus:border-primary-500/50"
                        placeholder={DEFAULT_STREAM_URL}
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Description</label>
                      <input
                        type="text"
                        value={assignDesc}
                        onChange={(e) => setAssignDesc(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-primary-500/50"
                        placeholder="e.g. Crypto Drama Roundup"
                      />
                    </div>

                    <Button
                      variant="primary"
                      size="md"
                      className="w-full"
                      disabled={!assignName.trim()}
                      onClick={handleAssignSlot}
                    >
                      Assign & Notify
                    </Button>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Stream URL Override Modal */}
            {streamOverrideModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setStreamOverrideModal(null)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative w-full max-w-md bg-[#0c0c1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                >
                  <div className="p-6 border-b border-white/[0.06] flex items-center justify-between">
                    <h3 className="font-bold text-white">Override Stream URL</h3>
                    <button onClick={() => setStreamOverrideModal(null)} className="p-1 text-gray-400 hover:text-white cursor-pointer">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
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
                </motion.div>
              </div>
            )}

            {/* Slot Requests Modal */}
            {requestModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setRequestModal(null)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative w-full max-w-lg bg-[#0c0c1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] overflow-y-auto"
                >
                  <div className="p-6 border-b border-white/[0.06] flex items-center justify-between sticky top-0 bg-[#0c0c1a]">
                    <h3 className="font-bold text-white">Slot Requests — {requestModal.label}</h3>
                    <button onClick={() => setRequestModal(null)} className="p-1 text-gray-400 hover:text-white cursor-pointer">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
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
                </motion.div>
              </div>
            )}
          </div>
        )}

        {/* ── Creator Fees Tab ── */}
        {activeTab === 'fees' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white">Creator Fee Payouts</h3>
              <p className="text-sm text-gray-400 mt-1">
                Streamers earn 30% of pump.fun creator fees (0.5% of each trade) generated during their slot.
                Enter trading volume to calculate owed amounts.
              </p>
            </div>

            <Card hover={false} className="p-4 bg-cyan-500/5 border-cyan-500/20">
              <div className="flex items-start gap-3">
                <DollarSign className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-white font-medium">Fee Formula</p>
                  <p className="text-xs text-gray-400 mt-1">
                    pump.fun charges 1% per trade (buy/sell). 0.5% goes to the creator.
                    Streamers receive 30% of that → <span className="font-mono text-cyan-400">Volume × 0.005 × 0.30 = Owed SOL</span>
                  </p>
                </div>
              </div>
            </Card>

            {feeSlotsLoading ? (
              <div className="py-16 text-center">
                <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-500">Loading completed slots...</p>
              </div>
            ) : feeSlots.length === 0 ? (
              <Card hover={false} className="p-8 text-center">
                <DollarSign className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No Completed Slots</h3>
                <p className="text-sm text-gray-400 max-w-md mx-auto">
                  Completed slots with assigned streamers will appear here for fee management.
                </p>
              </Card>
            ) : (
              <Card hover={false} className="overflow-hidden">
                <div className="p-4 border-b border-white/[0.06]">
                  <h3 className="font-semibold text-white">{feeSlots.length} completed slot{feeSlots.length !== 1 ? 's' : ''}</h3>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {feeSlots.map((slot) => {
                    const fees = slot.creatorFees
                    const streamerUser = users.find((u) => u.uid === slot.assignedUid)

                    return (
                      <div key={slot.id} className="px-4 sm:px-6 py-4">
                        <div className="flex items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-white">{slot.label}</span>
                              <span className="text-xs text-gray-500">{new Date(slot.startTime).toLocaleDateString()}</span>
                              {fees && (
                                <Badge variant={fees.paymentStatus === 'paid' ? 'green' : fees.paymentStatus === 'declined' ? 'red' : 'gold'}>
                                  {fees.paymentStatus}
                                </Badge>
                              )}
                            </div>

                            <p className="text-sm text-emerald-400 font-medium">{slot.assignedName}</p>

                            {streamerUser?.walletAddress && (
                              <div className="flex items-center gap-1 mt-1">
                                <Wallet className="w-3 h-3 text-gray-500" />
                                <span className="text-xs text-gray-400 font-mono">{streamerUser.walletAddress}</span>
                              </div>
                            )}

                            {fees ? (
                              <div className="mt-2 p-3 bg-white/[0.03] border border-white/[0.06] rounded-lg space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-500">Trading Volume</span>
                                  <span className="text-white font-mono">{fees.tradingVolumeSOL.toFixed(4)} SOL</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-500">Creator Fee (0.5%)</span>
                                  <span className="text-white font-mono">{(fees.tradingVolumeSOL * 0.005).toFixed(6)} SOL</span>
                                </div>
                                <div className="flex items-center justify-between text-sm font-semibold border-t border-white/[0.06] pt-1 mt-1">
                                  <span className="text-gray-300">Owed to Streamer (30%)</span>
                                  <span className="text-yellow-400 font-mono">{fees.feeOwedSOL.toFixed(6)} SOL</span>
                                </div>
                                {fees.streamerWalletAddress && (
                                  <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                    <Wallet className="w-3 h-3" />
                                    <span className="font-mono truncate">{fees.streamerWalletAddress}</span>
                                  </div>
                                )}
                                {fees.paymentStatus === 'declined' && fees.declineReason && (
                                  <p className="text-xs text-red-400 mt-1">Declined: {fees.declineReason}</p>
                                )}
                                {fees.paidAt && (
                                  <p className="text-xs text-emerald-400 mt-1">Paid: {new Date(fees.paidAt).toLocaleString()}</p>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-600 mt-1">No fee record — click "Enter Fees" to add.</p>
                            )}
                          </div>

                          <div className="flex flex-col gap-2 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-cyan-400 hover:text-cyan-300"
                              onClick={() => {
                                setFeeModal(slot)
                                setFeeVolume(slot.creatorFees?.tradingVolumeSOL?.toString() ?? '')
                                setFeeWallet(slot.creatorFees?.streamerWalletAddress ?? streamerUser?.walletAddress ?? '')
                              }}
                            >
                              <DollarSign className="w-3 h-3 mr-1" />
                              {fees ? 'Edit' : 'Enter Fees'}
                            </Button>
                            {fees && fees.paymentStatus === 'pending' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-emerald-400 hover:text-emerald-300"
                                  isLoading={feeActionLoading === slot.id}
                                  onClick={() => handleMarkPaid(slot)}
                                >
                                  <CheckCircle2 className="w-3 h-3 mr-1" /> Mark Paid
                                </Button>
                                <div className="space-y-1">
                                  <input
                                    type="text"
                                    placeholder="Decline reason..."
                                    value={feeDeclineReason}
                                    onChange={(e) => setFeeDeclineReason(e.target.value)}
                                    className="w-36 px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full text-red-400 hover:text-red-300 text-xs"
                                    isLoading={feeActionLoading === slot.id}
                                    onClick={() => handleDeclineFee(slot)}
                                  >
                                    <XCircle className="w-3 h-3 mr-1" /> Decline
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}

            {/* Fee Entry Modal */}
            {feeModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setFeeModal(null)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative w-full max-w-md bg-[#0c0c1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                >
                  <div className="p-6 border-b border-white/[0.06] flex items-center justify-between">
                    <h3 className="font-bold text-white">Enter Fee Data — {feeModal.label}</h3>
                    <button onClick={() => setFeeModal(null)} className="p-1 text-gray-400 hover:text-white cursor-pointer">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
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
                    {feeVolume && !isNaN(parseFloat(feeVolume)) && (
                      <div className="p-3 bg-white/[0.03] rounded-lg border border-white/[0.06] text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Creator fee (0.5%)</span>
                          <span className="text-white font-mono">{(parseFloat(feeVolume) * 0.005).toFixed(6)} SOL</span>
                        </div>
                        <div className="flex justify-between font-semibold">
                          <span className="text-gray-300">Owed to streamer (30%)</span>
                          <span className="text-yellow-400 font-mono">{(parseFloat(feeVolume) * 0.005 * 0.30).toFixed(6)} SOL</span>
                        </div>
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
                  </div>
                </motion.div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
