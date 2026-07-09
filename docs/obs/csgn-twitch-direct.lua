--[[
  CSGN TWITCH DIRECT — OBS control script for the zero-hosting encoder.

  Replaces the hosted /player page: the FEED browser source points STRAIGHT at
  Twitch's interactive embed (player.twitch.tv), and this script does at the
  OBS layer what /player did in the page. See docs/obs-twitch-direct.md for
  the full architecture and scene build; the short version:

    COVER CHOREOGRAPHY   A "CSGN COVER" source (docs/obs/cover.html) sits above
                         the feed. This script raises it — and MUTES the feed —
                         through every vulnerable window, then reveals:
                           · boot / OBS launch
                           · every retune (slot handoff) and reload
                           · the deterministic preroll-ad guard (default 40s ≈
                             Twitch's ≤30s stitched break + slop + settle, the
                             same mask semantics as src/lib/feedGate.ts)
                           · BRB (server says the slot channel went offline)
                           · panic hotkey (surprise midroll → one key covers
                             video AND audio instantly)
                         The cover is reason-tracked: it drops only when NO
                         reason remains, so e.g. a guard expiring can never
                         drop a cover that BRB or the operator is holding.

    SLOT AUTO-FOLLOW     Polls the public Firestore REST API (slots are
                         world-readable; project id + web API key are the same
                         public values shipped in the site bundle) — Netlify
                         is not involved. Slot doc IDs are deterministic
                         (slot-YYYY-MM-DD-HH in ET), so this is a single GET
                         per minute. The admin emergency override doc
                         (config/emergencyOverride) is honoured and wins.
                         ⚠ Coupled to the schedule template in src/lib/slots.ts
                         (2-hour slots starting at odd ET hours). If that
                         template ever changes, update slot_start_hour() below.

    BRB / RETURN         Uses streamActivity.lastLive, written to the slot doc
                         once a minute by the existing server Helix poller.
                         Offline → cover up + periodic "redial" reloads (a bare
                         iframe embed never auto-recovers when a channel comes
                         back; /player rebuilt the embed for the same reason).
                         Back online → one reload behind the guard, then reveal.
                         If the poller data is stale (>5 min), BRB logic stands
                         down and the in-page CSS covers Twitch's offline screen.

    WATCHDOG             Periodic hard reload (default 12h) for CEF memory
                         creep, always behind the cover — same rationale as
                         csgn-master.lua.

  What this script can NOT do (one-way bridge: OBS cannot read the page):
  no frame-advance confirmation, no wedge detection, no in-page clicking.
  Mitigations live in the setup doc — and ads disappear entirely if the
  browser profile is logged into an ad-free (Turbo/subbed) account.

  Install: Tools → Scripts → + → this file. Fill in the Firebase project id +
  web API key, check the source names, bind the hotkeys (Settings → Hotkeys).
]]

local obs = obslua
local ffi_ok, ffi = pcall(require, "ffi")

-- ── Settings (edit in the Scripts UI, not here) ─────────────────────────────
local feed_source     = "CSGN FEED"
local cover_source    = "CSGN COVER"
local parent_domain   = "twitch.tv"   -- parent= value; any registrable domain
local guard_seconds   = 40            -- boot/retune/preroll mask (8 if ad-free login)
local poll_seconds    = 60
local redial_minutes  = 5             -- reload cadence while BRB holds
local fb_project      = ""            -- Firebase project id  (public value)
local fb_key          = ""            -- Firebase web API key (public value)
local default_channel = "csgnet"
local manual_enabled  = false         -- operator override: ignore slots
local manual_channel  = ""
local brb_enabled     = true          -- react to streamActivity.lastLive
local watchdog_hours  = 12            -- 0 = off

-- ── State ───────────────────────────────────────────────────────────────────
local armed_channel   = nil           -- channel the FEED url is tuned to
local cover_reasons   = {}            -- reason -> true; cover ON iff any true
local last_reload_at  = 0
local slot_info       = nil           -- last parsed slot doc (or nil)
local override_info   = nil           -- last parsed emergencyOverride doc
local hotkey_cover    = obs.OBS_INVALID_HOTKEY_ID
local hotkey_reload   = obs.OBS_INVALID_HOTKEY_ID

local FRESH_WINDOW_S  = 300           -- how recent lastCheckedAt must be to trust

local function log(msg) obs.script_log(obs.LOG_INFO, "CSGN: " .. msg) end
local function warn(msg) obs.script_log(obs.LOG_WARNING, "CSGN: " .. msg) end

-- ═══ Async fetch: fire-and-forget curl writing to temp files ════════════════
-- os.execute blocks and (on Windows) flashes a console; on Windows we spawn
-- curl via ffi/CreateProcess with CREATE_NO_WINDOW instead. Responses are
-- read on the NEXT poll tick — at a 60s cadence, ~1-tick-stale data is fine.

local IS_WINDOWS = package.config:sub(1, 1) == "\\"
local tmp_dir = (os.getenv("TEMP") or os.getenv("TMP") or "/tmp")
local slot_file = tmp_dir .. (IS_WINDOWS and "\\" or "/") .. "csgn_slot.json"
local override_file = tmp_dir .. (IS_WINDOWS and "\\" or "/") .. "csgn_override.json"

local win_spawn_ready = false
if ffi_ok and IS_WINDOWS then
  local ok = pcall(function()
    ffi.cdef[[
      typedef struct {
        unsigned long  cb;
        char *lpReserved, *lpDesktop, *lpTitle;
        unsigned long  dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars,
                       dwFillAttribute, dwFlags;
        unsigned short wShowWindow, cbReserved2;
        unsigned char *lpReserved2;
        void *hStdInput, *hStdOutput, *hStdError;
      } CSGN_STARTUPINFOA;
      typedef struct { void *hProcess, *hThread; unsigned long dwProcessId, dwThreadId; } CSGN_PROCESS_INFORMATION;
      int CreateProcessA(const char*, char*, void*, void*, int, unsigned long,
                         void*, const char*, CSGN_STARTUPINFOA*, CSGN_PROCESS_INFORMATION*);
      int CloseHandle(void*);
    ]]
  end)
  win_spawn_ready = ok
end

local function spawn(cmdline)
  if IS_WINDOWS then
    if win_spawn_ready then
      local ok = pcall(function()
        local si = ffi.new("CSGN_STARTUPINFOA")
        si.cb = ffi.sizeof("CSGN_STARTUPINFOA")
        local pi = ffi.new("CSGN_PROCESS_INFORMATION")
        local buf = ffi.new("char[?]", #cmdline + 1, cmdline)
        local CREATE_NO_WINDOW = 0x08000000
        if ffi.C.CreateProcessA(nil, buf, nil, nil, 0, CREATE_NO_WINDOW, nil, nil, si, pi) ~= 0 then
          ffi.C.CloseHandle(pi.hProcess)
          ffi.C.CloseHandle(pi.hThread)
        end
      end)
      if ok then return end
    end
    os.execute('start "" /b ' .. cmdline)   -- fallback: brief console blink, harmless
  else
    os.execute(cmdline .. " >/dev/null 2>&1 &")
  end
end

local function fetch(url, out_file)
  os.remove(out_file)
  spawn(string.format('curl -s -m 8 -o "%s" "%s"', out_file, url))
end

local function read_and_remove(path)
  local f = io.open(path, "r")
  if not f then return nil end
  local body = f:read("*a")
  f:close()
  os.remove(path)
  if body == nil or body == "" then return nil end
  return body
end

-- ═══ Firestore document parsing (fixed, admin-controlled schema — a full
--     JSON parser is deliberately avoided; these patterns match the REST
--     encoding {"field": {"stringValue": "…"}} wherever it appears) ══════════

local function jstr(body, field)
  return body:match('"' .. field .. '"%s*:%s*{%s*"stringValue"%s*:%s*"([^"]*)"')
end

local function jbool(body, field)
  local v = body:match('"' .. field .. '"%s*:%s*{%s*"booleanValue"%s*:%s*(%a+)')
  if v == nil then return nil end
  return v == "true"
end

-- ISO-8601 UTC → epoch seconds (days_from_civil; no os.time local-tz traps)
local function iso_epoch(s)
  if not s then return nil end
  local y, mo, d, h, mi, se = s:match("(%d+)%-(%d+)%-(%d+)T(%d+):(%d+):(%d+)")
  if not y then return nil end
  y, mo, d = tonumber(y), tonumber(mo), tonumber(d)
  local yy  = y - (mo <= 2 and 1 or 0)
  local era = math.floor(yy / 400)
  local yoe = yy - era * 400
  local mp  = (mo + 9) % 12
  local doy = math.floor((153 * mp + 2) / 5) + d - 1
  local doe = yoe * 365 + math.floor(yoe / 4) - math.floor(yoe / 100) + doy
  return (era * 146097 + doe - 719468) * 86400
       + tonumber(h) * 3600 + tonumber(mi) * 60 + tonumber(se)
end

-- ═══ ET schedule math (mirrors src/lib/slots.ts SCHEDULE_TEMPLATE) ═══════════
-- US Eastern offset with DST: 2nd Sunday of March 02:00 → 1st Sunday of
-- November 02:00. (The one ambiguous hour at each 2am transition falls inside
-- the 1–3am graveyard slot; worst case the script is one hour early/late on
-- those two nights.)

local function et_offset_hours(utc_epoch)
  local t = os.date("!*t", utc_epoch - 4 * 3600)  -- evaluate rule in EDT terms
  local m, d, h = t.month, t.day, t.hour
  local dst
  if m > 3 and m < 11 then
    dst = true
  elseif m < 3 or m > 11 then
    dst = false
  else
    local w1 = ((t.wday - 1 - (d - 1)) % 7) + 1     -- weekday of the 1st (1=Sun)
    local first_sunday = 1 + ((8 - w1) % 7)
    if m == 3 then
      local second_sunday = first_sunday + 7
      dst = (d > second_sunday) or (d == second_sunday and h >= 2)
    else
      dst = (d < first_sunday) or (d == first_sunday and h < 2)
    end
  end
  return dst and -4 or -5
end

-- Slots are 2h starting at odd ET hours: 3,5,…,23, then 1 (next day).
-- ⚠ Update together with SCHEDULE_TEMPLATE in src/lib/slots.ts.
local function current_slot_id(utc_epoch)
  local off = et_offset_hours(utc_epoch)
  local et_epoch = utc_epoch + off * 3600
  local et = os.date("!*t", et_epoch)
  local h = et.hour
  local start_h = (h == 0) and 23 or ((h % 2 == 1) and h or h - 1)
  local d = os.date("!*t", et_epoch - ((h == 0) and 86400 or 0))
  return string.format("slot-%04d-%02d-%02d-%02d", d.year, d.month, d.day, start_h)
end

-- ═══ OBS plumbing ════════════════════════════════════════════════════════════

local find_item = obs.obs_scene_find_source_recursive or obs.obs_scene_find_source

local function set_cover_visible(visible)
  local scenes = obs.obs_frontend_get_scenes()
  if scenes == nil then return end
  for _, scene_source in ipairs(scenes) do
    local scene = obs.obs_scene_from_source(scene_source)
    if scene ~= nil then
      local item = find_item(scene, cover_source)
      if item ~= nil then obs.obs_sceneitem_set_visible(item, visible) end
    end
  end
  obs.source_list_release(scenes)
end

local function set_feed_muted(muted)
  local source = obs.obs_get_source_by_name(feed_source)
  if source == nil then return end
  obs.obs_source_set_muted(source, muted)
  obs.obs_source_release(source)
end

local function cover_is_on()
  for _, v in pairs(cover_reasons) do if v then return true end end
  return false
end

local function apply_cover()
  local on = cover_is_on()
  set_cover_visible(on)
  set_feed_muted(on)   -- audio and video are covered/revealed as one
end

local function raise_cover(reason)
  if not cover_reasons[reason] then log("cover up (" .. reason .. ")") end
  cover_reasons[reason] = true
  apply_cover()
end

local function clear_cover(reason)
  if cover_reasons[reason] then
    cover_reasons[reason] = false
    if not cover_is_on() then log("cover down (last reason: " .. reason .. ")") end
  end
  apply_cover()
end

-- Deterministic guard: covers boot, retunes, reloads and — because Twitch
-- stitches preroll breaks (≤30s) server-side with no client-side signal —
-- the entire preroll window. One-shot timer.
local function guard_finish()
  obs.timer_remove(guard_finish)
  clear_cover("guard")
end

local function begin_guard()
  raise_cover("guard")
  obs.timer_remove(guard_finish)
  obs.timer_add(guard_finish, math.max(1, guard_seconds) * 1000)
end

local function sanitize_channel(name)
  if not name then return nil end
  name = name:lower():gsub("[^%w_]", "")
  if name == "" then return nil end
  return name
end

-- channel out of either our player URL or a twitch.tv/<name> stream URL
local function channel_from_url(url)
  if not url or url == "" then return nil end
  return sanitize_channel(url:match("[?&]channel=([%w_]+)") or url:match("twitch%.tv/([%w_]+)"))
end

local function build_url(channel)
  return string.format(
    "https://player.twitch.tv/?channel=%s&parent=%s&autoplay=true&muted=false",
    channel, parent_domain)
end

local function set_feed_url(url)
  local source = obs.obs_get_source_by_name(feed_source)
  if source == nil then
    warn("feed source '" .. feed_source .. "' not found")
    return false
  end
  local settings = obs.obs_data_create()
  obs.obs_data_set_string(settings, "url", url)
  obs.obs_source_update(source, settings)
  obs.obs_data_release(settings)
  obs.obs_source_release(source)
  return true
end

local function retune(channel, why)
  channel = sanitize_channel(channel)
  if not channel or channel == armed_channel then return end
  begin_guard()                          -- cover + mute BEFORE the url changes
  if set_feed_url(build_url(channel)) then
    log(("retune %s → %s (%s)"):format(armed_channel or "—", channel, why))
    armed_channel = channel
    last_reload_at = os.time()
  end
end

local function reload_feed(why)
  if not armed_channel then return end
  begin_guard()
  -- bounce the URL (identical URLs can be a no-op; _r forces a real reload)
  if set_feed_url(build_url(armed_channel) .. "&_r=" .. os.time()) then
    log("reload (" .. why .. ")")
    last_reload_at = os.time()
  end
end

-- ═══ Poll: read last tick's responses, steer, fire next fetches ═════════════

local function parse_slot(body)
  if not body then return nil end
  -- A real 404 answer ("no such slot doc") is knowledge, not absence of data:
  -- it means "play the default channel". Only a missing/failed response keeps
  -- us in the hold-current-channel state below.
  if body:match('"code"%s*:%s*404') then return { missing = true } end
  local slot = {
    status        = jstr(body, "status"),
    channel       = channel_from_url(jstr(body, "streamUrl")),
    assigned_name = jstr(body, "assignedName"),
    last_live     = jbool(body, "lastLive"),
    checked_epoch = iso_epoch(jstr(body, "lastCheckedAt")),
  }
  -- Nothing recognizable parsed (truncated write, HTML error page…): treat as
  -- no data — never let garbage steer a retune.
  if not slot.status and not slot.channel and slot.last_live == nil then return nil end
  return slot
end

local function parse_override(body)
  if not body or body:match('"code"%s*:%s*404') then return nil end
  return { enabled = jbool(body, "enabled"), url = jstr(body, "streamUrl") }
end

local function decide_target()
  if manual_enabled then
    return sanitize_channel(manual_channel) or default_channel, "manual override"
  end
  if override_info and override_info.enabled then
    local ch = channel_from_url(override_info.url)
    if ch then return ch, "emergency override" end
    -- Non-Twitch override (e.g. a YouTube URL) can't play in this pipeline:
    -- hold the cover and let the operator take the scene over by hand.
    raise_cover("override")
    warn("emergency override URL is not a twitch channel — cover held")
    return nil, "override unplayable"
  end
  clear_cover("override")
  -- No slot answer yet (first boot, or fetches failing): hold whatever is
  -- armed rather than jumping to the default. Arming default ahead of slot
  -- data is exactly how /player once put a mistuned offline page on-stream.
  if slot_info == nil then return nil, "waiting for slot data" end
  if not slot_info.missing
     and (slot_info.status == "confirmed" or slot_info.status == "live")
     and slot_info.channel then
    return slot_info.channel, "slot"
  end
  return default_channel, "default"
end

local function steer_brb()
  if manual_enabled or not brb_enabled then clear_cover("brb") return end
  local s = slot_info
  local fresh = s and s.checked_epoch and (os.time() - s.checked_epoch) < FRESH_WINDOW_S
  -- Only trust the Helix signal when it's fresh AND describes the channel we
  -- are actually showing (slot handoffs briefly race the poller).
  if not (fresh and s.channel == armed_channel) then
    clear_cover("brb")
    return
  end
  if s.last_live == false then
    raise_cover("brb")
    -- Redial: a bare embed never auto-recovers from the offline screen, so
    -- reload on a slow cadence; each attempt stays behind the cover.
    if os.time() - last_reload_at >= redial_minutes * 60 then
      reload_feed("redial while offline")
    end
  elseif s.last_live == true and cover_reasons["brb"] then
    clear_cover("brb")
    reload_feed("stream returned")   -- guard re-covers the fresh preroll
  end
end

local function poll_tick()
  -- 1. digest whatever last tick's curls wrote
  local slot_body = read_and_remove(slot_file)
  if slot_body then slot_info = parse_slot(slot_body) end
  local override_body = read_and_remove(override_file)
  if override_body then override_info = parse_override(override_body) end

  -- 2. steer
  local target, why = decide_target()
  if target then retune(target, why) elseif why then log(why) end
  steer_brb()

  -- 3. fire next round (answers arrive by the next tick). Keeps fetching in
  -- manual mode too, so flipping back to auto acts on warm data instead of
  -- bouncing through the default channel.
  if fb_project ~= "" and fb_key ~= "" then
    local base = "https://firestore.googleapis.com/v1/projects/" .. fb_project
              .. "/databases/(default)/documents/"
    fetch(base .. "slots/" .. current_slot_id(os.time())
        .. "?key=" .. fb_key
        .. "&mask.fieldPaths=streamUrl&mask.fieldPaths=status"
        .. "&mask.fieldPaths=assignedName&mask.fieldPaths=streamActivity",
      slot_file)
    fetch(base .. "config/emergencyOverride?key=" .. fb_key, override_file)
  end
end

-- ═══ Watchdog ════════════════════════════════════════════════════════════════

local function watchdog_tick()
  reload_feed("watchdog")
end

local function reset_timers()
  obs.timer_remove(poll_tick)
  obs.timer_remove(watchdog_tick)
  obs.timer_add(poll_tick, math.max(15, poll_seconds) * 1000)
  if watchdog_hours > 0 then
    obs.timer_add(watchdog_tick, watchdog_hours * 3600 * 1000)
  end
end

-- One-shot init shortly after load: OBS boot and script reload both start
-- covered, learn the currently-armed channel from the source itself, and
-- poll immediately.
local function init_tick()
  obs.timer_remove(init_tick)
  local source = obs.obs_get_source_by_name(feed_source)
  if source ~= nil then
    local settings = obs.obs_source_get_settings(source)
    armed_channel = channel_from_url(obs.obs_data_get_string(settings, "url"))
    obs.obs_data_release(settings)
    obs.obs_source_release(source)
  end
  log("armed on load: " .. (armed_channel or "—"))
  begin_guard()
  poll_tick()
end

-- ═══ OBS script lifecycle ════════════════════════════════════════════════════

function script_description()
  return [[<b>CSGN TWITCH DIRECT</b> — zero-hosting encoder brain.<br/>
Drives a player.twitch.tv browser source: cover+mute choreography with a
deterministic preroll guard, slot auto-follow from public Firestore, BRB via
the server's Helix checks, panic/reload hotkeys, and a reload watchdog.
Full setup: <code>docs/obs-twitch-direct.md</code>.]]
end

function script_properties()
  local p = obs.obs_properties_create()
  obs.obs_properties_add_text(p, "feed_source", "Feed browser source", obs.OBS_TEXT_DEFAULT)
  obs.obs_properties_add_text(p, "cover_source", "Cover source (scene item)", obs.OBS_TEXT_DEFAULT)
  obs.obs_properties_add_text(p, "parent_domain", "Embed parent= domain", obs.OBS_TEXT_DEFAULT)
  obs.obs_properties_add_int(p, "guard_seconds", "Guard seconds (preroll mask)", 3, 120, 1)
  obs.obs_properties_add_int(p, "poll_seconds", "Slot poll seconds", 15, 600, 5)
  obs.obs_properties_add_int(p, "redial_minutes", "BRB redial minutes", 1, 60, 1)
  obs.obs_properties_add_text(p, "fb_project", "Firebase project id", obs.OBS_TEXT_DEFAULT)
  obs.obs_properties_add_text(p, "fb_key", "Firebase web API key", obs.OBS_TEXT_PASSWORD)
  obs.obs_properties_add_text(p, "default_channel", "Default channel", obs.OBS_TEXT_DEFAULT)
  obs.obs_properties_add_bool(p, "manual_enabled", "Manual mode (ignore slots)")
  obs.obs_properties_add_text(p, "manual_channel", "  manual channel", obs.OBS_TEXT_DEFAULT)
  obs.obs_properties_add_bool(p, "brb_enabled", "React to server live checks (BRB)")
  obs.obs_properties_add_int(p, "watchdog_hours", "Watchdog reload hours (0=off)", 0, 48, 1)
  return p
end

function script_defaults(settings)
  obs.obs_data_set_default_string(settings, "feed_source", feed_source)
  obs.obs_data_set_default_string(settings, "cover_source", cover_source)
  obs.obs_data_set_default_string(settings, "parent_domain", parent_domain)
  obs.obs_data_set_default_int(settings, "guard_seconds", guard_seconds)
  obs.obs_data_set_default_int(settings, "poll_seconds", poll_seconds)
  obs.obs_data_set_default_int(settings, "redial_minutes", redial_minutes)
  obs.obs_data_set_default_string(settings, "fb_project", fb_project)
  obs.obs_data_set_default_string(settings, "fb_key", fb_key)
  obs.obs_data_set_default_string(settings, "default_channel", default_channel)
  obs.obs_data_set_default_bool(settings, "manual_enabled", manual_enabled)
  obs.obs_data_set_default_string(settings, "manual_channel", manual_channel)
  obs.obs_data_set_default_bool(settings, "brb_enabled", brb_enabled)
  obs.obs_data_set_default_int(settings, "watchdog_hours", watchdog_hours)
end

function script_update(settings)
  feed_source     = obs.obs_data_get_string(settings, "feed_source")
  cover_source    = obs.obs_data_get_string(settings, "cover_source")
  parent_domain   = obs.obs_data_get_string(settings, "parent_domain")
  guard_seconds   = obs.obs_data_get_int(settings, "guard_seconds")
  poll_seconds    = obs.obs_data_get_int(settings, "poll_seconds")
  redial_minutes  = obs.obs_data_get_int(settings, "redial_minutes")
  fb_project      = obs.obs_data_get_string(settings, "fb_project")
  fb_key          = obs.obs_data_get_string(settings, "fb_key")
  default_channel = sanitize_channel(obs.obs_data_get_string(settings, "default_channel")) or "csgnet"
  manual_enabled  = obs.obs_data_get_bool(settings, "manual_enabled")
  manual_channel  = obs.obs_data_get_string(settings, "manual_channel")
  brb_enabled     = obs.obs_data_get_bool(settings, "brb_enabled")
  watchdog_hours  = obs.obs_data_get_int(settings, "watchdog_hours")
  reset_timers()
  if manual_enabled then
    local ch = sanitize_channel(manual_channel)
    if ch then retune(ch, "manual override") end
  end
end

function script_load(settings)
  hotkey_cover = obs.obs_hotkey_register_frontend(
    "csgn_cover_toggle", "CSGN: PANIC — toggle cover + mute",
    function(pressed)
      if not pressed then return end
      if cover_reasons["panic"] then clear_cover("panic") else raise_cover("panic") end
    end)
  hotkey_reload = obs.obs_hotkey_register_frontend(
    "csgn_feed_reload", "CSGN: reload Twitch feed (behind cover)",
    function(pressed) if pressed then reload_feed("hotkey") end end)

  local a = obs.obs_data_get_array(settings, "csgn_cover_toggle_hotkey")
  obs.obs_hotkey_load(hotkey_cover, a)
  obs.obs_data_array_release(a)
  local b = obs.obs_data_get_array(settings, "csgn_feed_reload_hotkey")
  obs.obs_hotkey_load(hotkey_reload, b)
  obs.obs_data_array_release(b)

  reset_timers()
  obs.timer_add(init_tick, 1500)
end

function script_save(settings)
  local a = obs.obs_hotkey_save(hotkey_cover)
  obs.obs_data_set_array(settings, "csgn_cover_toggle_hotkey", a)
  obs.obs_data_array_release(a)
  local b = obs.obs_hotkey_save(hotkey_reload)
  obs.obs_data_set_array(settings, "csgn_feed_reload_hotkey", b)
  obs.obs_data_array_release(b)
end

function script_unload()
  obs.timer_remove(init_tick)
  obs.timer_remove(poll_tick)
  obs.timer_remove(watchdog_tick)
  obs.timer_remove(guard_finish)
end
