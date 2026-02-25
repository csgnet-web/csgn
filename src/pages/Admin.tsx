import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Shield, Users, FileText, Radio, Clock, Check, X, Eye,
  Search, BarChart3, TrendingUp,
} from 'lucide-react'
import {
  collection, query, getDocs, doc, updateDoc, orderBy,
  where,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

type Tab = 'overview' | 'applications' | 'streamers' | 'schedule'

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

  useEffect(() => {
    const fetchData = async () => {
      // Fetch applications
      const appsSnap = await getDocs(query(collection(db, 'applications'), orderBy('createdAt', 'desc')))
      setApplications(appsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AppData)))

      // Fetch users
      const usersSnap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')))
      setUsers(usersSnap.docs.map((d) => ({ ...d.data() } as UserData)))
    }
    fetchData()
  }, [])

  const handleAppStatus = async (appId: string, status: 'approved' | 'rejected') => {
    await updateDoc(doc(db, 'applications', appId), { status })
    setApplications((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, status } : a))
    )
    if (status === 'approved') {
      const app = applications.find((a) => a.id === appId)
      if (app) {
        // Promote user to streamer
        const usersQ = query(collection(db, 'users'), where('email', '==', app.email))
        const usersSnap = await getDocs(usersQ)
        if (!usersSnap.empty) {
          await updateDoc(doc(db, 'users', usersSnap.docs[0].id), { role: 'streamer' })
        }
      }
    }
    setSelectedApp(null)
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
    { id: 'applications' as Tab, label: `Applications ${pendingCount ? `(${pendingCount})` : ''}`, icon: FileText },
    { id: 'streamers' as Tab, label: 'Streamers', icon: Users },
    { id: 'schedule' as Tab, label: 'Schedule', icon: Clock },
  ]

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

        {/* Overview Tab */}
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

            {/* Recent Applications */}
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

        {/* Applications Tab */}
        {activeTab === 'applications' && (
          <div className="space-y-4">
            {/* Filters */}
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

            {/* Applications List */}
            <Card hover={false} className="overflow-hidden">
              <div className="divide-y divide-white/[0.04]">
                {filteredApps.map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center gap-4 px-4 sm:px-6 py-4 hover:bg-white/[0.02] transition-colors"
                  >
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
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wider">Name</span>
                      <p className="text-white">{selectedApp.displayName}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wider">Email</span>
                      <p className="text-white">{selectedApp.email}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wider">Content Type</span>
                      <p className="text-white">{selectedApp.contentType}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wider">Twitter</span>
                      <p className="text-white">{selectedApp.twitterHandle || 'N/A'}</p>
                    </div>
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
                        <Button
                          variant="primary"
                          size="md"
                          className="flex-1"
                          leftIcon={<Check className="w-4 h-4" />}
                          onClick={() => handleAppStatus(selectedApp.id, 'approved')}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="danger"
                          size="md"
                          className="flex-1"
                          leftIcon={<X className="w-4 h-4" />}
                          onClick={() => handleAppStatus(selectedApp.id, 'rejected')}
                        >
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

        {/* Streamers Tab */}
        {activeTab === 'streamers' && (
          <Card hover={false} className="overflow-hidden">
            <div className="p-4 border-b border-white/[0.06]">
              <h3 className="font-semibold text-white">Active Streamers</h3>
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
                  </div>
                  <Badge variant="green">Streamer</Badge>
                </div>
              ))}
              {users.filter((u) => u.role === 'streamer').length === 0 && (
                <div className="text-center py-12 text-gray-500 text-sm">No streamers yet. Approve applications to add streamers.</div>
              )}
            </div>
          </Card>
        )}

        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <Card hover={false} className="p-8 text-center">
            <Clock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Schedule Management</h3>
            <p className="text-sm text-gray-400 max-w-md mx-auto mb-6">
              Schedule management with drag-and-drop slot assignment, auction management, and lottery draws
              is coming in Phase 2.
            </p>
            <Badge variant="blue">Coming Q3 2026</Badge>
          </Card>
        )}
      </div>
    </div>
  )
}
