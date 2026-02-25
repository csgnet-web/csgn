import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Maximize2, Minimize2, MessageSquare, Clock, Users, Radio,
  ChevronRight, ExternalLink,
} from 'lucide-react'
import { LiveIndicator } from '@/components/ui/LiveIndicator'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

const currentSchedule = [
  { time: '6:00 AM', streamer: 'Open Slot', type: 'Auction', status: 'upcoming' as const },
  { time: '8:00 AM', streamer: 'CryptoKing', type: 'Auction', status: 'upcoming' as const },
  { time: '10:00 AM', streamer: 'BlockchainBets', type: 'Auction', status: 'upcoming' as const },
  { time: '12:00 PM', streamer: 'SolanaSteve', type: 'Auction', status: 'live' as const },
  { time: '2:00 PM', streamer: 'TBA (Lottery)', type: 'Lottery', status: 'upcoming' as const },
  { time: '4:00 PM', streamer: 'TBA (Lottery)', type: 'Lottery', status: 'upcoming' as const },
  { time: '6:00 PM', streamer: 'CEO Show', type: 'Prime', status: 'upcoming' as const },
  { time: '8:00 PM', streamer: 'Night Shift', type: 'Prime', status: 'upcoming' as const },
  { time: '10:00 PM', streamer: 'Late Night Crypto', type: 'Prime', status: 'upcoming' as const },
]

export default function Watch() {
  const [isTheaterMode, setIsTheaterMode] = useState(false)
  const [chatVisible, setChatVisible] = useState(true)

  return (
    <div className="min-h-screen pt-16 lg:pt-20">
      <div className={`max-w-[1800px] mx-auto ${isTheaterMode ? 'px-0' : 'px-4 sm:px-6 lg:px-8'}`}>
        <div className={`flex flex-col ${chatVisible && !isTheaterMode ? 'lg:flex-row' : ''} gap-4 py-4`}>
          {/* Main Stream Area */}
          <div className="flex-1 min-w-0">
            {/* Stream Player */}
            <div className={`relative bg-black rounded-2xl overflow-hidden border border-white/[0.06] ${isTheaterMode ? 'rounded-none' : ''}`}>
              <div className="aspect-video bg-gradient-to-br from-surface-900 to-[#06060e] flex items-center justify-center relative">
                {/* Placeholder for the live stream embed */}
                <div className="absolute inset-0 bg-grid opacity-30" />
                <div className="relative text-center px-4">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center font-display font-bold text-2xl text-white mx-auto mb-6 shadow-2xl shadow-primary-600/30">
                    CS
                  </div>
                  <LiveIndicator className="justify-center mb-4" />
                  <h2 className="text-2xl sm:text-3xl font-bold font-display text-white mb-2">CSGN is Live</h2>
                  <p className="text-gray-400 text-sm max-w-md mx-auto mb-6">
                    The 24/7 crypto-native streaming network. Connect your stream to watch live content.
                  </p>
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <a
                      href="https://pump.fun"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="primary" size="md" leftIcon={<ExternalLink className="w-4 h-4" />}>
                        Watch on pump.fun
                      </Button>
                    </a>
                  </div>
                </div>
              </div>

              {/* Controls bar */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <LiveIndicator />
                    <span className="text-sm text-gray-300 hidden sm:block">CSGN Network</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setChatVisible(!chatVisible)}
                      className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all cursor-pointer lg:block hidden"
                      title={chatVisible ? 'Hide chat' : 'Show chat'}
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setIsTheaterMode(!isTheaterMode)}
                      className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all cursor-pointer"
                      title={isTheaterMode ? 'Exit theater' : 'Theater mode'}
                    >
                      {isTheaterMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Stream Info */}
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-xl font-bold font-display text-white">CSGN Live Network</h1>
                  <Badge variant="live" pulse>LIVE</Badge>
                </div>
                <p className="text-sm text-gray-400">
                  24/7 Crypto Sports & Gaming Network &middot; The ESPN and TMZ of Crypto
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  <span className="text-white font-medium">--</span> watching
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  Started 24/7
                </span>
              </div>
            </div>
          </div>

          {/* Sidebar - Schedule & Chat */}
          {chatVisible && !isTheaterMode && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:w-[380px] shrink-0 flex flex-col gap-4"
            >
              {/* Today's Schedule */}
              <Card hover={false} className="overflow-hidden">
                <div className="p-4 border-b border-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold font-display text-white flex items-center gap-2">
                      <Radio className="w-4 h-4 text-primary-400" />
                      Today's Schedule
                    </h3>
                    <Badge variant="blue">EST</Badge>
                  </div>
                </div>
                <div className="max-h-[500px] overflow-y-auto">
                  {currentSchedule.map((slot, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 px-4 py-3 border-b border-white/[0.03] last:border-0 transition-colors ${
                        slot.status === 'live' ? 'bg-primary-500/5' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <span className="text-xs font-mono text-gray-500 w-16 shrink-0">{slot.time}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium truncate ${slot.status === 'live' ? 'text-white' : 'text-gray-300'}`}>
                            {slot.streamer}
                          </span>
                          {slot.status === 'live' && <LiveIndicator />}
                        </div>
                      </div>
                      <Badge
                        variant={slot.type === 'Prime' ? 'gold' : slot.type === 'Lottery' ? 'purple' : 'default'}
                      >
                        {slot.type}
                      </Badge>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-white/[0.06]">
                  <a href="/schedule" className="flex items-center justify-center gap-1.5 text-sm text-primary-400 hover:text-primary-300 font-medium transition-colors">
                    View Full Schedule <ChevronRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </Card>

              {/* Chat */}
              <Card hover={false} className="flex-1 min-h-[300px] flex flex-col overflow-hidden">
                <div className="p-4 border-b border-white/[0.06]">
                  <h3 className="font-semibold font-display text-white flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary-400" />
                    Live Chat
                  </h3>
                </div>
                <div className="flex-1 flex items-center justify-center p-6 text-center">
                  <div>
                    <MessageSquare className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">Chat is available when watching on pump.fun</p>
                    <a
                      href="https://pump.fun"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary-400 hover:text-primary-300 font-medium mt-2 transition-colors"
                    >
                      Join on pump.fun <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
