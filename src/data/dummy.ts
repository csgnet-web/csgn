// All client-side dummy data for the NCAA-style CSGN menu.
// No network calls. No persistence. Pure prop fuel.

export type GameModeId =
  | 'dynasty-menu'
  | 'watch'
  | 'dynasty-hub'
  | 'race-for-slot'
  | 'slot-schedule'
  | 'starting-five'
  | 'rookie-watch'
  | 'treasury'
  | 'commissioner'

export interface GameMode {
  id: GameModeId
  label: string
  sublabel: string
  route: string
  number: string
  badge?: string
}

export const GAME_MODES: GameMode[] = [
  { id: 'dynasty-menu',  label: 'Dynasty Menu',     sublabel: 'Main Broadcast',         route: '/',          number: '01' },
  { id: 'watch',         label: 'Watch Live',       sublabel: 'Active Broadcast Slot',  route: '/watch',     number: '02', badge: 'LIVE' },
  { id: 'dynasty-hub',   label: 'Dynasty Hub',      sublabel: 'Your Stat Sheet',        route: '/dynasty',   number: '03' },
  { id: 'race-for-slot', label: 'Race for the Slot',sublabel: 'Apply / Audition',       route: '/apply',     number: '04', badge: 'OPEN' },
  { id: 'slot-schedule', label: 'Slot Schedule',    sublabel: '24-Hour Game Clock',     route: '/schedule',  number: '05' },
  { id: 'starting-five', label: 'Starting 5 / Squares',sublabel: 'Pickem & CSGN Squares',route: '/games',    number: '06', badge: 'NEW' },
  { id: 'rookie-watch',  label: 'Rookie Watch',     sublabel: 'Creator Combine',        route: '/rookies',   number: '07' },
  { id: 'treasury',      label: 'Treasury Center',  sublabel: 'Network Tokenomics',     route: '/treasury',  number: '08' },
  { id: 'commissioner',  label: 'Commissioner Mode',sublabel: 'Admin / Broadcast Ops',  route: '/admin',     number: '09' },
]

export const tickerItems = [
  '🔴 LIVE NOW — GHOSTHAND vs THE TAPE in TURBO MIDNIGHT SLOT',
  '💰 TREASURY $4,238,910  +12.4% 7D',
  '🏆 STARTING 5 PRIZE POOL $86,400  DRAFT CLOSES 02H 14M',
  '📡 247 ROOKIES IN COMBINE QUEUE',
  '🎯 NEXT SLOT 03:00 ET — RAW DEGEN HOUR w/ SOL_REAPER',
  '🔥 CSGN SQUARES BOARD 71/100 FILLED',
  '📰 TRADE — BLOCK_TRADER acquired by ALPHA DYNASTY',
  '⚡ COMMISSIONER MODE — BROADCAST GREEN, ALL SYSTEMS NOMINAL',
  '🎮 NEW MODE LIVE — CSGN SQUARES SEASON 02',
  '🚀 ROOKIE OF THE WEEK — @nano_alpha 4.8★',
]

export const bootLines = [
  'SYNCING STREAM SLOTS',
  'LOADING BROADCAST SLATE',
  'CONNECTING TO CSGN LIVE',
  'INITIALIZING DYNASTY MODE',
]

export const networkStats = {
  liveViewers: 18203,
  liveStreams: 4,
  slotsToday: 24,
  rookiesPending: 247,
  totalCreators: 1842,
  treasuryUSD: 4238910,
  treasuryDelta7d: 12.4,
  uptimePct: 99.97,
}

export const currentStream = {
  title: 'GHOSTHAND vs THE TAPE — Live Trade Wars',
  streamer: 'GHOSTHAND',
  category: 'Crypto Combat',
  viewers: 12847,
  peakViewers: 18203,
  duration: '01:24:11',
  network: 'CSGN PRIME',
  slot: 'TURBO MIDNIGHT',
  startedAt: '23:00 ET',
  endsAt: '00:30 ET',
  tags: ['LIVE', 'TRADING', 'PvP', 'HIGH STAKES'],
  chatRate: 412,
  highlight: 'GHOSTHAND just liquidated a $40K short live on air.',
}

export const upNext = [
  { time: '00:30 ET', title: 'POST-GAME WRAP',     host: '@anchor_sasha',     duration: '30m' },
  { time: '01:00 ET', title: 'DEGEN AFTER DARK',   host: '@sol_reaper',       duration: '60m' },
  { time: '02:00 ET', title: 'RAW TAPE: NFT WARS', host: '@pixel_warden',     duration: '60m' },
  { time: '03:00 ET', title: 'RAW DEGEN HOUR',     host: '@sol_reaper',       duration: '60m' },
]

export const scheduleSlots = [
  { time: '06:00', title: 'MORNING TICKER',       host: '@anchor_sasha',  status: 'BOOKED',   tag: 'NEWS'    },
  { time: '07:00', title: 'PRE-MARKET CHALK',     host: '@chartlord',     status: 'BOOKED',   tag: 'ANALYSIS'},
  { time: '08:00', title: 'OPEN BELL ARENA',      host: '@degen_42',      status: 'BOOKED',   tag: 'PvP'     },
  { time: '09:00', title: 'CSGN COFFEE',          host: '@nano_alpha',    status: 'BOOKED',   tag: 'TALK'    },
  { time: '10:00', title: 'OPEN SLOT',            host: '—',              status: 'OPEN',     tag: 'AUDITION'},
  { time: '11:00', title: 'MIDDAY MOMENTUM',      host: '@quant_kai',     status: 'BOOKED',   tag: 'CHARTS'  },
  { time: '12:00', title: 'LUNCH PIT',            host: '@meme_mayor',    status: 'BOOKED',   tag: 'CULTURE' },
  { time: '13:00', title: 'OPEN SLOT',            host: '—',              status: 'OPEN',     tag: 'AUDITION'},
  { time: '14:00', title: 'NFT FLOOR REPORT',     host: '@pixel_warden',  status: 'BOOKED',   tag: 'NFTS'    },
  { time: '15:00', title: 'POWER HOUR',           host: '@solana_sara',   status: 'LIVE',     tag: 'TRADING' },
  { time: '16:00', title: 'CLOSING TAPE',         host: '@anchor_sasha',  status: 'BOOKED',   tag: 'NEWS'    },
  { time: '17:00', title: 'OPEN SLOT',            host: '—',              status: 'OPEN',     tag: 'AUDITION'},
  { time: '18:00', title: 'PRIMETIME PvP',        host: '@ghosthand',     status: 'BOOKED',   tag: 'PvP'     },
  { time: '19:00', title: 'HIGHLIGHT REEL',       host: 'CSGN PROD',      status: 'BOOKED',   tag: 'PROD'    },
  { time: '20:00', title: 'SQUARES NIGHT',        host: '@board_master',  status: 'BOOKED',   tag: 'GAMES'   },
  { time: '21:00', title: 'CRYPTO TMZ',           host: '@gossip_g',      status: 'BOOKED',   tag: 'DRAMA'   },
  { time: '22:00', title: 'OPEN SLOT',            host: '—',              status: 'OPEN',     tag: 'AUDITION'},
  { time: '23:00', title: 'TURBO MIDNIGHT',       host: '@ghosthand',     status: 'LIVE',     tag: 'PvP'     },
  { time: '00:00', title: 'POST-GAME WRAP',       host: '@anchor_sasha',  status: 'BOOKED',   tag: 'NEWS'    },
  { time: '01:00', title: 'DEGEN AFTER DARK',     host: '@sol_reaper',    status: 'BOOKED',   tag: 'TRADING' },
  { time: '02:00', title: 'RAW TAPE: NFT WARS',   host: '@pixel_warden',  status: 'BOOKED',   tag: 'NFTS'    },
  { time: '03:00', title: 'RAW DEGEN HOUR',       host: '@sol_reaper',    status: 'BOOKED',   tag: 'TRADING' },
  { time: '04:00', title: 'OPEN SLOT',            host: '—',              status: 'OPEN',     tag: 'AUDITION'},
  { time: '05:00', title: 'OVERNIGHT TICKER',     host: 'CSGN AUTO',      status: 'BOOKED',   tag: 'NEWS'    },
]

export const openSlots = scheduleSlots.filter(s => s.status === 'OPEN')

export const rookies = [
  { handle: '@nano_alpha',    name: 'Nano Alpha',     stars: 4.8, follower: 21400, tag: 'CHARTS',  status: 'COMBINE'  },
  { handle: '@board_master',  name: 'Board Master',   stars: 4.6, follower: 18800, tag: 'GAMES',   status: 'CALLBACK' },
  { handle: '@meme_mayor',    name: 'Meme Mayor',     stars: 4.4, follower: 41200, tag: 'CULTURE', status: 'COMBINE'  },
  { handle: '@quant_kai',     name: 'Quant Kai',      stars: 4.3, follower: 9300,  tag: 'CHARTS',  status: 'COMBINE'  },
  { handle: '@pixel_warden',  name: 'Pixel Warden',   stars: 4.2, follower: 32100, tag: 'NFTS',    status: 'CALLBACK' },
  { handle: '@solana_sara',   name: 'Solana Sara',    stars: 4.1, follower: 12700, tag: 'TRADING', status: 'SIGNED'   },
  { handle: '@degen_42',      name: 'Degen 42',       stars: 4.0, follower: 7800,  tag: 'PvP',     status: 'COMBINE'  },
  { handle: '@gossip_g',      name: 'Gossip G',       stars: 3.9, follower: 25400, tag: 'DRAMA',   status: 'COMBINE'  },
]

export const starting5 = {
  prizePool: 86400,
  closesIn: '02H 14M 03S',
  entrants: 4218,
  myEntries: 2,
  picks: [
    { slot: 'PG', name: 'GHOSTHAND',   tag: 'PvP',     odds: '+220' },
    { slot: 'SG', name: 'CHARTLORD',   tag: 'CHARTS',  odds: '+150' },
    { slot: 'SF', name: 'PIXEL WARDEN',tag: 'NFTS',    odds: '+340' },
    { slot: 'PF', name: 'BOARD MASTER',tag: 'GAMES',   odds: '+180' },
    { slot: 'C',  name: 'SOL REAPER',  tag: 'TRADING', odds: '+260' },
  ],
}

const SQUARE_ROWS = ['BTC','ETH','SOL','DOGE','PEPE','BONK','WIF','MEW','AVAX','SUI']
const SQUARE_COLS = ['BULL','BEAR','CHOP','PUMP','DUMP','WICK','HALT','RUG','MOON','FLAT']

const filledIndices = new Set([
  '0,0','0,1','0,4','0,7','1,2','1,3','1,8','2,0','2,5','2,6','2,9',
  '3,1','3,3','3,7','4,0','4,4','4,8','5,2','5,5','5,9','6,1','6,6',
  '7,0','7,3','7,7','8,2','8,4','8,8','9,1','9,5','9,9',
  '0,2','1,5','3,4','5,0','6,8','9,3','4,6','7,1','2,3','8,9',
  '0,3','3,9','5,6','6,3','7,9','9,0','1,1','2,2','3,3','4,4','5,5','6,6','7,7','8,8','9,4',
  '0,5','0,6','0,8','0,9','1,0','1,4','1,6','1,7','1,9','2,1','2,4','2,7','2,8',
])

const SQUARE_OWNERS = ['@degen_42','@nano_alpha','@quant_kai','@meme_mayor','@board_master','@solana_sara','@ghosthand','@chartlord','@pixel_warden','@sol_reaper']

export const csgnSquares = {
  rows: SQUARE_ROWS,
  cols: SQUARE_COLS,
  filled: 71,
  total: 100,
  buyIn: 250,
  pot: 17750,
  closesIn: '47M 12S',
  cells: SQUARE_ROWS.flatMap((_, r) =>
    SQUARE_COLS.map((_, c) => {
      const key = `${r},${c}`
      const filled = filledIndices.has(key)
      return {
        r, c, key,
        owner: filled ? SQUARE_OWNERS[(r * 7 + c * 3) % SQUARE_OWNERS.length] : null,
        filled,
      }
    })
  ),
}

export const treasuryStats = {
  totalUSD: 4238910,
  delta7d: 12.4,
  delta30d: 38.6,
  tokenPrice: 0.0428,
  marketCap: 17_120_000,
  circulatingPct: 38.2,
  burnedM: 12.4,
  inflows7d: [
    { source: 'Slot Auctions',     usd: 184200, pct: 41 },
    { source: 'Squares Buy-Ins',   usd: 96400,  pct: 21 },
    { source: 'Starting 5 Rake',   usd: 71300,  pct: 16 },
    { source: 'Sponsorship',       usd: 58800,  pct: 13 },
    { source: 'Merch / Misc',      usd: 41200,  pct: 9  },
  ],
  payouts7d: [
    { dest: 'Creators (rev share)', usd: 142800 },
    { dest: 'Prize Pools',          usd: 86400  },
    { dest: 'Buyback & Burn',       usd: 64200  },
    { dest: 'Network Ops',          usd: 38400  },
  ],
  spark: [42,40,44,46,49,52,55,58,57,61,66,68,71,74,76,80,84,87,91,95],
}

export const dynastyHub = {
  user: { handle: '@you', tag: 'DYNASTY OWNER', tier: 'GOLD', joined: 'Season 01' },
  stats: {
    slotsBooked: 4,
    streamsCompleted: 12,
    averageRating: 4.6,
    earningsUSD: 1284,
    rookiesScouted: 7,
    squaresWins: 2,
    starting5Entries: 9,
  },
  recent: [
    { kind: 'WIN',     text: 'You won 1 square in Squares Board #14 — +$250',  when: '12m ago' },
    { kind: 'BOOKED',  text: 'Slot booked: 17:00 ET — AUDITION',                when: '2h ago'  },
    { kind: 'TRADED',  text: 'Traded BLOCK_TRADER → ALPHA DYNASTY',            when: '1d ago'  },
    { kind: 'LEVELUP', text: 'You hit GOLD tier — +5% revenue share',           when: '3d ago'  },
    { kind: 'SCOUT',   text: 'Scouted @nano_alpha — Combine invite sent',       when: '4d ago'  },
  ],
  nextActions: [
    { label: 'Claim weekly drop', detail: '0.42 SOL ready' },
    { label: 'Audition for 17:00 ET slot', detail: 'AUDITION OPEN' },
    { label: 'Vote on Season 02 squares', detail: '5 props open' },
  ],
}

export const adminBroadcast = {
  status: 'GREEN',
  uptimePct: 99.97,
  liveSlot: 'TURBO MIDNIGHT — GHOSTHAND',
  rtmpHealth: 'NOMINAL',
  ingestRegions: [
    { region: 'NA-EAST', status: 'NOMINAL',  latencyMs: 38 },
    { region: 'NA-WEST', status: 'NOMINAL',  latencyMs: 51 },
    { region: 'EU',      status: 'NOMINAL',  latencyMs: 88 },
    { region: 'APAC',    status: 'WATCH',    latencyMs: 142 },
  ],
  pendingApprovals: [
    { kind: 'SLOT BOOKING', who: '@nano_alpha',   when: '17:00 ET' },
    { kind: 'PAYOUT',       who: '@solana_sara',  when: 'Weekly' },
    { kind: 'ROOKIE SIGN',  who: '@board_master', when: 'Combine' },
    { kind: 'SQUARES PRIZE',who: '@degen_42',     when: 'Board #14' },
  ],
  killSwitch: 'ARMED',
  recentActions: [
    { who: 'COMMISH', text: 'Auto-approved RTMP key rotation', when: '03m ago' },
    { who: 'COMMISH', text: 'Promoted @nano_alpha to CALLBACK', when: '14m ago' },
    { who: 'COMMISH', text: 'Closed Squares Board #14',         when: '47m ago' },
  ],
}
