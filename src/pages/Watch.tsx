import { useState } from 'react'
import { motion } from 'framer-motion'
import { Maximize2, Minimize2, MessageSquare, Clock, Users, Radio, ChevronRight, ExternalLink } from 'lucide-react'
import { LiveIndicator } from '@/components/ui/LiveIndicator'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'

const currentSchedule = [
  { time: '12:00 PM', streamer: 'SolanaSteve', type: 'Auction', status: 'live' as const },
  { time: '2:00 PM', streamer: 'TBA (Lottery)', type: 'Lottery', status: 'upcoming' as const },
  { time: '4:00 PM', streamer: 'TBA (Lottery)', type: 'Lottery', status: 'upcoming' as const },
  { time: '6:00 PM', streamer: 'CEO Show', type: 'Prime', status: 'upcoming' as const },
]

export default function Watch() {
  const [isTheaterMode, setIsTheaterMode] = useState(false)
  const [chatVisible, setChatVisible] = useState(true)

  return (
    <div className="min-h-screen pt-16 lg:pt-20">
      <div className={`max-w-[1800px] mx-auto ${isTheaterMode ? 'px-0' : 'px-3 sm:px-5 lg:px-6'}`}>
        <div className={`flex flex-col ${chatVisible && !isTheaterMode ? 'lg:flex-row' : ''} gap-4 py-4`}>
          <div className="flex-1 min-w-0">
            <div className={`relative bg-black overflow-hidden border border-red-500/20 shadow-[0_20px_60px_rgba(0,0,0,0.55)] ${isTheaterMode ? 'rounded-none' : 'rounded-2xl'}`}>
              <div className="aspect-video relative">
                <iframe
                  className="absolute inset-0 h-full w-full"
                  src="https://player.twitch.tv/?channel=monstercat&parent=localhost&muted=true"
                  title="CSGN live player"
                  allowFullScreen
                />
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/75 via-transparent to-black/30" />
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-[11px] uppercase tracking-[0.2em] font-mono">
                  <Badge variant="live" pulse>Live</Badge>
                  <span className="px-2 py-1 rounded-full border border-white/20 bg-black/30 text-gray-200">starting 5 · pot: $14.70</span>
                </div>
                <div className="absolute left-4 bottom-4 right-4 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-red-300 tracking-[0.25em] uppercase font-mono">NBA Picks & Analysis</p>
                    <h2 className="text-4xl sm:text-5xl font-display font-black text-white">TRAPKINGZ</h2>
                    <p className="text-sm text-gray-300">8:00 PM - 10:00 PM EST</p>
                  </div>
                  <p className="text-3xl sm:text-5xl text-yellow-300 font-mono">$1237.08</p>
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/95 to-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3"><LiveIndicator /><span className="text-sm text-gray-300 hidden sm:block">CSGN Network</span></div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setChatVisible(!chatVisible)} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all cursor-pointer lg:block hidden" title={chatVisible ? 'Hide chat' : 'Show chat'}><MessageSquare className="w-4 h-4" /></button>
                    <button onClick={() => setIsTheaterMode(!isTheaterMode)} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all cursor-pointer" title={isTheaterMode ? 'Exit theater' : 'Theater mode'}>{isTheaterMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1"><h1 className="text-xl font-bold font-display text-white">CSGN Live Network</h1><Badge variant="live" pulse>LIVE</Badge></div>
                <p className="text-sm text-gray-400">24/7 Crypto Sports & Gaming Network · The ESPN and TMZ of Crypto</p>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /><span className="text-white font-medium">7,589</span> watching</span>
                <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" />Started 24/7</span>
              </div>
            </div>
          </div>

          {chatVisible && !isTheaterMode && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="lg:w-[380px] shrink-0 flex flex-col gap-4">
              <Card hover={false} className="overflow-hidden">
                <div className="p-4 border-b border-white/[0.06]"><div className="flex items-center justify-between"><h3 className="font-semibold font-display text-white flex items-center gap-2"><Radio className="w-4 h-4 text-red-400" />Today's Schedule</h3><Badge variant="blue">EST</Badge></div></div>
                <div>{currentSchedule.map((slot, i) => <div key={i} className={`flex items-center gap-3 px-4 py-3 border-b border-white/[0.03] last:border-0 ${slot.status === 'live' ? 'bg-red-500/10' : 'hover:bg-white/[0.02]'}`}><span className="text-xs font-mono text-gray-500 w-16 shrink-0">{slot.time}</span><div className="flex-1"><span className="text-sm text-white">{slot.streamer}</span></div><Badge variant={slot.type === 'Prime' ? 'gold' : slot.type === 'Lottery' ? 'purple' : 'default'}>{slot.type}</Badge></div>)}</div>
                <div className="p-3 border-t border-white/[0.06]"><a href="/schedule" className="flex items-center justify-center gap-1.5 text-sm text-red-300 hover:text-red-200 font-medium transition-colors">View Full Schedule <ChevronRight className="w-3.5 h-3.5" /></a></div>
              </Card>
              <Card hover={false} className="flex-1 min-h-[300px] flex flex-col overflow-hidden">
                <div className="p-4 border-b border-white/[0.06]"><h3 className="font-semibold font-display text-white flex items-center gap-2"><MessageSquare className="w-4 h-4 text-red-400" />Live Chat</h3></div>
                <div className="flex-1 flex items-center justify-center p-6 text-center"><a href="https://pump.fun" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-red-300 hover:text-red-200 font-medium mt-2 transition-colors">Join on pump.fun <ExternalLink className="w-3.5 h-3.5" /></a></div>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
