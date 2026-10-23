import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  Shape,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector2,
} from 'three'
import { LOBBY, SPAWN, WATER } from './config.js'
import { makeEngine } from './boat.js'
import { paintChecker, paintChevrons, paintFade, paintSoftDot } from './textures.js'
import { fontReady, glow, label, neon, put, solidBox, solidPole, std } from './propkit.js'
import { createEmitter } from './particles.js'

// Everything standing on the lobby beach, laid out like the reference shot
// from the spawn looking toward the sea (-Z):
//  - the START gate at the shoreline: two black posts, a black banner, a
//    glowing yellow start pad with a light curtain, and red/yellow buoy ropes
//    marking the lane out to sea; three red arrows bob above it
//  - red chevron barriers on both sides, a checkered pink walkway with a
//    neon yellow rim inland of the right one, with four hero statues on it in
//    front of the taller wall (name + stat tags, coloured auras and sparkles)
//  - on the left: the Engine Upgrade machine (caged, flaming, smoking, a
//    glowing gold ring, a parked log raft), two engine rockets hovering over
//    glowing pads with sparkles
// The palms and the striped umbrella are scenery, built per world (environment.js).
// Solid props get fixed colliders so the boat cannot drive through them.
const G = LOBBY.gate
const C = LOBBY.colors

// --- Start gate -------------------------------------------------------------------
function bannerTexture() {
  const c = document.createElement('canvas')
  c.width = 1460
  c.height = 200
  const draw = () => {
    const ctx = c.getContext('2d')
    ctx.fillStyle = C.banner
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.fillStyle = '#ffffff'
    ctx.font = '700 168px Fredoka, "Arial Black", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.letterSpacing = '18px'
    ctx.fillText('START', c.width / 2, c.height / 2 + 8)
  }
  draw()
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  fontReady.then(() => {
    draw()
    tex.needsUpdate = true
  })
  return tex
}

function arrowGeometry() {
  const s = new Shape()
  s.moveTo(-0.42, 1.6)
  s.lineTo(0.42, 1.6)
  s.lineTo(0.42, 0.2)
  s.lineTo(1.05, 0.2)
  s.lineTo(0, -1.2)
  s.lineTo(-1.05, 0.2)
  s.lineTo(-0.42, 0.2)
  s.closePath()
  const geo = new ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 })
  geo.translate(0, 0, -0.175)
  return geo
}

function buildGate(root, animated) {
  const hw = G.halfWidth
  const gate = new Group()
  gate.position.z = G.z
  root.add(gate)

  const black = std('#15161c', { roughness: 0.4 })
  const post = new CylinderGeometry(0.5, 0.6, G.postHeight, 18)
  const ball = new SphereGeometry(1.0, 20, 12)
  for (const side of [-1, 1]) {
    put(gate, post, black, side * hw, G.postHeight / 2, 0)
    put(gate, ball, black, side * hw, G.postHeight + 0.7, 0)
    solidPole(0.7, G.postHeight, side * hw, G.z)
  }

  // Banner: START on both faces, dark ends, a blue trim along the bottom and sides.
  const face = std('#ffffff', { map: bannerTexture(), roughness: 0.5 })
  const dark = std(C.banner)
  const bw = hw * 2 - 0.4
  put(gate, new BoxGeometry(bw, G.bannerHeight, 0.6), [dark, dark, dark, dark, face, face], 0, G.bannerY, 0)
  const trimMat = std(C.bannerFrame, { emissive: C.bannerFrame, emissiveIntensity: 0.35 })
  put(gate, new BoxGeometry(bw + 0.2, 0.36, 0.8), trimMat, 0, G.bannerY - G.bannerHeight / 2 - 0.12, 0)
  put(gate, new BoxGeometry(bw + 0.2, 0.26, 0.8), trimMat, 0, G.bannerY + G.bannerHeight / 2 + 0.08, 0)
  for (const side of [-1, 1]) put(gate, new BoxGeometry(0.3, G.bannerHeight, 0.8), trimMat, side * (bw / 2), G.bannerY, 0)

  // Glowing start pad, its rim, and a light curtain rising from it.
  const padMat = std(C.pad, { emissive: C.pad, emissiveIntensity: 0.9, roughness: 0.4 })
  put(gate, new BoxGeometry(hw * 2 + 2, 0.2, G.padDepth), padMat, 0, 0.1, 0, false).receiveShadow = true
  put(gate, new BoxGeometry(hw * 2 + 2.6, 0.14, 0.5), std('#ff9d1a', { emissive: '#ff8a00', emissiveIntensity: 0.6 }), 0, 0.08, G.padDepth / 2 + 0.2, false)
  const fade = new CanvasTexture(paintFade('#fff6c0'))
  fade.colorSpace = SRGBColorSpace
  const curtainMat = new MeshBasicMaterial({ map: fade, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false })
  put(gate, new PlaneGeometry(hw * 2 + 1.5, 6), curtainMat, 0, 3.1, 0, false)
  animated.push((t) => (curtainMat.opacity = 0.7 + Math.sin(t * 3) * 0.15))

  // Three red arrows pointing down at the gate.
  const arrowMat = std(C.arrow, { emissive: '#7a0000', emissiveIntensity: 0.35, roughness: 0.45 })
  const ag = arrowGeometry()
  const arrows = [-1, 0, 1].map((i) => {
    const a = put(gate, ag, arrowMat, i * G.arrowSpacing, G.arrowY, 0)
    a.rotation.z = -i * 0.42
    a.scale.setScalar(G.arrowScale)
    return a
  })
  animated.push((t) => {
    arrows.forEach((a, i) => (a.position.y = G.arrowY + Math.sin(t * 3.2 + i * 0.6) * 0.8))
  })

  // Buoy ropes out to sea from each post (hidden while racing: race.js draws a longer, scrolling lane).
  const lane = new Group()
  gate.add(lane)
  const L = LOBBY.lane
  const count = Math.floor(L.length / L.buoySpacing)
  const buoys = new InstancedMesh(new SphereGeometry(0.55, 14, 10), std('#ffffff', { roughness: 0.35 }), count * 2)
  const m = new Matrix4()
  const red = new Color(C.buoyA)
  const yellow = new Color(C.buoyB)
  let n = 0
  for (const side of [-1, 1]) {
    for (let i = 0; i < count; i++) {
      m.makeScale(1, 0.8, 1).setPosition(side * hw, WATER.level + 0.18, -G.padDepth / 2 - 2 - i * L.buoySpacing)
      buoys.setMatrixAt(n, m)
      buoys.setColorAt(n++, i % 2 ? yellow : red)
    }
    const rope = put(lane, new CylinderGeometry(0.06, 0.06, L.length, 6), std('#f5f5f5'), side * hw, WATER.level + 0.25, -G.padDepth / 2 - 2 - L.length / 2, false)
    rope.rotation.x = Math.PI / 2
  }
  buoys.castShadow = true
  lane.add(buoys)
  return lane
}

// --- Barriers, walkway and statues on the shoreline wings --------------------------
// A barrier line from its gate end `from` to `to`, as unit vectors: `u` points
// back toward the gate, `n` points inland (toward the spawn). `at(t, off)` is
// the point t metres from the gate end, `off` metres inland.
function barrierLine({ from, to }) {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1])
  const ux = (from[0] - to[0]) / len
  const uz = (from[1] - to[1]) / len
  let nx = -uz
  let nz = ux
  if ((SPAWN.x - from[0]) * nx + (SPAWN.z - from[1]) * nz < 0) {
    nx = -nx
    nz = -nz
  }
  const at = (t, off = 0) => ({ x: from[0] - ux * t + nx * off, z: from[1] - uz * t + nz * off })
  return { len, ux, uz, nx, nz, at, yaw: Math.atan2(-uz, ux) }
}

// A box laid along part of a barrier line, `off` metres inland of it (negative = behind it).
function alongLine(root, line, t0, t1, off, size, y, mat) {
  const a = line.at(t0, off)
  const b = line.at(t1, off)
  const len = t1 - t0
  const m = put(root, new BoxGeometry(len, size[0], size[1]), mat, (a.x + b.x) / 2, y, (a.z + b.z) / 2)
  m.rotation.y = line.yaw
  solidBox(len / 2, size[0] / 2, size[1] / 2, m.position.x, y, m.position.z, line.yaw)
  return m
}

function buildBarriers(root) {
  const B = LOBBY.barrier
  const chevrons = paintChevrons(C.barrier)
  const cap = std('#ffffff', { roughness: 0.5 })
  const plain = std(C.barrier, { roughness: 0.55 })
  for (const spec of B.lines) {
    if (spec.wall === 0) continue
    const line = barrierLine(spec)
    const len = spec.wall ?? line.len // metres of chevron wall from the gate end
    const height = spec.height ?? B.height
    // Local +X runs toward the gate so the chevrons point at it. If local +Z
    // faces the sea, the wall is turned round and the texture mirrored.
    const facesInland = -line.uz * line.nx + line.ux * line.nz > 0
    const tex = new CanvasTexture(chevrons)
    tex.colorSpace = SRGBColorSpace
    tex.wrapS = RepeatWrapping
    tex.repeat.set((facesInland ? 1 : -1) * Math.round(len / (height * 2)), 1)
    const face = std('#ffffff', { map: tex, roughness: 0.55 })
    const wall = alongLine(root, line, 0, len, 0, [height, 0.45], height / 2, [plain, plain, plain, plain, face, face])
    if (!facesInland) wall.rotation.y += Math.PI
    const top = put(root, new BoxGeometry(len, 0.14, 0.62), cap, wall.position.x, height + 0.07, wall.position.z)
    top.rotation.y = line.yaw
  }

  // Raised checkered pink walkways (red sides, neon yellow rim on both long
  // edges) inland of the flagged lines.
  const W = LOBBY.walkway
  const side = std(C.barrier, { roughness: 0.6 })
  const rim = neon('#ffc21a', 2.2)
  for (const spec of B.lines) {
    const line = barrierLine(spec)
    if (!spec.walkway) continue
    const len = line.len - 2
    const checks = new CanvasTexture(paintChecker(C.walkway, C.walkwayLight))
    checks.colorSpace = SRGBColorSpace
    checks.wrapS = checks.wrapT = RepeatWrapping
    checks.repeat.set(len / W.check, W.width / W.check)
    const top = std('#ffffff', { map: checks, roughness: 0.7 })
    alongLine(root, line, 1, line.len - 1, 0.25 + W.width / 2, [W.height, W.width], W.height / 2, [side, side, top, side, side, side])
    for (const off of [0.3, 0.25 + W.width - 0.05]) alongLine(root, line, 1, line.len - 1, off, [0.1, 0.18], W.height + 0.04, rim)
  }
}

// Blocky hero statue (~2.3 m), front +Z.
function makeStatue(look) {
  const g = new Group()
  const skin = std(look.skin ?? '#f2c79a')
  const legGeo = new BoxGeometry(0.44, 0.95, 0.46)
  const armGeo = new BoxGeometry(0.4, 0.95, 0.42)
  put(g, legGeo, std(look.legL ?? look.legs), -0.24, 0.475, 0)
  put(g, legGeo, std(look.legR ?? look.legs), 0.24, 0.475, 0)
  put(g, new BoxGeometry(0.96, 0.98, 0.5), std(look.torso), 0, 1.44, 0)
  const armL = put(g, armGeo, std(look.armL ?? look.arms), -0.7, 1.44, 0)
  const armR = put(g, armGeo, std(look.armR ?? look.arms), 0.7, 1.44, 0)
  put(g, new CylinderGeometry(0.34, 0.34, 0.62, 18), look.mask ? std(look.mask) : skin, 0, 2.25, 0)
  look.extra?.(g, { armL, armR })
  return g
}

const STATUES = [
  {
    name: 'HARLEY QUINN',
    partner: 'jester', // the PARTNER it sells (interact.js)
    color: '#ff4fd8',
    stat: '40',
    aura: '#ff6ad8',
    torso: '#d8263a',
    arms: '#16161e',
    armR: '#d8263a',
    legL: '#16161e',
    legR: '#d8263a',
    skin: '#f7f1ec',
    extra(g) {
      put(g, new BoxGeometry(0.72, 0.18, 0.72), std('#f4e27a'), 0, 2.62, 0)
      put(g, new BoxGeometry(0.16, 0.5, 0.16), std('#e8263a'), -0.42, 2.35, 0)
      put(g, new BoxGeometry(0.16, 0.5, 0.16), std('#2a5cff'), 0.42, 2.35, 0)
    },
  },
  {
    name: 'CAPTAIN AMERICA',
    partner: 'superhero', // the PARTNER it sells (interact.js)
    color: '#ff3b3b',
    stat: '4999',
    aura: '#ffd84a',
    torso: '#2a4fb0',
    arms: '#2a4fb0',
    legs: '#2a4fb0',
    mask: '#2a4fb0',
    extra(g) {
      put(g, new BoxGeometry(0.98, 0.14, 0.52), std('#e8263a'), 0, 1.1, 0)
      put(g, new BoxGeometry(0.2, 0.2, 0.05), std('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.2 }), 0, 1.6, 0.27)
      // Shield on the left arm.
      const shield = new Group()
      shield.position.set(-0.98, 1.4, 0.15)
      shield.rotation.set(Math.PI / 2, 0, Math.PI / 2)
      ;[['#e8263a', 0.5], ['#f4f4f4', 0.38], ['#e8263a', 0.27], ['#2a4fb0', 0.16]].forEach(([c, r], i) => put(shield, new CylinderGeometry(r, r, 0.06, 24), std(c), 0, i * 0.012, 0))
      g.add(shield)
    },
  },
  {
    name: 'HACKER',
    partner: 'hacker', // the PARTNER it sells (interact.js)
    color: '#ff3b3b',
    stat: '1999',
    aura: '#3dff6a',
    torso: '#15161c',
    arms: '#2bd14a',
    legs: '#15161c',
    mask: '#15161c',
    extra(g) {
      const eye = std('#3dff6a', { emissive: '#3dff6a', emissiveIntensity: 1.2 })
      put(g, new BoxGeometry(0.12, 0.08, 0.04), eye, -0.13, 2.3, 0.33)
      put(g, new BoxGeometry(0.12, 0.08, 0.04), eye, 0.13, 2.3, 0.33)
      put(g, new BoxGeometry(0.8, 0.5, 0.06), std('#2bd14a', { emissive: '#1a8a2e', emissiveIntensity: 0.4 }), 0, 1.5, 0.26)
    },
  },
  {
    name: 'BATMAN',
    partner: 'batman', // the PARTNER it sells (interact.js)
    color: '#ff3b3b',
    stat: '699',
    aura: '#8a7bff',
    torso: '#20222e',
    arms: '#20222e',
    legs: '#20222e',
    mask: '#20222e',
    skin: '#20222e',
    extra(g) {
      put(g, new BoxGeometry(1.0, 0.12, 0.54), std('#f2c21a'), 0, 1.0, 0)
      const ear = new ConeGeometry(0.09, 0.3, 4)
      put(g, ear, std('#20222e'), -0.2, 2.7, 0)
      put(g, ear, std('#20222e'), 0.2, 2.7, 0)
      const cape = put(g, new BoxGeometry(1.2, 1.9, 0.06), std('#111219', { side: DoubleSide }), 0, 1.05, -0.32)
      cape.rotation.x = 0.12
    },
  },
]

// The statues stand on the pink walkway in front of the (taller) statue wall.
// Each one's spot (above its head) goes into `spots` for its interact prompt.
function buildStatues(root, spots) {
  const S = LOBBY.statues
  const W = LOBBY.walkway
  const right = barrierLine(LOBBY.barrier.lines.find((l) => l.statues))
  const auraTex = new CanvasTexture(paintSoftDot(128))
  auraTex.colorSpace = SRGBColorSpace
  const auraBoxes = []
  const sparkleBoxes = []
  STATUES.forEach((look, i) => {
    const p = right.at(S.at[i], 0.25 + W.width * 0.4)
    const statue = makeStatue(look)
    statue.scale.setScalar(S.scale)
    statue.position.set(p.x, W.height, p.z)
    statue.rotation.y = Math.atan2(SPAWN.x - p.x, SPAWN.z - p.z)
    root.add(statue)
    const tag = label(`${look.name}\n⊕ ${look.stat}`, 0.85, { colors: [look.color, '#7dff6a'], outline: '#1a0a14', font: '700 64px Fredoka, sans-serif', outlineWidth: 10 })
    tag.position.set(p.x, W.height + 3.4 * S.scale, p.z)
    root.add(tag)
    spots.push({ partner: look.partner, x: p.x, y: W.height + 2.7 * S.scale, z: p.z })
    solidBox(0.6 * S.scale, 1.2 * S.scale, 0.4 * S.scale, p.x, W.height + 1.2 * S.scale, p.z, statue.rotation.y)
    // A soft pool of the statue's aura colour on the walkway under it.
    const pool = new Sprite(new SpriteMaterial({ map: auraTex, color: look.aura, transparent: true, opacity: 0.5, blending: AdditiveBlending, depthWrite: false }))
    pool.scale.set(2.4 * S.scale, 2.4 * S.scale, 1)
    pool.position.set(p.x, W.height + 1.0 * S.scale, p.z)
    root.add(pool)
    auraBoxes.push({ x: p.x, y: W.height + 0.3, z: p.z, sx: 0.6, sy: 0.2, sz: 0.6, color: look.aura })
    sparkleBoxes.push({ x: p.x, y: W.height + 1.3 * S.scale, z: p.z, sx: 0.8, sy: 1.2, sz: 0.8, color: look.aura })
  })
  // Each statue glows in its colour: wisps rising off it and sparkles around it.
  createEmitter(root, {
    boxes: auraBoxes, count: 120, life: 1.6, velocity: [0, 1.3, 0], spread: [0.35, 0.4, 0.35],
    size: 0.55, grow: 0.3, intensity: 2.6, opacity: 0.7, seed: 61,
  })
  createEmitter(root, {
    boxes: sparkleBoxes, count: 48, life: 2.2, velocity: [0, 0.5, 0], spread: [0.25, 0.25, 0.25],
    size: 0.38, intensity: 3, twinkle: 7, sprite: 'sparkle', seed: 62,
  })
}

// --- Rockets on glowing pads ----------------------------------------------------------
function makeRocket({ body, nose, fin, stripe }) {
  const g = new Group()
  const v = (pts) => pts.map(([r, y]) => new Vector2(r, y))
  put(g, new LatheGeometry(v([[0, 0], [0.36, 0.04], [0.5, 0.42], [0.55, 1.25], [0.5, 2.1]]), 28), std(body, { roughness: 0.35 }))
  put(g, new LatheGeometry(v([[0.5, 2.1], [0.4, 2.6], [0.22, 3.0], [0, 3.25]]), 28), std(nose, { roughness: 0.35 }))
  put(g, new CylinderGeometry(0.555, 0.555, 0.14, 28), std(stripe), 0, 0.95, 0)
  put(g, new CylinderGeometry(0.3, 0.4, 0.3, 20, 1, true), std('#30343c', { metalness: 0.6, roughness: 0.3, side: DoubleSide }), 0, -0.1, 0)
  // Porthole.
  const port = put(g, new TorusGeometry(0.17, 0.05, 8, 20), std('#d8dde8', { metalness: 0.5, roughness: 0.3 }), 0, 1.6, 0.53)
  port.rotation.x = -0.08
  put(g, new SphereGeometry(0.16, 16, 8), std('#3aa0ff', { emissive: '#1a5cff', emissiveIntensity: 0.5, roughness: 0.15 }), 0, 1.6, 0.47).scale.z = 0.5
  // Four fins.
  const s = new Shape()
  s.moveTo(0.4, 1.0)
  s.lineTo(1.02, 0.1)
  s.lineTo(1.0, -0.35)
  s.lineTo(0.45, 0.05)
  s.closePath()
  const finGeo = new ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: false })
  finGeo.translate(0, 0, -0.04)
  const finMat = std(fin, { roughness: 0.4 })
  for (let i = 0; i < 4; i++) {
    const f = put(g, finGeo, finMat)
    f.rotation.y = (i * Math.PI) / 2 + Math.PI / 4
  }
  // Little exhaust flame.
  const flame = put(g, new ConeGeometry(0.26, 0.9, 14, 1, true), glow('#ffb347'), 0, -0.7, 0, false)
  flame.rotation.x = Math.PI
  return { group: g, flame }
}

function buildRocketPad(root, animated, spots, { x, z, name, engine, label: labelColor, ...look }) {
  const s = LOBBY.rocketScale
  const base = new Group()
  base.position.set(x, 0, z)
  base.scale.setScalar(s)
  root.add(base)
  put(base, new CylinderGeometry(1.7, 1.85, 0.3, 32), std('#1f7bff', { emissive: '#0a4cff', emissiveIntensity: 0.55, roughness: 0.35 }), 0, 0.15, 0)
  const ring = put(base, new TorusGeometry(1.45, 0.09, 8, 40), neon('#4fe0ff'), 0, 0.31, 0, false)
  ring.rotation.x = Math.PI / 2
  const fade = new CanvasTexture(paintFade('#6fd8ff'))
  fade.colorSpace = SRGBColorSpace
  const beamMat = new MeshBasicMaterial({ map: fade, transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false })
  put(base, new CylinderGeometry(1.45, 1.45, 2.4, 32, 1, true), beamMat, 0, 1.5, 0, false)
  solidPole(1.8 * s, 1.2 * s, x, z)
  // Blue sparkles drifting up through the beam.
  createEmitter(root, {
    boxes: [{ x, y: 1.4 * s, z, sx: 1.4 * s, sy: 1.0 * s, sz: 1.4 * s }],
    count: 30, life: 2.4, velocity: [0, 0.9, 0], spread: [0.2, 0.3, 0.2],
    size: 0.45, color: '#8fe8ff', intensity: 3, twinkle: 6, sprite: 'sparkle', seed: Math.round(Math.abs(x) * 10),
  })

  const rocket = makeRocket(look)
  rocket.group.scale.setScalar(0.95)
  base.add(rocket.group)
  const tag = label(name, 0.42, { color: labelColor, outline: '#1a0a14', font: '700 64px Fredoka, sans-serif', outlineWidth: 10 })
  tag.position.y = 4.6
  base.add(tag)
  spots.push({ engine, x, y: 4.2 * s, z })
  const phase = x * 0.3
  animated.push((t) => {
    rocket.group.position.y = 1.0 + Math.sin(t * 1.8 + phase) * 0.18
    rocket.group.rotation.y = t * 0.6 + phase
    rocket.flame.scale.y = 0.8 + Math.abs(Math.sin(t * 27 + phase)) * 0.4
    beamMat.opacity = 0.45 + Math.sin(t * 2.4 + phase) * 0.12
  })
}

// --- Engine Upgrade machine -------------------------------------------------------------
function buildUpgrade(root, animated, spots) {
  const { x, z, scale: s } = LOBBY.upgrade
  const g = new Group()
  g.position.set(x, 0, z)
  g.scale.setScalar(s)
  root.add(g)
  const red = std('#d81f26', { roughness: 0.4 })
  const darkRed = std('#8e1015', { roughness: 0.5 })
  const metal = std('#3a3f48', { metalness: 0.6, roughness: 0.35 })

  // Gold ring on the sand.
  const ring = put(g, new TorusGeometry(2.6, 0.13, 10, 48), neon('#ffd21a'), 0, 0.08, 0, false)
  ring.rotation.x = Math.PI / 2
  put(g, new CylinderGeometry(1.6, 1.7, 0.4, 28), darkRed, 0, 0.2, 0)
  // Machine body: a red cabinet with a grille and a big engine drum on top.
  put(g, new BoxGeometry(1.9, 1.7, 1.6), red, 0, 1.25, 0)
  for (let i = 0; i < 4; i++) put(g, new BoxGeometry(1.3, 0.08, 0.05), metal, 0, 0.75 + i * 0.28, 0.82)
  const drum = put(g, new CylinderGeometry(0.75, 0.75, 1.5, 24), red, 0, 2.55, 0)
  drum.rotation.z = Math.PI / 2
  for (const dx of [-0.5, 0, 0.5]) {
    const band = put(g, new CylinderGeometry(0.78, 0.78, 0.1, 24), metal, dx, 2.55, 0)
    band.rotation.z = Math.PI / 2
  }
  put(g, new CylinderGeometry(0.28, 0.36, 0.6, 16), metal, 0, 3.45, 0)
  // Flames out of the top.
  const flames = []
  ;[['#ff3b12', 0.42, 1.6], ['#ff9a1a', 0.3, 1.2], ['#fff1a0', 0.16, 0.8]].forEach(([c, r, h]) => {
    const geo = new ConeGeometry(r, h, 14, 1, true)
    geo.translate(0, h / 2, 0)
    flames.push(put(g, geo, glow(c, 0.9), 0, 3.7, 0, false))
  })
  animated.push((t) => {
    flames.forEach((f, i) => {
      f.scale.y = 0.8 + Math.abs(Math.sin(t * (14 + i * 5) + i)) * 0.45
      f.scale.x = f.scale.z = 0.9 + Math.sin(t * 19 + i * 2) * 0.1
    })
  })
  // Cage of dark bars around it.
  const bar = std('#2a2d35', { metalness: 0.4, roughness: 0.4 })
  const half = 1.45
  const H = 3.6
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, new CylinderGeometry(0.06, 0.06, H, 8), bar, sx * half, H / 2 + 0.4, sz * half)
  for (const y of [1.4, 2.6, H + 0.4]) {
    for (const s of [-1, 1]) {
      put(g, new BoxGeometry(half * 2, 0.08, 0.08), bar, 0, y, s * half)
      put(g, new BoxGeometry(0.08, 0.08, half * 2), bar, s * half, y, 0)
    }
  }
  solidBox(1.6 * s, 2 * s, 1.6 * s, x, 2 * s, z)
  // Smoke curling up off the flames.
  createEmitter(root, {
    boxes: [{ x, y: 4.4 * s, z, sx: 0.3 * s, sy: 0.2 * s, sz: 0.3 * s }],
    count: 45, life: 3, velocity: [0, 1.6, 0], spread: [0.5, 0.4, 0.5], gravity: -0.15,
    size: 1.1, grow: 3.2, color: '#ffe2dc', intensity: 0.9, opacity: 0.28, seed: 31,
  })
  // Embers flicking out of the fire.
  createEmitter(root, {
    boxes: [{ x, y: 4.0 * s, z, sx: 0.4 * s, sy: 0.3 * s, sz: 0.4 * s }],
    count: 30, life: 1.4, velocity: [0, 3, 0], spread: [1.2, 1, 1.2], gravity: 2.5,
    size: 0.16, color: '#ffb347', intensity: 4, twinkle: 9, seed: 32,
  })

  const tag = label('Engine Upgrade', 1.3, { color: '#3ff0ff', outline: '#0b2a55', outlineWidth: 16 })
  tag.position.set(0, 5.6, 0)
  g.add(tag)
  spots.push({ x, y: 4.6 * s, z })

  // A log raft parked beside the machine, waiting for its upgrade.
  const raft = new Group()
  raft.position.set(x + 3.5 * s, 0, z - 0.6 * s)
  raft.rotation.y = -0.35
  root.add(raft)
  const log = new CylinderGeometry(0.19, 0.19, 2.6, 12)
  log.rotateX(Math.PI / 2)
  const wood = [std('#b07a45', { roughness: 0.85 }), std('#9a6538', { roughness: 0.85 })]
  for (let i = 0; i < 5; i++) put(raft, log, wood[i % 2], (i - 2) * 0.38, 0.2, 0)
  for (const side of [-1, 1]) {
    const e = makeEngine()
    e.group.position.set(side * 1.25, 0.32, -0.3)
    raft.add(e.group)
    e.flame.visible = false
  }
  put(raft, new BoxGeometry(2.9, 0.1, 0.2), metal, 0, 0.36, -0.3)
  solidBox(1.3, 0.5, 1.3, raft.position.x, 0.5, raft.position.z, raft.rotation.y)
}

export function createLobby(scene) {
  const root = new Group()
  root.name = 'lobby'
  scene.add(root)
  const animated = [] // fn(elapsed) per animated prop

  const lane = buildGate(root, animated)
  buildBarriers(root)
  // Where each shop object's interact prompt sits (interact.js).
  const spots = { statues: [], upgrade: [], rockets: [] }
  buildStatues(root, spots.statues)
  buildUpgrade(root, animated, spots.upgrade)
  for (const r of LOBBY.rockets) buildRocketPad(root, animated, spots.rockets, r)

  return {
    spots,
    setLaneVisible: (on) => (lane.visible = on),
    update(dt, elapsed) {
      for (const fn of animated) fn(elapsed)
    },
  }
}
