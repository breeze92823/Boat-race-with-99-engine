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
import { DEV_MODE, NET, SERVER_URL, WORLDS } from './config.js'
import { worldState } from './worlds.js'
import {
  authState,
  canResolveServer,
  getEquippedAvatar,
  getPfp,
  getProportions,
  getSkinTextureUrl,
  launchRoomId,
  locateRoom,
  resolveServerEndpoint,
  subscribeAuth,
  updateRoom,
} from './bloxity.js'

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

// A roster entry is in this player's world (worlds.js; "" from an older client = the start world).
export const sameWorld = (p) => (p.world || WORLDS.start) === worldState.current

// --- Racers (roster) -----------------------------------------------------------
// Everyone else in the room who is racing right now: [{ id, name, distance, pfp }] for the HUD's
// distance bar and podium. Read from the synced roster (backend PlayerState), [] when offline.
export function remoteRacers() {
  const out = []
  net.room?.state?.players?.forEach?.((p, id) => {
    if (id !== net.sessionId && p.racing && sameWorld(p)) out.push({ id, name: p.username || 'Player', distance: p.distance || 0, pfp: p.pfp || '' })
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

// --- Presence (remotePlayers.js) --------------------------------------------------
// What the others need to draw this player: the pose (track coordinates, see race.trackScroll),
// the equipped gear and the Bloxity look. The latest of each also rides on the join options, so a
// (re)join shows up right away. The roster (`net.room.state.players`) carries everyone's.
const AVATAR_MAX = 3000 // backend AVATAR_MAX_LEN
// The signed-in player's look as JSON { equipped, proportions, skin }; the skin URL is dropped
// first when it doesn't fit. "" = the default character.
function avatarJson() {
  if (!authState.user) return ''
  const equipped = getEquippedAvatar()
  if (!equipped) return ''
  for (const skin of [getSkinTextureUrl(), null]) {
    try {
      const json = JSON.stringify({ equipped, proportions: getProportions(), skin })
      if (json.length <= AVATAR_MAX) return json
    } catch {
      return ''
    }
  }
  return ''
}
const presence = { pose: null, loadout: null }
let poseKey = ''
let poseAt = 0
// { x, y, z, yaw, speed }: at most NET.poseHz a second, nothing while it stands still.
export function sendPose(pose) {
  presence.pose = pose
  if (!net.connected) return
  const now = performance.now()
  if (now - poseAt < 1000 / NET.poseHz) return
  const key = `${pose.x}|${pose.y}|${pose.z}|${pose.yaw}|${pose.speed}`
  if (key === poseKey) return
  poseKey = key
  poseAt = now
  send('pose', pose)
}
let loadoutKey = ''
// { boat, engine, trail, partner, pets: [{ kind, tier }], world }: sent when it changes.
export function sendLoadout(loadout) {
  presence.loadout = loadout
  const key = JSON.stringify(loadout)
  if (!net.connected || key === loadoutKey) return
  loadoutKey = key
  send('loadout', loadout)
}
let sentAvatar = ''
// The Bloxity look changed (customizer, sign-in/out): send it if it differs.
export function syncAvatar() {
  if (!net.connected) return
  const avatar = avatarJson()
  if (avatar === sentAvatar) return
  sentAvatar = avatar
  send('setAvatar', { avatar })
}
// Everyone in the room (sessionId -> roster entry), null when offline.
export const roster = () => (net.connected ? net.room?.state?.players ?? null : null)

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
    updateRoom('')
    // Resolve again rather than rejoin the old endpoint: that is how players move off a pod being
    // replaced. Keep trying; play is unaffected meanwhile.
    setTimeout(connect, NET.rejoin * 1000)
  })
}

export const hasServer = () => !!(SERVER_URL || canResolveServer())

// The ?roomId= this page was opened with (Open Rooms Join / friend invite): tried on the first
// connect only, then normal matchmaking.
let launchRoom = launchRoomId()
async function joinLaunchRoom(options) {
  const id = launchRoom
  launchRoom = ''
  if (!id) return null
  try {
    if (SERVER_URL) return { room: await new Client(SERVER_URL).joinById(id.split('~').pop(), options), relay: '' }
    const at = await locateRoom(id)
    if (at) return { room: await new Client(at.endpoint).joinById(at.roomId, options), relay: at.relayRoomId }
  } catch (err) {
    console.info('[net] the invited room is gone or full; matchmaking instead', err?.message ?? err)
  }
  return null
}

// Deployed builds ask the matchmaker on every connect (a new Client per endpoint, each is pinned to
// one pod). userId lets it reuse this player's seat on retries; guest/dev ids are not Bloxity ids.
async function joinAnyRoom(options) {
  if (SERVER_URL) return { room: await new Client(SERVER_URL).joinOrCreate('world', options), relay: '' }
  const { endpoint, relayRoomId } = await resolveServerEndpoint(/^(guest|dev)-/.test(options.userId) ? undefined : options.userId)
  return { room: await new Client(endpoint).joinOrCreate('world', options), relay: relayRoomId }
}

let connecting = false
let retryIn = NET.retry // s: backoff while the matchmaker / server can't be reached
async function connect() {
  if (!hasServer() || connecting || net.connected) return
  connecting = true
  try {
    const id = identity()
    sentId = id.userId
    sentPfp = getPfp()
    raceSent = false
    sentAvatar = avatarJson()
    loadoutKey = JSON.stringify(presence.loadout)
    poseKey = ''
    const options = { ...id, pfp: sentPfp, avatar: sentAvatar, pose: presence.pose, loadout: presence.loadout }
    const { room, relay } = (await joinLaunchRoom(options)) ?? (await joinAnyRoom(options))
    retryIn = NET.retry
    attach(room)
    // relay~room lets an invited friend join this exact room through its pod's relay (bloxity.js locateRoom).
    updateRoom(relay ? `${relay}~${room.roomId}` : room.roomId)
  } catch (err) {
    console.info(`[net] could not reach the server (retrying in ${retryIn}s); progress is not being saved`, err?.message ?? err)
    setTimeout(connect, retryIn * 1000)
    retryIn = Math.min(retryIn * 2, NET.retryMax)
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
    syncAvatar() // signed in / out: the others see the new look
    if (id.userId === sentId) return send('identify', { username: id.username, pfp: sentPfp })
    saveNow() // under the old id, before switching
    net.hydrated = false
    sentId = id.userId
    send('identify', { ...id, pfp: sentPfp })
  })
  window.addEventListener('pagehide', saveNow)
  document.addEventListener('visibilitychange', () => document.hidden && saveNow())
}
