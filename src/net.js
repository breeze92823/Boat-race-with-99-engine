// Colyseus link to Boat-race-with-99-engine-backend (room "world"), after Kayak & Surf's net.js.
// The server holds the player's ONLY save: nothing about progress is kept in the browser. On join
// the server answers with `progress` (the saved doc: every store's hydrate() takes its part),
// `noProgress` (new account, guest or no database: keep the fresh state and save it) or
// `serverError` (the save could not be read: never overwrite it). From then on the whole snapshot
// (HUD trophies + gems, playtime and every store's snapshot()) is sent as `saveProgress` whenever
// it changed, at most every NET.saveEvery s, and when the tab hides or closes.
// Guests (not signed in to Bloxity) are never saved by the server, so their progress lasts the page.
// Never throws and never blocks play: with no server (or an unreachable one) the game runs on a
// fresh, unsaved state and keeps trying to connect.
import { Client } from '@colyseus/sdk'
import { DEV_MODE, NET, SERVER_URL } from './config.js'
import { authState, canResolveServer, getPfp, resolveServerEndpoint, subscribeAuth } from './bloxity.js'

export const net = {
  room: null,
  connected: false,
  hydrated: false, // a progress/noProgress answer arrived: saving is allowed
  // Seconds played (tab visible), saved progress included once it loads.
  get playtime() {
    return Math.floor(playtime)
  },
  get sessionId() {
    return this.room?.sessionId ?? null
  },
}

// --- Identity ----------------------------------------------------------------
// Signed-in players use their Bloxity id; everyone else a per-browser guest id (never saved).
// Dev mode (no SDK) plays as a per-browser signed-in dev id, so a local server with Mongo keeps
// its progress across reloads. Only these ids are stored in the browser, never progress.
function storedId(key, make) {
  try {
    let id = localStorage.getItem(key)
    if (!id) localStorage.setItem(key, (id = make()))
    return id
  } catch {
    return make()
  }
}
const rand = () => Math.random().toString(36).slice(2, 8)
const GUEST = storedId('boat-race-99.guest', () => `guest-${rand()}`)
const DEV = DEV_MODE ? storedId('boat-race-99.dev', () => `dev-${rand()}`) : ''

function identity() {
  if (DEV) return { userId: DEV, username: `Dev ${DEV.slice(4)}` }
  const u = authState.user
  const id = u && (u._id || u.id || u.userId || u.uid)
  if (!id) return { userId: GUEST, username: authState.guest?.displayName || authState.guest?.username || 'Guest' }
  return { userId: String(id), username: String(u.displayName || u.username || u.name || 'Player') }
}

// --- Saving ------------------------------------------------------------------
let playtime = 0 // s, see net.playtime
let lastSaved = ''
let savedAt = 0
let sentId = '' // identity the server currently attributes saves to
let loadedId = '' // identity whose saved progress this tab has already loaded
let hud = null // initNet's: trophies and gems live in its stats
let stores = [] // initNet's: { snapshot() -> part of the save, hydrate(doc) }

// The saved progress (backend sanitize.ts sanitizeProgress).
const progress = () => {
  const out = { trophies: hud?.getStat('trophies') ?? 0, gems: hud?.getStat('gems') ?? 0, playtime: Math.floor(playtime) }
  for (const s of stores) Object.assign(out, s.snapshot())
  return out
}
const isGuest = () => sentId.startsWith('guest-')

// A loaded save over the local state: every store resets to a new player's state, then takes its part.
function hydrate(doc) {
  for (const key of ['trophies', 'gems']) if (Number.isFinite(doc[key]) && doc[key] >= 0) hud?.setStat(key, doc[key])
  if (Number.isFinite(doc.playtime)) playtime = doc.playtime
  for (const s of stores) {
    try {
      s.hydrate(doc)
    } catch (err) {
      console.warn('[net] hydrate failed', err)
    }
  }
}

export function saveNow() {
  if (!net.connected || !net.hydrated || isGuest()) return
  const snap = JSON.stringify(progress())
  if (snap === lastSaved) return
  lastSaved = snap
  savedAt = performance.now()
  send('saveProgress', JSON.parse(snap))
}

function send(type, payload) {
  try {
    net.room?.send(type, payload)
  } catch (err) {
    console.warn('[net] send failed', type, err)
  }
}

// --- Server-decided features (Daily Reward, Spin wheel) ------------------------------------
// Handlers registered here are attached to every room this tab joins (reconnects included).
const handlers = []
export function onNetMessage(type, fn) {
  handlers.push([type, fn])
  net.room?.onMessage(type, fn)
}
// Sends to the server if connected; false (nothing sent) otherwise.
export function sendNet(type, payload) {
  if (!net.connected) return false
  send(type, payload)
  return true
}

// --- Racers (roster) -----------------------------------------------------------
// Everyone else in the room who is racing right now: [{ id, name, distance, pfp }] for the HUD's
// distance bar and podium. Read from the synced roster (backend PlayerState), [] when offline.
export function remoteRacers() {
  const out = []
  net.room?.state?.players?.forEach?.((p, id) => {
    if (id !== net.sessionId && p.racing) out.push({ id, name: p.username || 'Player', distance: p.distance || 0, pfp: p.pfp || '' })
  })
  return out
}

// This player's race for the others' bars: sent at most every NET.raceEvery s while racing, and
// at once when it starts or ends.
let raceSentAt = 0
let raceSent = false
export function sendRace(racing, distance) {
  if (!net.connected) return
  const now = performance.now()
  if (racing === raceSent && (!racing || now - raceSentAt < NET.raceEvery * 1000)) return
  raceSent = racing
  raceSentAt = now
  send('race', { racing, distance: racing ? Math.floor(distance) : 0 })
}

// --- Connection --------------------------------------------------------------
let sentPfp = '' // the profile picture the server shows the others (roster `pfp`)
function attach(room) {
  net.room = room
  net.connected = true
  for (const [type, fn] of handlers) room.onMessage(type, fn)
  room.onMessage('progress', (doc) => {
    net.hydrated = true
    lastSaved = ''
    // A reconnect under the same identity: this tab is newer than the save (it may hold changes
    // not sent yet), so push it rather than load over it.
    if (loadedId === sentId || !doc) return saveNow()
    loadedId = sentId
    hydrate(doc)
    saveNow() // fills in whatever an older save lacked; a no-op send of the same values otherwise
  })
  room.onMessage('noProgress', () => {
    // New account, guest or no database: keep the local progress and push it as the first save.
    net.hydrated = true
    loadedId = sentId
    lastSaved = ''
    saveNow()
  })
  room.onMessage('serverError', () => {
    // The save exists but could not be read: never overwrite it.
    net.hydrated = false
    console.warn('[net] server could not read the saved progress; saving is off for this session')
  })
  room.onLeave(() => {
    if (net.room !== room) return
    net.room = null
    net.connected = false
    net.hydrated = false
    setTimeout(connect, 3000) // keep trying; play is unaffected meanwhile
  })
}

export const hasServer = () => !!(SERVER_URL || canResolveServer())

let connecting = false
async function connect() {
  if (!hasServer() || connecting || net.connected) return
  connecting = true
  try {
    const id = identity()
    sentId = id.userId
    sentPfp = getPfp()
    raceSent = false
    const client = new Client(SERVER_URL || (await resolveServerEndpoint()))
    attach(await client.joinOrCreate('world', { ...id, pfp: sentPfp }))
  } catch (err) {
    console.info('[net] could not reach the server; progress is not being saved', err?.message ?? err)
    setTimeout(connect, NET.retry * 1000)
  } finally {
    connecting = false
  }
}

// Playtime ticks once a second while the tab is visible; a changed snapshot is sent at most every
// NET.saveEvery s.
setInterval(() => {
  if (document.hidden) return
  playtime += 1
  if (performance.now() - savedAt >= NET.saveEvery * 1000) saveNow()
}, 1000)

// hud: main.js's createHud() (its trophies and gems are saved). stores: every window whose state is
// saved, each { snapshot(), hydrate(doc) }.
export function initNet(opts = {}) {
  hud = opts.hud ?? null
  stores = opts.stores ?? []
  if (!hasServer()) return console.info('[net] no server configured; progress is not being saved')
  // The first ready call connects; later ones are sign-in / sign-out.
  subscribeAuth((s) => {
    if (!s.ready) return
    if (!net.connected) return void connect()
    const id = identity()
    sentPfp = getPfp()
    if (id.userId === sentId) return send('identify', { username: id.username, pfp: sentPfp })
    saveNow() // under the old id, before switching
    net.hydrated = false
    sentId = id.userId
    send('identify', { ...id, pfp: sentPfp })
  })
  window.addEventListener('pagehide', saveNow)
  document.addEventListener('visibilitychange', () => document.hidden && saveNow())
}
