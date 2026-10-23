import { ACESFilmicToneMapping, Clock, Group, PCFSoftShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from 'three'
import { BOATS, CAMERA, DAILY, graphicsPreset, PHYSICS, RACE, RENDER, TRAILS } from './config.js'
import * as bloxity from './bloxity.js'
import { initNet, net, sendLoadout, sendPose, syncAvatar } from './net.js'
import { inputState, install as installInput, onKey } from './input.js'
import { installTouch } from './touch.js'
import { createHud } from './hud.js'
import { anyWindowOpen, closeTopWindow } from './uiWindow.js'
import { installAudio, setVolume, sfx, toggleMuted, updateAudio } from './audio/index.js'
import { createRebirth } from './rebirth.js'
import { createPets, petsState } from './pets.js'
import { createEngine, ENGINES, engineState } from './engine.js'
import { createPartner, partnerState } from './partner.js'
import { createGifts, giftsState } from './gifts.js'
import { createSpin } from './spin.js'
import { createDaily } from './daily.js'
import { createTrails, trailById, trailState } from './trails.js'
import { createTrail } from './trail.js'
import { rebirthState } from './rebirth.js'
import { createPlayerBody, interpolate as interpolatePlayer, player, resetPlayer, respawn } from './player.js'
import { setCameraSensitivity, syncYawToPlayer, update as updateCamera } from './camera.js'
import { getMode, onModeChanged, toggleMode } from './modes.js'
import { bodyCount, initPhysics, stepPhysics } from './physics.js'
import { createLighting } from './lighting.js'
import { createWorld } from './world.js'
import { createPostFx } from './postfx.js'
import { setParticleDensity, updateParticles } from './particles.js'
import { setNeonBloom } from './propkit.js'
import { createLobby } from './lobby.js'
import { createPlaza } from './plaza.js'
import { createShops } from './shops.js'
import { createHub } from './hub.js'
import { createInteract } from './interact.js'
import { createEggs } from './eggs.js'
import { createBoat } from './boat.js'
import { buildBoat, disposeBoat } from './boatModels.js'
import { boatState, createBoats } from './boats.js'
import { createRace } from './race.js'
import { createTraining } from './training.js'
import { createBoostPanel } from './boostPanel.js'
import { createCompanions, updateCompanionMaterials } from './companions.js'
import { createRemotePlayers } from './remotePlayers.js'
import { buildDefaultCharacter, loadBaseCharacter } from './avatar/character.js'
import { applyProportions, attachEquippedAccessories } from './avatar/loader.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'

// Boot order: Bloxity SDK -> renderer -> Rapier (async
// wasm) -> world, lobby + plaza + shop props, lighting, player body + boat -> avatar (async, swaps in
// when ready) -> loop. The SDK is optional at every step.
let lighting = null
let renderer = null
let postfx = null
let trailsScene = null // made once the boat exists; Esc leaves it first

// Settings come from the portal's settings menu (or their defaults offline).
function applySetting(key, value) {
  if (key === 'camera_sensitivity') setCameraSensitivity(value)
  else if (key === 'fullscreen') bloxity.requestFullscreen(value)
  else if (key === 'sound_volume') setVolume(value)
  else if (key === 'graphics_quality' && renderer) {
    const next = graphicsPreset(value)
    renderer.shadowMap.enabled = next.shadows
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, next.dpr))
    lighting?.setShadows(next)
    postfx?.configure(next)
    setNeonBloom(next.bloom)
    setParticleDensity(next.particles)
    postfx?.setSize(window.innerWidth, window.innerHeight)
  }
}
bloxity.onSetting(applySetting)
bloxity.init()
installAudio() // starts on the first tap / key (browser autoplay rules)

// --- Renderer ---------------------------------------------------------------
const preset = graphicsPreset(bloxity.settings.graphics_quality)
renderer = new WebGLRenderer({ antialias: preset.antialias, powerPreference: 'high-performance' })
renderer.outputColorSpace = SRGBColorSpace
renderer.toneMapping = ACESFilmicToneMapping
renderer.toneMappingExposure = RENDER.exposure
renderer.shadowMap.enabled = preset.shadows
renderer.shadowMap.type = PCFSoftShadowMap
renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.dpr))
document.body.appendChild(renderer.domElement)
installInput(() => trailsScene?.close() || closeTopWindow() || bloxity.showMenu(), renderer.domElement) // Esc closes the Trails scene / an open window first

const scene = new Scene()
const camera = new PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far)
postfx = createPostFx(renderer, scene, camera)
postfx.configure(preset)

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight)
  postfx.setSize(window.innerWidth, window.innerHeight)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)
resize()

for (const key of Object.keys(bloxity.settings)) applySetting(key, bloxity.settings[key])

// --- Physics + world ---------------------------------------------------------
bloxity.loadingStep('Starting physics')
await initPhysics()

lighting = createLighting(scene, renderer, preset)
const world = createWorld(scene)
const homeFrom = scene.children.length
const lobby = createLobby(scene)
const plaza = createPlaza(scene)
const shops = createShops(scene)
// Everything on the start island; a race slides it away behind the boat (race.js / raceScenery.js).
const home = [...world.home, ...scene.children.slice(homeFrom)]
createPlayerBody()
syncYawToPlayer()

// --- Player avatar ----------------------------------------------------------
// The Bloxity base rig (player.glb; procedural fallback if it fails), dressed
// with the signed-in player's equipped cosmetics and body proportions. It
// rebuilds on customizer edits and sign-in/out. The avatar stands in the
// player's boat (boat.js), which carries it around the lobby.
const playerGroup = new Group()
scene.add(playerGroup)
const boat = createBoat()
playerGroup.add(boat.root)
const trail = createTrail(scene, boat.root) // the equipped trail, streaming off the stern
let avatar = null
let animator = null
let generation = 0
let avatarReady = false

function setAvatar(next) {
  if (avatar) boat.rider.remove(avatar)
  disposeAnimator(animator)
  avatar = next
  boat.rider.add(avatar)
  animator = makeAnimator(avatar)
}

setAvatar(buildDefaultCharacter()) // visible immediately; replaced once the rig loads

async function loadAvatar() {
  // The SDK fires twice per change (optimistic + confirmed); only the newest load may land.
  const mine = ++generation
  try {
    const group = await loadBaseCharacter()
    if (mine !== generation) return
    const equipped = bloxity.authState.user ? bloxity.getEquippedAvatar() : null
    await attachEquippedAccessories(group, equipped, { skinTextureUrl: bloxity.getSkinTextureUrl() })
    if (mine !== generation) return
    applyProportions(group, bloxity.authState.user ? bloxity.getProportions() : null)
    setAvatar(group)
  } finally {
    if (mine === generation) avatarReady = true
  }
}

let signedIn = null
bloxity.subscribeAuth((s) => {
  const now = !!s.user
  if (now !== signedIn) {
    signedIn = now
    loadAvatar() // also runs once at start to swap in the real rig
  }
})
bloxity.onAvatarChanged(() => {
  loadAvatar()
  syncAvatar() // the others see the new look too (net.js presence)
})
bloxity.onProportionsChanged(() => {
  applyProportions(avatar, bloxity.getProportions())
  syncAvatar()
})
bloxity.onRespawnRequest(() => respawnOrLeave())

// --- Modes + keys --------------------------------------------------------------
onModeChanged((mode) => {
  playerGroup.visible = mode !== 'player' // first person: you are the camera
})

function toggleDay() {
  lighting.toggleDayNight()
  sfx.dayNight()
}

onKey('KeyV', toggleMode)
onKey('KeyN', toggleDay)
onKey('KeyM', toggleMuted) // sound on/off (touch: the portal's sound_volume setting)
// Respawning mid-race leaves the race instead (race.leave puts the player back at the spawn).
const respawnOrLeave = () => (race?.isRacing() ? race.leave() : respawn())
onKey('KeyR', respawnOrLeave)
installTouch({ menu: bloxity.showMenu, mode: toggleMode, day: toggleDay, respawn: respawnOrLeave })
// Lightning is one counter: the rebirth energy, shown on the HUD's bolt pill and read as race speed.
let hud = null // made below; the rebirth window reports its energy from the start
const rebirthWindow = createRebirth({ onChange: (st) => hud?.setStat('wins', Math.floor(st.energy)) })
onKey('KeyB', rebirthWindow.toggle)
const petsWindow = createPets()
onKey('KeyP', petsWindow.toggle)
hud = createHud({
  menu: bloxity.showMenu,
  claim: () => giftsWindow.open(),
  spin: () => spinWindow.open(),
  daily: () => dailyWindow.open(),
  rebirth: rebirthWindow.open,
  pets: petsWindow.open,
  engine: () => engineWindow.open(),
  boats: () => boatsWindow.open(),
  partner: () => partnerWindow.open(),
  trail: () => race.isRacing() || trailsScene.open(), // the Trails scene would park the boat mid-race
  autoRace: (on) => {
    autoRace = on
    if (on) race.start()
  },
  autoTrain: (on) => training.setAuto(on),
  boosts: () => boostPanel.open(),
})
// Where every boost comes from (the HUD's boost circles).
const boostPanel = createBoostPanel()
hud.setStat('wins', Math.floor(rebirthState.energy))
// The player's own head on the distance bar and podium: their Bloxity profile picture.
bloxity.subscribeAuth(() => hud.setPfp(bloxity.getPfp()))

// Engines are bought with Wins: the HUD's trophy total.
const engineWindow = createEngine({
  wins: { get: () => hud.getStat('trophies'), set: (n) => hud.setStat('trophies', n) },
})
// Boats are bought with Wins (the HUD's trophy counter); equipping one swaps the hull the player rides.
const boatsWindow = createBoats({
  wallet: { wins: () => hud.getStat('trophies'), spend: (n) => hud.setStat('trophies', hud.getStat('trophies') - n) },
  onEquip: (id) => disposeBoat(boat.setHull(buildBoat(id))),
})
onKey('KeyO', boatsWindow.toggle)
// Every partner is bought with Wins (the HUD's trophy counter); none is free.
const partnerWindow = createPartner({
  wins: { get: () => hud.getStat('trophies'), set: (n) => hud.setStat('trophies', n) },
})
onKey('KeyT', partnerWindow.toggle)
// Online Gifts (HUD CLAIM! pill): lightning goes to the energy (= the HUD bolts),
// trophies the HUD total, pets the Pets window (refused when storage is full).
const giftsWindow = createGifts({
  onReward(g) {
    if (g.type === 'pet') return petsWindow.addPet(g.id)
    if (g.type === 'bolt') rebirthWindow.addEnergy(g.n)
    else if (g.type === 'trophy') hud.setStat('trophies', hud.getStat('trophies') + g.n)
  },
  onReadyCount: (n) => hud.setClaimCount(n),
})
onKey('KeyG', giftsWindow.toggle)
// Spin wheel (HUD wheel button / K): the server rolls each spin; Wins go to the HUD total, potions
// are counted with the gift potions, the HUGE pet joins the Pets window.
const spinWindow = createSpin({
  onReward(w) {
    if (w.type === 'pet') return petsWindow.addPet(w.pet)
    if (w.type === 'trophy') hud.setStat('trophies', hud.getStat('trophies') + w.n)
    else if (w.type === 'potion') giftsState.potions[w.potion] = (giftsState.potions[w.potion] ?? 0) + 1
  },
  onCount: (n) => hud.setSpinCount(n),
})
onKey('KeyK', spinWindow.toggle)
// Daily Reward (HUD calendar): a 7-day calendar the server keeps on its UTC clock. Wins go to the
// HUD total, the pet to the Pets window, Day 7's Axolotl Egg hatches for free (eggs, made below).
const dailyWindow = createDaily({
  onReward(r) {
    if (r.type === 'trophy') hud.setStat('trophies', hud.getStat('trophies') + r.n)
    else if (r.type === 'pet') petsWindow.addPet(r.id)
    else if (r.type === 'egg') eggs.hatchFree(DAILY.egg, r.n)
  },
  onReadyCount: (n) => hud.setDailyReady(n),
  canAutoOpen: () => !race.isRacing() && !trailsScene.isOpen() && !eggs.hatching,
})
// Trails scene: the HUD folds down, the world pauses and the boat is shown off
// at sea (stage() in the loop); tapping a trail previews it on the boat. Trails are bought with Wins.
trailsScene = createTrails({
  wallet: { wins: () => hud.getStat('wins'), spend: (n) => rebirthWindow.addEnergy(-n) },
  rebirths: () => rebirthState.rebirths,
  onPreview: (t) => trail.set(t),
  onOpen: () => {
    closeTopWindow()
    hud.setScene(true)
    boat.rider.visible = false // the reference shows the bare boat
  },
  onClose: () => {
    hud.setScene(false)
    boat.rider.visible = true
    playerGroup.visible = getMode() !== 'player'
    inputState.look.dx = inputState.look.dy = 0 // nothing the scene swallowed may turn the camera
  },
})
trail.set(trailById(trailState.equipped))
onKey('KeyL', () => race.isRacing() || trailsScene.toggle())

// The race: through the START gate (or AUTO RACE) the boat drives itself down the lane.
let autoRace = false
const race = createRace({
  scene,
  hud,
  lobby,
  world,
  home,
  onEnd() {
    playerGroup.visible = getMode() !== 'player'
    // AUTO RACE goes again once the result has been up for a moment.
    setTimeout(() => autoRace && !trailsScene.isOpen() && race.start(), RACE.resultSeconds * 1000)
  },
})

// Training: the plaza's treadmill lanes (and AUTO TRAIN) pay lightning.
const training = createTraining({ hud, plaza, onGain: (n) => rebirthWindow.addEnergy(n) })

// Hub pads in front of the Eggs stall, Boats stall, Engine Upgrade machine and hero statues open their windows.
const hubWindows = { pets: petsWindow.open, boats: boatsWindow.open, engine: engineWindow.open, partner: partnerWindow.open }
const hubFrom = scene.children.length
const hub = createHub(scene, hubWindows)
home.push(...scene.children.slice(hubFrom)) // the pads are on the island too
// The egg window (E at a stall egg): odds, Open 1 / 3, Auto, the hatch overlay; it takes E / R / T while open.
const eggs = createEggs({ hud, pets: petsWindow, spots: shops.spots.eggs })
// E prompts on the shop objects: open an egg, buy/equip boats, engines and partners in the world.
const interact = createInteract({ hud, lobby, shops, eggs, boats: boatsWindow, engine: engineWindow, partner: partnerWindow, windows: hubWindows })
// E interacts with the object in front of you; with none in range it toggles the Engine window as before.
onKey('KeyE', () => interact.trigger() || engineWindow.toggle())

// --- Presence: gear in the world, this player for the others, the others for this player ---
// (made after the start island's objects, so none of this slides away with it during a race)
// The equipped pets hover round the boat, the partner stands behind the rider and the engines take
// the equipped engine's colours x the boat's engine count. Polled: any window may change the gear.
const companions = createCompanions(scene, boat.seat, { shadows: true })
const engineLooks = new Map(ENGINES.map((e) => [e.id, e.look]))
const boatEngines = new Map(BOATS.list.map((b) => [b.id, b.engines]))
let gearKey = ''
let enginesKey = ''
function syncGear() {
  const gear = {
    boat: boatState.equipped ?? '',
    engine: engineState.equipped ?? '',
    trail: trailState.equipped ?? '',
    partner: partnerState.equipped ?? '',
    pets: petsState.pets.filter((pt) => pt.equipped).map((pt) => ({ kind: pt.kind, tier: pt.tier })),
  }
  const key = JSON.stringify(gear)
  if (key === gearKey) return
  gearKey = key
  const ek = `${gear.boat}|${gear.engine}`
  if (ek !== enginesKey) {
    enginesKey = ek
    boat.setEngines(engineLooks.get(gear.engine) ?? null, boatEngines.get(gear.boat) ?? 1)
  }
  companions.setPets(gear.pets)
  companions.setPartner(gear.partner)
  sendLoadout(gear)
}
syncGear()
setInterval(syncGear, 250)
// Everyone else in the room, with their boats, engines, trails, pets and partners (remotePlayers.js).
const remotes = createRemotePlayers(scene)
const round = (n) => Math.round(n * 100) / 100

// Progress lives only on the server (net.js): it loads each window's part of the save into it
// and saves the HUD's trophies + gems and every window's snapshot. Nothing is kept in the browser.
initNet({ hud, stores: [rebirthWindow, petsWindow, engineWindow, boatsWindow, partnerWindow, giftsWindow, trailsScene, race, eggs] })

// --- Loop -------------------------------------------------------------------
const clock = new Clock()
let shownLoading = true
let readySince = 0

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1) // clamp huge frames (tab switch, breakpoint)
  const elapsed = clock.elapsedTime

  const staging = trailsScene.isOpen() // the Trails scene pauses the world and parks the boat at sea
  if (!staging) stepPhysics(dt) // runs the player controller + world at the fixed rate, interpolates bodies
  interpolatePlayer()
  if (!staging && !race.isRacing() && race.atGate(player.position)) race.start()
  const racing = race.isRacing()
  const scroll = race.update(dt) // m/s the world slides past a cruising boat (0 when not racing)

  const p = player.renderPosition
  playerGroup.position.set(p.x, p.y, p.z)
  playerGroup.rotation.y = player.facing
  const speed = Math.hypot(player.velocity.x, player.velocity.z)
  if (staging) {
    trailsScene.stage(camera, playerGroup)
    playerGroup.visible = true
    boat.update(dt, TRAILS.showcase.speed, 0, elapsed)
    animator?.update(dt, { grounded: true, speed: 0, verticalVelocity: 0, turn: 0 })
  } else if (racing) {
    playerGroup.visible = true // the race cam is always third person
    boat.update(dt, race.boatSpeed(), inputState.move.x, elapsed, race.tapBoost())
    animator?.update(dt, { grounded: true, speed: 0, verticalVelocity: 0, turn: 0 })
  } else if (getMode() === 'character') {
    boat.update(dt, speed, inputState.move.x, elapsed)
    // Riding: the avatar stands still in the boat (idle pose), only jumps animate.
    animator?.update(dt, {
      grounded: player.grounded,
      speed: 0,
      verticalVelocity: player.velocity.y,
      turn: 0,
    })
  }

  if (racing) race.camera(camera, dt)
  else if (!staging) updateCamera(camera, dt)
  // Engine, hull and beach ambience follow the boat and the camera.
  updateAudio(dt, {
    camera,
    player: { x: player.position.x, y: player.position.y, z: player.position.z, vy: player.velocity.y, grounded: player.grounded },
    speed: staging ? TRAILS.showcase.speed : racing ? race.boatSpeed() : speed,
    top: racing ? race.topSpeed() : staging ? TRAILS.showcase.speed * 1.6 : PHYSICS.sprintSpeed,
    boost: racing ? race.tapBoost() : 0,
    moving: Math.min(1, Math.hypot(inputState.move.x, inputState.move.z)),
    racing,
    staging,
    visible: true,
    windowOpen: anyWindowOpen(),
    night: lighting.isNight(),
  })
  if (!staging) training.update(dt, player.renderPosition, camera, racing)
  hub.update(elapsed, staging || racing ? null : player.position)
  interact.update(camera, staging || racing ? null : player.renderPosition)
  eggs.update(staging || racing ? null : player.renderPosition)
  trail.update(dt, camera, staging ? TRAILS.showcase.speed : scroll)
  companions.setVisible(playerGroup.visible)
  companions.update(dt, elapsed, playerGroup.position.x, playerGroup.position.y, playerGroup.position.z, playerGroup.rotation.y)
  updateCompanionMaterials(elapsed)
  // This player for the others, in track coordinates (the real position, not the Trails showcase).
  const track = race.trackScroll()
  sendPose({ x: round(player.position.x), y: round(player.position.y), z: round(player.position.z - track), yaw: round(player.facing), speed: round(racing ? race.boatSpeed() : speed) })
  remotes.update(dt, elapsed, player.renderPosition, track, scroll, camera)
  hud.update()
  world.update(dt, elapsed)
  updateParticles(elapsed, renderer.domElement.height)
  lobby.update(dt, elapsed)
  plaza.update(dt, elapsed)
  shops.update(dt, elapsed)
  lighting.update(dt, playerGroup.position)
  postfx.render()

  // Loading ends once the scene has drawn and the avatar has had its chance (max ~5 s).
  if (shownLoading) {
    readySince += dt
    if (avatarReady || readySince > 5) {
      shownLoading = false
      bloxity.notifyFirstFrame()
    }
  }
})

window.addEventListener('beforeunload', bloxity.teardown)

// Dev-only console hook, e.g. __game.teleport(-24, 0, 6, Math.PI / 2)
if (import.meta.env.DEV) {
  const teleport = (x, y, z, facing = player.facing) => {
    resetPlayer({ x, y, z }, facing)
    syncYawToPlayer()
  }
  window.__game = { player, scene, renderer, camera, postfx, bodies: bodyCount, toggleMode, toggleDay, teleport, rebirth: rebirthWindow, trails: trailsScene, gifts: giftsWindow, daily: dailyWindow, spin: spinWindow, hud, race, training, eggs, pets: petsWindow, net, remotes, companions }
}
