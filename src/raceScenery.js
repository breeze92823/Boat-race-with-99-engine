import { Box3, BoxGeometry, Color, ConeGeometry, CylinderGeometry, DodecahedronGeometry, Euler, Float32BufferAttribute, Group, Matrix4, Mesh, Quaternion, SphereGeometry, TorusGeometry, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BOAT, LOBBY, PLAZA, RACE, WATER } from './config.js'
import { buildCliff, buildPalm, glow, neon, std } from './propkit.js'
import { makeHill } from './world.js'
import { buildBoat } from './boatModels.js'
import { mulberry32 } from './textures.js'
import { bake } from './bake.js'

// What the player races past. The sea is only WATER.size wide and a race
// scrolls the world past a boat parked at RACE.cruiseZ (race.js), so the
// scenery lives in "track" z (where it would be with no scroll) and is drawn at
// track z + scroll. Set pieces (palm islands, sea stacks, anchored ships, a
// lighthouse, hot-air balloons, a giant rubber duck, leaping dolphins) are
// built once, merged down to a few draw calls each (bake) and recycled: one
// is placed every RACE.scenery.gap m alternating sides, appears inside the fog
// ahead and goes back to its pool once well behind the boat. A rock or rainbow
// arch spans the lane every archEvery m. The start island (`home`: the beach,
// lobby, plaza, shops) slides away with the same scroll and is hidden once it
// has gone into the fog, so it never trails the boat.
const S = RACE.scenery
const HALF = LOBBY.gate.halfWidth

// Colours each triangle of a non-indexed geometry by its centroid: crisp stripes.
function paintFaces(geo, colorAt) {
  const pos = geo.attributes.position
  const col = new Float32Array(pos.count * 3)
  const c = new Color()
  for (let i = 0; i < pos.count; i += 3) {
    const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3
    const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3
    const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3
    colorAt(x, y, z, c)
    for (let k = 0; k < 3; k++) c.toArray(col, (i + k) * 3)
  }
  geo.setAttribute('color', new Float32BufferAttribute(col, 3))
  return geo
}

const vc = (extra) => std('#ffffff', { vertexColors: true, ...extra })
const part = (geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
  const m = new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(new Euler(rx, ry, rz)), new Vector3(sx, sy, sz))
  const g = (geo.index ? geo.toNonIndexed() : geo).applyMatrix4(m)
  for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal') g.deleteAttribute(n)
  return g
}
const UP = new Vector3(0, 1, 0)
// A thin rod between two points (balloon ropes).
function rod(a, b, r) {
  const d = b.clone().sub(a)
  const g = new CylinderGeometry(r, r, d.length(), 5).toNonIndexed()
  g.applyQuaternion(new Quaternion().setFromUnitVectors(UP, d.normalize()))
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
  g.deleteAttribute('uv')
  return g
}

// --- Set pieces ------------------------------------------------------------------------------
// Each returns { root, update?(t) }; roots are built at the origin, facing -Z.
const SEA = WATER.level - 1 // makeHill / cliff foot height

// Palm island: a grassy mound in a sand rim, palms; variant 1 has a hut, 2 shore rocks.
function island(variant, seed) {
  const rand = mulberry32(seed)
  const [rx, ry, rz] = [[26, 6, 18], [34, 8, 22], [20, 5, 15]][variant]
  const g = new Group()
  g.add(...makeHill(0, 0, rx, ry, rz, ['#4dbb3c', '#45ad37', '#58c445'][variant], seed))
  const surface = (x, z) => SEA + ry * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2 - (z / rz) ** 2)) - 0.3
  const palms = [3, 4, 2][variant]
  for (let i = 0; i < palms; i++) {
    const a = (i / palms) * Math.PI * 2 + rand()
    const x = Math.cos(a) * rx * (0.15 + rand() * 0.3)
    const z = Math.sin(a) * rz * (0.15 + rand() * 0.3)
    buildPalm(g, x, z, 9 + rand() * 6, (rand() - 0.5) * 0.6, (rand() - 0.5) * 0.6, seed * 10 + i, surface(x, z))
  }
  if (variant === 1) {
    const y = surface(rx * 0.35, -rz * 0.2)
    const hut = new Mesh(new BoxGeometry(5, 3.4, 4.2), std('#c98a4a', { roughness: 0.9 }))
    hut.position.set(rx * 0.35, y + 1.6, -rz * 0.2)
    const roof = new Mesh(new ConeGeometry(4.3, 3.2, 4), std('#e8c25a', { roughness: 1 }))
    roof.position.set(rx * 0.35, y + 4.9, -rz * 0.2)
    roof.rotation.y = Math.PI / 4
    g.add(hut, roof)
  }
  if (variant === 2) {
    const rockMat = std(PLAZA.rock, { flatShading: true, roughness: 0.95 })
    for (let i = 0; i < 4; i++) {
      const a = rand() * Math.PI * 2
      const r = new Mesh(new DodecahedronGeometry(1.6 + rand() * 1.6), rockMat)
      r.position.set(Math.cos(a) * rx * 1.05, WATER.level, Math.sin(a) * rz * 1.05)
      r.rotation.set(rand() * 3, rand() * 3, 0)
      g.add(r)
    }
  }
  return { root: bake(g) }
}

// Sea stacks: grass-capped rock towers with palms on top (variant 0 tall, 1 a wide pair).
function stack(variant, seed) {
  const rand = mulberry32(seed)
  const g = new Group()
  const top = (h) => SEA + h + 0.6
  if (variant === 0) {
    buildCliff(g, [0, 0, 10, 9, 26, rand() * 3], seed, SEA, false)
    buildPalm(g, 0.5, 0.5, 8, 0.2, -0.1, seed * 10, top(26))
  } else {
    buildCliff(g, [0, 0, 26, 16, 14, 0.2], seed, SEA, false)
    buildCliff(g, [15, 9, 10, 9, 8, 0.7], seed + 1, SEA, false)
    buildPalm(g, -6, 2, 10, -0.2, 0.1, seed * 10, top(14))
    buildPalm(g, 5, -3, 8, 0.3, 0, seed * 10 + 1, top(14))
  }
  return { root: bake(g) }
}

// Lighthouse on a rock: red and white bands, glowing lamp room, two sweeping beams.
function lighthouse(seed) {
  const g = new Group()
  buildCliff(g, [0, 0, 14, 12, 6, 0.4], seed, SEA, false)
  const base = SEA + 6.6
  const bands = 6
  const H = 21
  for (let i = 0; i < bands; i++) {
    const r0 = 2.9 - (i / bands) * 1.0
    const r1 = 2.9 - ((i + 1) / bands) * 1.0
    const band = new Mesh(new CylinderGeometry(r1, r0, H / bands, 20), std(i % 2 ? '#e8262b' : '#f4f4f4', { roughness: 0.5 }))
    band.position.y = base + (i + 0.5) * (H / bands)
    g.add(band)
  }
  const dark = std('#2a2d33', { roughness: 0.6 })
  const gallery = new Mesh(new CylinderGeometry(2.7, 2.7, 0.5, 20), dark)
  gallery.position.y = base + H + 0.25
  const lamp = new Mesh(new CylinderGeometry(1.5, 1.5, 2.4, 16), neon('#fff3b0', 2.5))
  lamp.position.y = base + H + 1.7
  const roof = new Mesh(new ConeGeometry(2.1, 2.4, 16), std('#e8262b', { roughness: 0.5 }))
  roof.position.y = base + H + 4.1
  g.add(gallery, lamp, roof)
  const root = new Group()
  root.add(bake(g))
  // The beams: two long open cones from the lamp, turning.
  const spin = new Group()
  spin.position.y = base + H + 1.7
  const beamMat = glow('#fff6c8', 0.11)
  for (const dir of [1, -1]) {
    const geo = new ConeGeometry(4.5, 70, 16, 1, true)
    geo.translate(0, -35, 0) // apex at the lamp
    geo.rotateZ(dir * (Math.PI / 2 + 0.06)) // out sideways, a little downward
    spin.add(new Mesh(geo, beamMat))
  }
  root.add(spin)
  return { root, update: (t) => (spin.rotation.y = t * 1.2) }
}

// An anchored ship (a catalog boat scaled up), rocking at anchor.
const box = new Box3()
function ship([id, length], seed) {
  const model = buildBoat(id)
  box.setFromObject(model)
  const k = length / Math.max(0.01, box.max.z - box.min.z)
  model.scale.setScalar(k)
  const holder = new Group()
  holder.add(model)
  const baked = bake(holder)
  model.traverse((o) => o.isMesh && o.geometry.dispose()) // its materials live on in the baked meshes
  // boat.js floats the player's hull origin ~0.6 m over the water at BOAT.length; the same, scaled.
  const y = WATER.level + 0.4 * (length / BOAT.length)
  const root = new Group()
  root.add(baked)
  const phase = seed * 1.7
  return {
    root,
    update(t) {
      baked.position.y = y + Math.sin(t * 0.9 + phase) * 0.3
      baked.rotation.z = Math.sin(t * 0.7 + phase) * 0.035
      baked.rotation.x = Math.sin(t * 0.5 + phase) * 0.015
    },
  }
}

// Hot-air balloon: striped teardrop envelope, wicker basket on four ropes.
function balloon(colors, seed) {
  const env = new SphereGeometry(1, 16, 12).toNonIndexed()
  const pos = env.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    const w = y < 0 ? 1 + y * 0.48 : 1 // narrow toward the mouth
    pos.setXYZ(i, pos.getX(i) * w * 6, y * 7, pos.getZ(i) * w * 6)
  }
  env.computeVertexNormals()
  const palette = colors.map((c) => new Color(c))
  paintFaces(env, (x, y, z, c) => c.copy(palette[Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * 12) % palette.length]))
  const g = new Group()
  g.add(new Mesh(env, vc({ roughness: 0.5 })))
  const basket = new Mesh(new BoxGeometry(2.4, 1.7, 2.4), std('#8a5a2b', { roughness: 1 }))
  basket.position.y = -11
  g.add(basket)
  const ropes = []
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) ropes.push(rod(new Vector3(sx * 1.1, -10.2, sz * 1.1), new Vector3(sx * 1.9, -6.4, sz * 1.9), 0.06))
  g.add(new Mesh(mergeGeometries(ropes), std('#5a3a1e', { roughness: 1 })))
  const baked = bake(g)
  const root = new Group()
  root.add(baked)
  const phase = seed * 2.3
  return {
    root,
    update(t) {
      baked.position.y = Math.sin(t * 0.6 + phase) * 1.2
      baked.rotation.y = t * 0.08 + phase
    },
  }
}

// A giant rubber duck.
function duck(seed) {
  const yellow = std('#ffd21a', { roughness: 0.35 })
  const g = new Group()
  const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const m = new Mesh(geo, mat)
    m.position.set(x, y, z)
    m.scale.set(sx, sy, sz)
    g.add(m)
    return m
  }
  const ball = new SphereGeometry(1, 24, 16)
  add(ball, yellow, 0, WATER.level + 1.2, 0, 5, 3.6, 6.5)
  add(ball, yellow, 0, WATER.level + 6.6, -3.6, 3.2, 3.2, 3.2)
  add(ball, std('#ff8a1a', { roughness: 0.4 }), 0, WATER.level + 6.1, -7.1, 1.7, 0.6, 1.9)
  const black = std('#111111', { roughness: 0.2 })
  for (const sx of [-1, 1]) add(ball, black, sx * 1.4, WATER.level + 7.6, -6.2, 0.5, 0.6, 0.4)
  add(new ConeGeometry(2.4, 3.6, 14), yellow, 0, WATER.level + 4.2, 5.6).rotation.x = -0.7
  const baked = bake(g)
  const root = new Group()
  root.add(baked)
  const phase = seed
  return {
    root,
    update(t) {
      baked.position.y = Math.sin(t * 1.1 + phase) * 0.35
      baked.rotation.z = Math.sin(t * 0.8 + phase) * 0.05
    },
  }
}

// Three dolphins leaping in turn, swimming down the lane beside it.
let dolphinGeo = null
function dolphinGeometry() {
  if (dolphinGeo) return dolphinGeo
  const s = new SphereGeometry(1, 16, 10)
  const parts = [
    part(s, 0, 0, 0, 0, 0, 0, 0.6, 0.6, 1.8),
    part(new CylinderGeometry(0.13, 0.24, 0.8, 8), 0, -0.05, -2.0, Math.PI / 2),
    part(new ConeGeometry(0.4, 0.9, 4), 0, 0.7, 0.2, -0.5, 0, 0, 1, 1, 1.5),
    part(new BoxGeometry(1.6, 0.08, 0.55), 0, 0, 1.95),
    part(new BoxGeometry(0.9, 0.06, 0.38), 0.6, -0.3, -0.5, 0, 0, -0.45),
    part(new BoxGeometry(0.9, 0.06, 0.38), -0.6, -0.3, -0.5, 0, 0, 0.45),
  ]
  dolphinGeo = mergeGeometries(parts)
  const top = new Color('#4f7896')
  const belly = new Color('#dce8f0')
  paintFaces(dolphinGeo, (x, y, z, c) => c.copy(belly).lerp(top, Math.min(1, Math.max(0, (y + 0.25) / 0.5))))
  return dolphinGeo
}
function dolphins(seed) {
  const root = new Group()
  const mat = vc({ roughness: 0.3 })
  const pod = [0, 1, 2].map((i) => {
    const m = new Mesh(dolphinGeometry(), mat)
    m.scale.setScalar(1.15)
    root.add(m)
    return { m, x: (i - 1) * 3.2, z: i * 5, period: 2.4 + i * 0.25, phase: i * 0.8 + seed }
  })
  const AIR = 0.45 // share of each cycle spent in the air
  const H = 4.5 // m high
  const L = 15 // m long
  const SWIM = 9 // m/s forward, so they look like they race the boat
  let born = 0
  return {
    root,
    reset: (t) => (born = t),
    update(t) {
      const swim = -(t - born) * SWIM
      for (const d of pod) {
        const u = ((t + d.phase) % d.period) / d.period
        if (u > AIR) {
          d.m.visible = false
          continue
        }
        const a = u / AIR
        d.m.visible = true
        d.m.position.set(d.x, WATER.level - 0.6 + H * Math.sin(Math.PI * a), d.z + swim - L * a)
        d.m.rotation.x = Math.atan2(H * Math.PI * Math.cos(Math.PI * a), L) // nose follows the arc
      }
    },
  }
}

// An arch over the lane: lumpy rock with palms on top, or an inflatable rainbow.
function arch(kind, seed) {
  const R = HALF + 8 // feet clear of the ropes
  const g = new Group()
  if (kind === 'rock') {
    const rand = mulberry32(seed)
    const geo = new TorusGeometry(R, 3.8, 8, 30, Math.PI).toNonIndexed()
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = pos.getZ(i)
      const n = Math.sin(x * 0.31 + seed) * Math.cos(y * 0.37) + Math.sin(z * 0.9 + y * 0.2) * 0.6
      pos.setXYZ(i, x * (1 + n * 0.03), y + n * 0.8, z * (1 + n * 0.12))
    }
    geo.computeVertexNormals()
    const dark = new Color(PLAZA.rockDark)
    const rock = new Color(PLAZA.rock)
    const grass = new Color(PLAZA.grass)
    paintFaces(geo, (x, y, z, c) => (y > R + 1.2 ? c.copy(grass) : c.copy(dark).lerp(rock, Math.min(1, y / R))))
    g.add(new Mesh(geo, vc({ flatShading: true, roughness: 0.95 })))
    const rockMat = std(PLAZA.rockDark, { flatShading: true, roughness: 0.95 })
    for (const sx of [-1, 1]) {
      const foot = new Mesh(new DodecahedronGeometry(6.5), rockMat)
      foot.position.set(sx * R, 0, 0)
      foot.rotation.set(rand() * 3, rand() * 3, 0)
      g.add(foot)
    }
    for (const a of [1.35, 1.75]) buildPalm(g, Math.cos(a) * R, 0, 9, Math.cos(a) * 0.5, 0.1, seed * 10 + Math.round(a * 10), Math.sin(a) * R + 3.2)
  } else {
    const palette = S.rainbow.map((c) => new Color(c))
    const T = 2.6
    const geo = paintFaces(new TorusGeometry(R, T, 14, 44, Math.PI).toNonIndexed(), (x, y, z, c) => {
      const t = (Math.hypot(x, y) - (R - T)) / (2 * T) // inner edge 0 .. outer edge 1
      c.copy(palette[Math.min(palette.length - 1, Math.max(0, Math.floor((1 - t) * palette.length)))])
    })
    g.add(new Mesh(geo, vc({ roughness: 0.35, emissive: '#222222' })))
    const white = std('#ffffff', { roughness: 0.4 })
    for (const sx of [-1, 1]) {
      const pod = new Mesh(new SphereGeometry(4, 18, 12), white)
      pod.position.set(sx * R, 0.4, 0)
      pod.scale.set(1, 0.55, 1)
      g.add(pod)
    }
  }
  g.position.y = kind === 'rock' ? SEA : WATER.level
  const root = new Group()
  root.add(bake(g, true))
  return { root }
}

// --- Placement ------------------------------------------------------------------------------
const lerp = ([lo, hi], t) => lo + (hi - lo) * t

export function createRaceScenery(scene, home) {
  let built = null // kind -> [{ root, update?, reset?, busy }]
  let arches = null
  const active = [] // { piece, z } (z = track z)
  let cursor = 0 // track z of the next set piece
  let nextArch = 0 // track z of the next arch
  let side = 1
  let archKind = 0
  let t = 0
  const homeZ = []
  const homeVisible = []
  const rand = Math.random

  function build() {
    if (built) return
    const add = (piece) => {
      piece.root.visible = false
      piece.busy = false
      scene.add(piece.root)
      return piece
    }
    let seed = 300
    built = {
      island: [0, 1, 2, 0, 1, 2].map((v) => add(island(v, seed++))),
      stack: [0, 1, 0, 1].map((v) => add(stack(v, seed++))),
      ship: S.ships.map((spec) => add(ship(spec, seed++))),
      lighthouse: [0, 1].map(() => add(lighthouse(seed++))),
      balloon: S.balloons.map((c) => add(balloon(c, seed++))),
      duck: [0, 1].map(() => add(duck(seed++))),
      dolphins: [0, 1, 2].map(() => add(dolphins(seed++))),
    }
    arches = [add(arch('rock', seed++)), add(arch('rainbow', seed++))]
  }
  // Built while the lobby idles, so the first race doesn't hitch.
  setTimeout(build, 2500)

  function place(piece, x, y, z, yaw) {
    piece.busy = true
    piece.root.visible = true
    piece.root.position.set(x, y, z)
    piece.root.rotation.y = yaw
    piece.reset?.(t)
    active.push({ piece, z })
  }

  // One set piece at track z: a kind by weight among those with a free model.
  function placeNext(z) {
    let total = 0
    const free = []
    for (const [kind, spec] of Object.entries(S.kinds)) {
      const piece = built[kind].find((p) => !p.busy)
      if (!piece) continue
      free.push([spec, piece, kind])
      total += spec.weight
    }
    let pick = rand() * total
    const hit = free.find(([spec]) => (pick -= spec.weight) <= 0)
    if (!hit) return
    const [spec, piece, kind] = hit
    if (rand() < 0.8) side = -side // mostly alternating, sometimes two on one side
    const x = side * lerp(spec.x, rand())
    const y = spec.y ? lerp(spec.y, rand()) : 0
    const yaw = kind === 'dolphins' ? 0 : rand() * Math.PI * 2
    // The used model goes to the back of its pool, so the next of this kind is another variant.
    built[kind].push(built[kind].splice(built[kind].indexOf(piece), 1)[0])
    place(piece, x, y, z, yaw)
  }

  function setHome(offset) {
    const hide = offset > S.homeHide
    home.forEach((o, i) => {
      o.position.z = homeZ[i] + offset
      o.visible = hide ? false : homeVisible[i]
    })
  }

  return {
    start() {
      build()
      t = 0
      side = rand() < 0.5 ? -1 : 1
      cursor = LOBBY.gate.z - S.first
      nextArch = LOBBY.gate.z - S.archFirst
      home.forEach((o, i) => {
        homeZ[i] = o.position.z
        homeVisible[i] = o.visible
      })
    },
    stop() {
      for (const a of active) {
        a.piece.busy = false
        a.piece.root.visible = false
      }
      active.length = 0
      if (homeZ.length) setHome(0)
      homeZ.length = homeVisible.length = 0
    },
    // scroll: m the world has slid toward +Z; boatZ: the boat's world z.
    update(dt, scroll, boatZ) {
      if (!built) return
      t += dt
      while (cursor + scroll > boatZ - S.ahead) {
        placeNext(cursor)
        cursor -= lerp(S.gap, rand())
      }
      while (nextArch + scroll > boatZ - S.ahead) {
        const piece = arches[archKind++ % arches.length]
        if (!piece.busy) place(piece, 0, 0, nextArch, 0)
        nextArch -= S.archEvery
      }
      for (let i = active.length - 1; i >= 0; i--) {
        const a = active[i]
        const z = a.z + scroll
        if (z > boatZ + S.behind) {
          a.piece.busy = false
          a.piece.root.visible = false
          active.splice(i, 1)
          continue
        }
        a.piece.root.position.z = z
        a.piece.update?.(t)
      }
      setHome(scroll)
    },
  }
}
