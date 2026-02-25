import { useState, useEffect } from 'react'
import { Navigate, Link } from 'react-router-dom'
import {
  User, Mail, Edit3, Save, Radio, TrendingUp,
  FileText, Tv, Twitter, Youtube,
} from 'lucide-react'
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

interface Application {
  id: string
  status: string
  contentType: string
  createdAt: any
}

export default function Dashboard() {
  const { user, profile, loading, refreshProfile } = useAuth()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [applications, setApplications] = useState<Application[]>([])
  const [formData, setFormData] = useState({
    displayName: '',
    bio: '',
    twitter: '',
    twitch: '',
    youtube: '',
  })

  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.displayName || '',
        bio: profile.bio || '',
        twitter: profile.socialLinks?.twitter || '',
        twitch: profile.socialLinks?.twitch || '',
        youtube: profile.socialLinks?.youtube || '',
      })
    }
  }, [profile])

  useEffect(() => {
    if (user) {
      const fetchApps = async () => {
        const q = query(collection(db, 'applications'), where('uid', '==', user.uid))
        const snap = await getDocs(q)
        setApplications(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Application)))
      }
      fetchApps()
    }
  }, [user])

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: formData.displayName,
        bio: formData.bio,
        socialLinks: {
          twitter: formData.twitter,
          twitch: formData.twitch,
          youtube: formData.youtube,
        },
      })
      await refreshProfile()
      setEditing(false)
    } catch {
      // handle error silently
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!user) return <Navigate to="/" replace />

  return (
    <div className="min-h-screen pt-24 lg:pt-32 pb-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold font-display text-white">Dashboard</h1>
            <p className="text-gray-400 mt-1">Manage your CSGN profile and applications</p>
          </div>
          <Badge variant={profile?.role === 'streamer' ? 'green' : profile?.role === 'admin' ? 'gold' : 'blue'}>
            {profile?.role || 'viewer'}
          </Badge>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="lg:col-span-2">
            <Card hover={false} className="overflow-hidden">
              <div className="p-6 border-b border-white/[0.06] flex items-center justify-between">
                <h2 className="text-lg font-semibold font-display text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-primary-400" />
                  Profile
                </h2>
                {editing ? (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                    <Button variant="primary" size="sm" onClick={handleSave} isLoading={saving} leftIcon={<Save className="w-3.5 h-3.5" />}>
                      Save
                    </Button>
                  </div>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => setEditing(true)} leftIcon={<Edit3 className="w-3.5 h-3.5" />}>
                    Edit
                  </Button>
                )}
              </div>

              <div className="p-6 space-y-6">
                {/* Avatar & Name */}
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center text-2xl font-bold text-white shrink-0">
                    {(profile?.displayName || 'U')[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    {editing ? (
                      <input
                        type="text"
                        value={formData.displayName}
                        onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-lg font-semibold focus:outline-none focus:border-primary-500/50"
                      />
                    ) : (
                      <h3 className="text-lg font-bold text-white">{profile?.displayName}</h3>
                    )}
                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                      <Mail className="w-3.5 h-3.5" />
                      {profile?.email}
                    </p>
                  </div>
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Bio</label>
                  {editing ? (
                    <textarea
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-primary-500/50 resize-none"
                      placeholder="Tell the community about yourself..."
                    />
                  ) : (
                    <p className="text-sm text-gray-400">{profile?.bio || 'No bio set.'}</p>
                  )}
                </div>

                {/* Social Links */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">Social Links</label>
                  <div className="space-y-3">
                    {[
                      { key: 'twitter' as const, icon: Twitter, label: 'Twitter / X', placeholder: '@handle' },
                      { key: 'twitch' as const, icon: Tv, label: 'Twitch', placeholder: 'channel name' },
                      { key: 'youtube' as const, icon: Youtube, label: 'YouTube', placeholder: 'channel URL' },
                    ].map((social) => (
                      <div key={social.key} className="flex items-center gap-3">
                        <social.icon className="w-4 h-4 text-gray-500 shrink-0" />
                        {editing ? (
                          <input
                            type="text"
                            value={formData[social.key]}
                            onChange={(e) => setFormData({ ...formData, [social.key]: e.target.value })}
                            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-primary-500/50"
                            placeholder={social.placeholder}
                          />
                        ) : (
                          <span className="text-sm text-gray-400">
                            {formData[social.key] || `No ${social.label} linked`}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card hover={false} className="p-5">
              <h3 className="font-semibold text-white text-sm mb-4">Quick Stats</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Applications
                  </span>
                  <span className="text-sm font-medium text-white">{applications.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400 flex items-center gap-2">
                    <Radio className="w-4 h-4" /> Streams
                  </span>
                  <span className="text-sm font-medium text-white">0</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" /> Earnings
                  </span>
                  <span className="text-sm font-medium text-white">$0.00</span>
                </div>
              </div>
            </Card>

            {/* Applications Status */}
            <Card hover={false} className="p-5">
              <h3 className="font-semibold text-white text-sm mb-4">My Applications</h3>
              {applications.length === 0 ? (
                <div className="text-center py-4">
                  <FileText className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 mb-3">No applications yet</p>
                  <Link to="/apply">
                    <Button variant="primary" size="sm">Apply to Stream</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {applications.map((app) => (
                    <div key={app.id} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                      <div>
                        <span className="text-sm text-white font-medium">{app.contentType}</span>
                        <span className="text-xs text-gray-500 block mt-0.5">
                          {app.createdAt?.toDate ? app.createdAt.toDate().toLocaleDateString() : 'Pending'}
                        </span>
                      </div>
                      <Badge variant={app.status === 'approved' ? 'green' : app.status === 'rejected' ? 'red' : 'gold'}>
                        {app.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
