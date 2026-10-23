import { CanvasTexture, Color, CylinderGeometry, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, RepeatWrapping, SphereGeometry, SRGBColorSpace, Vector3 } from 'three'
import { BEACH, CAMERA, clamp, FOG, HUD, LOBBY, RACE, WATER } from './config.js'
import { remoteRacers, sendRace } from './net.js'
import { inputState, isLocked } from './input.js'
import { getCameraSensitivity } from './camera.js'
import { isFirstPerson, onModeChanged, setMode } from './modes.js'
import { player, respawn } from './player.js'
import { closeTopWindow } from './uiWindow.js'
import { boosts } from './boosts.js'
import { put, std } from './propkit.js'
import { createRaceHud } from './raceHud.js'
import { createRaceScenery } from './raceScenery.js'
import { engineBlip, engineRev, sfx } from './audio/index.js'
import { setRacing } from './juice.js'

// The race: driving through the START gate hands the boat to this module. It
// drives itself down the buoy lane (-Z), speeding up to its top speed
// ((RACE.baseSpeed + RACE.speedPerBolt * the HUD's lightning) x the Acc boost), A/D or the
// joystick steer inside the ropes, and every checkpoint wall across the lane
// it passes pays Wins (the HUD's trophies; raceHud plays the trophy/confetti
// reward). It ends at the finish line (RACE.finish studs) or on Leave, shows the result and puts
// the player back at the spawn.
// The sea is only WATER.size wide, so past RACE.cruiseZ the boat stops moving
// and the world slides past instead: the lane group (period: two buoys, so the
// red/yellow pattern never jumps), the sea's ripples (world.setScroll) and the
// trail (update()'s return value is the scroll speed for trail.update).
const G = LOBBY.gate
const L = RACE.lane
const SHORE_Y = WATER.level + 0.28 // feet height once the boat is out on the water
const COMPACT_CAM = { ...RACE.camera, ...RACE.camera.compact }
const ORBIT = RACE.camera.orbit

const CP = RACE.checkpoint
// Checkpoint spacing for a top speed: the step nearest (in log) to CP.seconds of driving.
const stepFor = (top) => CP.steps.reduce((a, b) => (Math.abs(Math.log(b / (top * CP.seconds))) < Math.abs(Math.log(a / (top * CP.seconds))) ? b : a))

const screenPos = new Vector3()

// A checkpoint wall: pale, brighter at the water, soft at the sides and top.
function wallTexture() {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 128
  const ctx = c.getContext('2d')
  const v = ctx.createLinearGradient(0, 128, 0, 0)
  v.addColorStop(0, 'rgba(255,255,255,1)')
  v.addColorStop(0.5, 'rgba(255,255,255,0.6)')
  v.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, 64, 128)
  ctx.globalCompositeOperation = 'destination-in' // fade the left and right edges
  const h = ctx.createLinearGradient(0, 0, 64, 0)
  h.addColorStop(0, 'rgba(0,0,0,0.2)')
  h.addColorStop(0.08, 'rgba(0,0,0,1)')
  h.addColorStop(0.92, 'rgba(0,0,0,1)')
  h.addColorStop(1, 'rgba(0,0,0,0.2)')
  ctx.fillStyle = h
  ctx.fillRect(0, 0, 64, 128)
  return new CanvasTexture(c)
}

function buildWalls(scene) {
  const geo = new PlaneGeometry(G.halfWidth * 2, CP.wallHeight)
  geo.translate(0, CP.wallHeight / 2, 0)
  const mat = new MeshBasicMaterial({ map: wallTexture(), color: CP.color, transparent: true, opacity: CP.opacity, depthWrite: false, side: DoubleSide })
  return Array.from({ length: CP.ahead }, () => {
    const wall = new Mesh(geo, mat)
    wall.position.y = WATER.level
    wall.visible = false
    wall.renderOrder = 4 // after the trail and the sea
    scene.add(wall)
    return wall
  })
}

// Orange/white candy-cane rope, stripes painted diagonally so they wrap as a helix.
function ropeTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 64, 64)
  ctx.fillStyle = '#ff5a1a'
  for (const o of [-64, 0, 64]) {
    ctx.beginPath()
    ctx.moveTo(o, 0)
    ctx.lineTo(o + 32, 0)
    ctx.lineTo(o + 96, 64)
    ctx.lineTo(o + 64, 64)
    ctx.closePath()
    ctx.fill()
  }
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.repeat.set(1, L.length / (2 * L.stripe))
  return tex
}

// The race lane: the lobby's buoy pattern, much longer, on striped ropes.
function buildLane(scene) {
  const hw = G.halfWidth
  const lane = new Group()
  lane.position.z = G.z
  lane.visible = false
  scene.add(lane)
  const count = Math.floor(L.length / L.buoySpacing / 2) * 2 // even: the pattern repeats every two buoys
  const buoys = new InstancedMesh(new SphereGeometry(0.55, 14, 10), std('#ffffff', { roughness: 0.35 }), count * 2)
  const m = new Matrix4()
  const red = new Color(LOBBY.colors.buoyA)
  const yellow = new Color(LOBBY.colors.buoyB)
  const start = -G.padDepth / 2 - 2
  let n = 0
  const rope = new CylinderGeometry(0.11, 0.11, L.length, 8)
  const ropeMat = std('#ffffff', { map: ropeTexture(), roughness: 0.5 })
  for (const side of [-1, 1]) {
    for (let i = 0; i < count; i++) {
      m.makeScale(1, 0.8, 1).setPosition(side * hw, WATER.level + 0.18, start - i * L.buoySpacing)
      buoys.setMatrixAt(n, m)
      buoys.setColorAt(n++, i % 2 ? yellow : red)
    }
    put(lane, rope, ropeMat, side * hw, WATER.level + 0.25, start - L.length / 2, false).rotation.x = Math.PI / 2
  }
  buoys.castShadow = true
  buoys.frustumCulled = false // one long instanced mesh; its bounds would be the first buoy's
  lane.add(buoys)
  return lane
}


// hud: the main HUD (stats, setDistance / setRacers, timer); the race widgets are added to it.
// lobby: setLaneVisible. world: setScroll. home: the start island's scene objects (slid away while
// racing). onEnd(): after the player is back at the spawn.
export function createRace({ scene, hud, lobby, world, home, onEnd }) {
  const lane = buildLane(scene)
  const walls = buildWalls(scene)
  const scenery = createRaceScenery(scene, home) // islands, ships, arches... streaming past the lane
  // next: index of the next checkpoint; sx, sy: the boat on screen (px), where the reward trophies start.
  // boost: boosts() when the race started; lastTop: the previous race's top speed (for the speed-up banner);
  // step / early: this race's checkpoint spacing and the early checkpoints below it; best: the personal best
  // (studs), record: this race has passed it; boostTap: the tap boost (0..RACE.tap.max);
  // yaw / pitch: the dragged camera orbit on top of the chase framing (0 = straight behind);
  // in first person the look direction off straight down the lane (+ pitch = looking down).
  // zoom / zoomEased: wheel / pinch metres added to the chase boom; reach: the framing's own boom (m).
  const s = { racing: false, t: 0, studs: 0, speed: 0, top: 0, x: 0, y: 0, z: 0, scroll: 0, next: 0, earned: 0, camX: 0, sx: 0, sy: 0, boost: null, lastTop: 0, step: 1000, payCap: Infinity, early: CP.early, best: 0, record: false, boostTap: 0, yaw: 0, pitch: 0, zoom: 0, zoomEased: 0, reach: 0 }
  // V / CAM / the wheel switch modes mid-race too: first person starts looking down the lane,
  // backing out of it starts the boom a little past its inner end (like camera.js).
  onModeChanged((mode) => {
    if (!s.racing) return
    s.pitch = 0
    if (mode === 'character' && s.reach) s.zoom = s.zoomEased = CAMERA.minDistance + 2 - s.reach
  })
  // Studs of checkpoint i this race, and what it pays before the Wins boost.
  const checkpointAt = (i) => (i < s.early.length ? s.early[i] : (i - s.early.length + 1) * s.step)
  // Past top speed x CP.paySeconds every checkpoint pays the same (payCap: those studs).
  const checkpointPay = (i) => (i < s.early.length ? 1 : Math.max(1, Math.floor((Math.min(checkpointAt(i), s.payCap) * s.step) / 1e6)))
  const showNext = () => ui.setNext(checkpointAt(s.next), Math.round(checkpointPay(s.next) * s.boost.wins))
  // The other racers are the remote players racing right now (net.js roster): on the distance bar
  // and podium, refreshed every RACERS_EVERY s whether or not this player is racing. A racer
  // without a profile picture gets a cartoon head picked from its session id.
  const RACERS_EVERY = 0.1
  let racersIn = 0
  const lookFor = (id) => {
    let h = 0
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0
    return HUD.racerLooks[Math.abs(h) % HUD.racerLooks.length]
  }
  function syncRacers(dt) {
    sendRace(s.racing, s.studs)
    if ((racersIn -= dt) > 0) return
    racersIn = RACERS_EVERY
    hud.setRacers(remoteRacers().map((r) => ({ ...r, look: lookFor(r.id) })))
  }
  const ui = createRaceHud(hud, { onLeave: () => finish() })
  hud.setBest(s.best)

  // One tap (x, y: where, for the ripple; none for keys).
  function tap(x, y) {
    s.boostTap = Math.min(RACE.tap.max, s.boostTap + RACE.tap.perTap)
    if (x !== undefined) ui.tapAt(x, y)
    engineBlip()
    sfx.tapSpray()
  }
  // Any tap or click that a HUD control did not take (they stop propagation) boosts mid-race.
  // With the cursor grabbed (pointer lock) a click is still a tap, but has no spot for the ripple.
  window.addEventListener('pointerdown', (e) => {
    if (s.racing && e.button === 0) isLocked() ? tap() : tap(e.clientX, e.clientY)
  })
  const halfLane = G.halfWidth - RACE.laneMargin

  // A crossing of the START line (the gate's plane, between the posts).
  const atGate = (p) => p.z < G.z && Math.abs(p.x) < G.halfWidth - 0.5

  function start() {
    if (s.racing) return
    closeTopWindow()
    s.racing = true
    player.racing = true
    player.facing = Math.PI
    player.velocity.x = player.velocity.y = player.velocity.z = 0
    s.t = s.studs = s.speed = s.scroll = s.next = s.earned = s.boostTap = s.yaw = s.pitch = s.zoom = s.zoomEased = 0
    inputState.jump = false // a Space held into the gate is not a tap
    inputState.look.dx = inputState.look.dy = inputState.zoom = 0 // a lobby drag / wheel must not swing the race cam
    s.boost = boosts()
    s.top = (RACE.baseSpeed + RACE.speedPerBolt * hud.getStat('wins')) * s.boost.speed
    s.step = stepFor(s.top)
    s.payCap = s.top * CP.paySeconds
    s.early = CP.early.filter((v) => v < s.step)
    s.record = false
    if (s.lastTop && s.top > s.lastTop) ui.speedUp(s.lastTop, s.top) // trained since the last race
    s.lastTop = s.top
    s.x = s.camX = clamp(player.position.x, -halfLane, halfLane)
    s.y = player.position.y
    s.z = Math.min(player.position.z, G.z)
    s.sx = window.innerWidth / 2 // until the race cam projects the boat
    s.sy = window.innerHeight * 0.55
    lobby.setLaneVisible(false)
    lane.visible = true
    scenery.start()
    ui.setRace(true)
    setRacing(true)
    sfx.raceStart()
    engineRev()
    showNext()
  }

  function finish() {
    if (!s.racing) return
    s.racing = false
    player.racing = false
    lane.visible = false
    for (const w of walls) w.visible = false
    lobby.setLaneVisible(true)
    world.setScroll(0)
    scenery.stop()
    ui.setRace(false)
    setRacing(false)
    s.boostTap = 0
    // A new personal best pays a bonus on top (straight into the counter).
    let bonus = 0
    if (s.studs > s.best) {
      bonus = Math.max(1, Math.round(s.earned * RACE.best.bonus))
      hud.setStat('trophies', hud.getStat('trophies') + bonus)
      s.best = s.studs
      hud.setBest(s.best)
    }
    ui.showResult(Math.floor(s.studs), s.earned, bonus)
    sendRace(false, 0)
    hud.setDistance(0)
    respawn()
    onEnd?.()
  }

  return {
    start,
    leave: finish,
    // The personal best is saved by the server (net.js; backend keeps the highest).
    snapshot: () => ({ bestDistance: Math.floor(s.best) }),
    hydrate(doc) {
      s.best = Number.isFinite(doc.bestDistance) && doc.bestDistance > 0 ? doc.bestDistance : 0
      hud.setBest(s.best)
    },
    isRacing: () => s.racing,
    // m the world has scrolled this race (0 when not racing): the track z of anything is its
    // drawn z minus this (presence: everyone sends and draws poses in track coordinates).
    trackScroll: () => (s.racing ? s.scroll : 0),
    atGate,
    // Runs after the physics step; returns the scroll speed (m/s) for the trail.
    update(dt) {
      syncRacers(dt)
      if (!s.racing) return 0
      s.t += dt
      const accel = (s.top / RACE.accelTime) * s.boost.acc
      s.speed = Math.min(s.top, s.speed + accel * dt)
      // Tap boost: Space / touch JUMP arrive as a jump; pointer taps through tap() below.
      if (inputState.jump) {
        inputState.jump = false
        tap()
      }
      s.boostTap *= Math.exp(-RACE.tap.decay * dt)
      const speed = s.speed * (1 + s.boostTap) // what the boat actually does
      s.studs += speed * dt

      // Forward: the boat itself until the cruise point, then the world.
      const metres = speed * RACE.metresPerStud * dt
      s.z -= metres
      let scrolled = 0
      if (s.z < RACE.cruiseZ) {
        scrolled = RACE.cruiseZ - s.z
        s.scroll += scrolled
        s.z = RACE.cruiseZ
      }
      s.x = clamp(s.x + inputState.move.x * RACE.steerSpeed * dt, -halfLane, halfLane)
      // Off the pad and onto the water.
      const yTarget = s.z < BEACH.front ? SHORE_Y : 0
      s.y += (yTarget - s.y) * (1 - Math.exp(-6 * dt))
      player.position.x = player.renderPosition.x = s.x
      player.position.y = player.renderPosition.y = s.y
      player.position.z = player.renderPosition.z = s.z
      player.facing = Math.PI

      lane.position.z = G.z + (s.scroll % (2 * L.buoySpacing))
      world.setScroll(s.scroll)
      scenery.update(dt, s.scroll, s.z)

      if (s.studs >= checkpointAt(s.next)) {
        while (s.studs >= checkpointAt(s.next)) {
          const lucky = Math.random() < s.boost.lucky // Luck: this one pays double
          const won = Math.round(checkpointPay(s.next++) * s.boost.wins * (lucky ? 2 : 1))
          s.earned += won
          ui.reward(won, s.sx, s.sy, lucky) // credits the trophies as they land in the counter
        }
        showNext()
      }
      if (!s.record && s.best > 0 && s.studs > s.best) {
        s.record = true
        ui.record()
      }
      // The last wall passed (until it is behind the camera) and the next few
      // ahead of the boat (hidden past the fog).
      walls.forEach((w, i) => {
        const k = s.next - 1 + i
        const ahead = k < 0 ? -Infinity : (checkpointAt(k) - s.studs) * RACE.metresPerStud
        w.visible = ahead > -RACE.camera.distance - 4 && ahead < FOG.far
        w.position.set(0, WATER.level, s.z - ahead)
      })

      ui.setInfo({ ms: s.t * 1000, speed, top: s.top, studs: s.studs, boost: s.boostTap })
      hud.setDistance(s.studs)
      if (s.studs >= RACE.finish) finish()
      return dt > 0 ? scrolled / dt : 0
    },
    // Boat speed in m/s (engine flames, tilt).
    boatSpeed: () => s.speed * (1 + s.boostTap) * RACE.metresPerStud,
    // Top speed this race in m/s (engine sound).
    topSpeed: () => s.top * RACE.metresPerStud,
    // 0..RACE.tap.max: the tap boost right now (engine flames).
    tapBoost: () => s.boostTap,
    // Chase cam: behind the boat and above it, looking down the lane. Dragging
    // (mouse, or the touch look zone) swings it around the boat; the framing
    // turns with it, so at yaw = pitch = 0 it is the plain chase shot. The wheel /
    // pinch zooms the boom (CAMERA.minDistance..maxDistance, like camera.js) and
    // crosses into first person at its inner end; V / CAM toggle first person too.
    camera(camera, dt) {
      const C = camera.aspect < 1 || window.innerHeight < RACE.camera.compactHeight ? COMPACT_CAM : RACE.camera
      s.camX += (s.x - s.camX) * (1 - Math.exp(-C.follow * dt))
      const k = CAMERA.lookSensitivity * getCameraSensitivity()
      s.yaw -= inputState.look.dx * k
      s.pitch += inputState.look.dy * k
      inputState.look.dx = inputState.look.dy = 0
      // Boom from a pivot above the boat: the chase offset in polar form, plus the drag.
      const py = s.y + ORBIT.pivot
      const up = C.height - ORBIT.pivot
      s.reach = Math.hypot(up, C.distance)
      const fp = isFirstPerson()
      if (inputState.zoom !== 0) {
        if (fp) {
          if (inputState.zoom > 0) setMode('character')
        } else {
          const next = s.reach + s.zoom + inputState.zoom * CAMERA.zoomStep
          if (next < CAMERA.minDistance && inputState.zoom < 0) setMode('player')
          else s.zoom = clamp(next, CAMERA.minDistance, CAMERA.maxDistance) - s.reach
        }
        inputState.zoom = 0
      }
      if (isFirstPerson()) {
        // The rider's eyes, steady on the boat (no follow lag: it reads as input delay).
        s.pitch = clamp(s.pitch, -CAMERA.firstPersonPitch, CAMERA.firstPersonPitch)
        const eyeY = s.y + player.dims.height * CAMERA.eyeHeight
        const cp = Math.cos(s.pitch)
        camera.position.set(s.x, eyeY, s.z)
        camera.lookAt(s.x - Math.sin(s.yaw) * cp, eyeY - Math.sin(s.pitch), s.z - Math.cos(s.yaw) * cp)
      } else {
        s.zoomEased += (s.zoom - s.zoomEased) * (1 - Math.exp(-CAMERA.zoomEase * dt))
        const reach = Math.max(1, s.reach + s.zoomEased)
        const base = Math.atan2(up, C.distance)
        s.pitch = clamp(s.pitch, ORBIT.minPitch - base, ORBIT.maxPitch - base)
        const pitch = base + s.pitch
        const sin = Math.sin(s.yaw)
        const cos = Math.cos(s.yaw)
        const flat = Math.cos(pitch) * reach
        camera.position.set(s.camX + sin * flat, py + Math.sin(pitch) * reach, s.z + cos * flat)
        camera.lookAt(s.camX - sin * C.lookAhead, s.y + C.lookHeight, s.z - cos * C.lookAhead)
      }
      camera.updateMatrixWorld()
      screenPos.set(s.x, s.y + 1, s.z).project(camera)
      s.sx = ((screenPos.x + 1) / 2) * window.innerWidth
      s.sy = ((1 - screenPos.y) / 2) * window.innerHeight
      const fov = C.fov + C.speedFov * clamp((s.speed * RACE.metresPerStud) / 50, 0, 1)
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov
        camera.updateProjectionMatrix()
      }
    },
  }
}
