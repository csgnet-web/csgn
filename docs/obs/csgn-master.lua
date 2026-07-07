--[[
  CSGN MASTER — OBS control script for the 24/7 encoder.

  /player is the brain: it decides LIVE / STARTING_SOON / BRB / INTERMISSION /
  OVERRIDE, plays the brand wipe between states, pins Twitch source quality,
  forces audio on inside OBS, and holds a branded cover over the feed until it
  settles — so the Twitch startup reveal (play button, preroll, channel chrome)
  is never seen, on first load OR after a reload. This script is intentionally
  tiny. It only makes a machine that runs for weeks self-healing:

    1. Periodic refresh watchdog  — reload the browser source every N hours to
       clear CEF memory creep. Kept infrequent on purpose (default 12h): each
       reload is seamless because /player restores the exact network state and
       masks the reload with its branded cover, but fewer reloads still means
       fewer re-buffers, so we only reload as often as memory creep demands.
    2. Nightly refresh            — optional single reload at a fixed local hour.
    3. Hotkeys                    — reload-now, and toggle the ?debug=1 panel,
       bindable in Settings -> Hotkeys.

  It never switches scenes and never changes the page's state — it only reloads
  one source — so every transition/stinger still runs inside /player.

  Install: Tools -> Scripts -> + -> pick this file, then set the properties.
]]

local obs = obslua

-- ── Settings (edit in the Scripts UI, not here) ─────────────────────────────
local source_name        = "CSGN MASTER SOURCE"
local base_url           = "https://csgn.fun/player"
local watchdog_enabled   = true
local watchdog_hours     = 12          -- reload every N hours (fewer = fewer re-buffers)
local nightly_enabled    = false
local nightly_hour       = 5           -- 0-23, local time
local debug_on           = false       -- current ?debug=1 toggle state

local last_nightly_day   = -1          -- guards one nightly reload per day
local hotkey_reload      = obs.OBS_INVALID_HOTKEY_ID
local hotkey_debug       = obs.OBS_INVALID_HOTKEY_ID

-- ── Helpers ─────────────────────────────────────────────────────────────────

-- Force a browser source to hard-reload by rewriting its URL. Setting the same
-- URL is a no-op in some OBS builds, so we bounce through the desired URL via a
-- settings update, which reliably reloads CEF.
local function set_source_url(url)
  local source = obs.obs_get_source_by_name(source_name)
  if source == nil then
    obs.script_log(obs.LOG_WARNING, "CSGN: source '" .. source_name .. "' not found")
    return
  end
  local settings = obs.obs_data_create()
  obs.obs_data_set_string(settings, "url", url)
  obs.obs_source_update(source, settings)
  obs.obs_data_release(settings)
  obs.obs_source_release(source)
end

local function current_url()
  if debug_on then
    local sep = string.find(base_url, "?", 1, true) and "&" or "?"
    return base_url .. sep .. "debug=1"
  end
  return base_url
end

local function reload_source()
  -- Nudge the URL (append/refresh a cache-busting no-op) to force a reload.
  local url = current_url()
  local sep = string.find(url, "?", 1, true) and "&" or "?"
  set_source_url(url .. sep .. "_r=" .. os.time())
  obs.script_log(obs.LOG_INFO, "CSGN: reloaded " .. source_name)
end

-- ── Timers ──────────────────────────────────────────────────────────────────

local function on_watchdog_tick()
  reload_source()
end

local function on_minute_tick()
  if not nightly_enabled then return end
  local t = os.date("*t")
  if t.hour == nightly_hour and t.yday ~= last_nightly_day then
    last_nightly_day = t.yday
    obs.script_log(obs.LOG_INFO, "CSGN: nightly refresh")
    reload_source()
  end
end

local function reset_timers()
  obs.timer_remove(on_watchdog_tick)
  obs.timer_remove(on_minute_tick)
  if watchdog_enabled and watchdog_hours > 0 then
    obs.timer_add(on_watchdog_tick, math.floor(watchdog_hours * 3600 * 1000))
  end
  obs.timer_add(on_minute_tick, 60 * 1000) -- always on; cheap, gates on nightly_enabled
end

-- ── OBS script lifecycle ────────────────────────────────────────────────────

function script_description()
  return [[<b>CSGN MASTER</b> — self-healing watchdog for the 24/7 /player encoder.<br/>
Periodically reloads the browser source (memory-creep insurance), an optional
nightly refresh, and hotkeys to reload + toggle the <code>?debug=1</code> panel.
All network logic lives in /player; this only reloads one source.]]
end

function script_properties()
  local p = obs.obs_properties_create()
  obs.obs_properties_add_text(p, "source_name", "Browser source name", obs.OBS_TEXT_DEFAULT)
  obs.obs_properties_add_text(p, "base_url", "Base /player URL", obs.OBS_TEXT_DEFAULT)
  obs.obs_properties_add_bool(p, "watchdog_enabled", "Periodic refresh watchdog")
  obs.obs_properties_add_int(p, "watchdog_hours", "  reload every (hours)", 1, 48, 1)
  obs.obs_properties_add_bool(p, "nightly_enabled", "Nightly refresh")
  obs.obs_properties_add_int(p, "nightly_hour", "  nightly hour (0-23 local)", 0, 23, 1)
  return p
end

function script_defaults(settings)
  obs.obs_data_set_default_string(settings, "source_name", source_name)
  obs.obs_data_set_default_string(settings, "base_url", base_url)
  obs.obs_data_set_default_bool(settings, "watchdog_enabled", watchdog_enabled)
  obs.obs_data_set_default_int(settings, "watchdog_hours", watchdog_hours)
  obs.obs_data_set_default_bool(settings, "nightly_enabled", nightly_enabled)
  obs.obs_data_set_default_int(settings, "nightly_hour", nightly_hour)
end

function script_update(settings)
  source_name      = obs.obs_data_get_string(settings, "source_name")
  base_url         = obs.obs_data_get_string(settings, "base_url")
  watchdog_enabled = obs.obs_data_get_bool(settings, "watchdog_enabled")
  watchdog_hours   = obs.obs_data_get_int(settings, "watchdog_hours")
  nightly_enabled  = obs.obs_data_get_bool(settings, "nightly_enabled")
  nightly_hour     = obs.obs_data_get_int(settings, "nightly_hour")
  reset_timers()
end

function script_load(settings)
  hotkey_reload = obs.obs_hotkey_register_frontend(
    "csgn_reload", "CSGN: reload /player source",
    function(pressed) if pressed then reload_source() end end)
  hotkey_debug = obs.obs_hotkey_register_frontend(
    "csgn_toggle_debug", "CSGN: toggle ?debug=1 panel",
    function(pressed)
      if pressed then
        debug_on = not debug_on
        reload_source()
        obs.script_log(obs.LOG_INFO, "CSGN: debug " .. (debug_on and "ON" or "OFF"))
      end
    end)

  local a = obs.obs_data_get_array(settings, "csgn_reload_hotkey")
  obs.obs_hotkey_load(hotkey_reload, a)
  obs.obs_data_array_release(a)
  local b = obs.obs_data_get_array(settings, "csgn_toggle_debug_hotkey")
  obs.obs_hotkey_load(hotkey_debug, b)
  obs.obs_data_array_release(b)

  reset_timers()
end

function script_save(settings)
  local a = obs.obs_hotkey_save(hotkey_reload)
  obs.obs_data_set_array(settings, "csgn_reload_hotkey", a)
  obs.obs_data_array_release(a)
  local b = obs.obs_hotkey_save(hotkey_debug)
  obs.obs_data_set_array(settings, "csgn_toggle_debug_hotkey", b)
  obs.obs_data_array_release(b)
end

function script_unload()
  obs.timer_remove(on_watchdog_tick)
  obs.timer_remove(on_minute_tick)
end
