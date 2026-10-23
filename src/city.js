import { BoxGeometry, CylinderGeometry, Group, IcosahedronGeometry, MeshStandardMaterial, Vector2 } from 'three'
import { CITY, ISLET, LOBBY, PLAZA, WATER } from './config.js'
import { bake } from './bake.js'
import { buildUmbrella, neon, put, std } from './propkit.js'
import { mulberry32, paintFacade, paintPavement, toTexture } from './textures.js'
import { buildSlab, isletRock, makeHill } from './world.js'

// The City world's scenery (environment.js shows it instead of the beach's).
// Everything stands where the beach's scenery stands, so the shared colliders fit:
//  - paved ground: square slabs with sunken joints, a concrete edge, a harbour-blue shallow band
//  - office blocks on every plaza cliff's footprint: a dark podium with glowing
//    shop windows, one to three towers (2x the cliff, some with a setback), window
//    facades whose lit windows glow, neon roof rims, rooftop units and antennas
//  - a ring of towers on the far horizon instead of the green hills (kept off the race lane)
//  - a park islet with a tower on the rock's footprint
//  - street trees in planters and street lamps where the palms stand, a blue umbrella
// The blocks and the skyline are baked to a few meshes per material (bake.js).
const B = CITY.buildings
const TILE = 16 // m of facade per texture tile: 8 window columns x 4 storeys (paintFacade)

// A box whose side faces tile the facade texture by size (windows keep their size on
// any block); its top and bottom sample the plain wall in the texture's corner.
function facadeBox(w, h, d) {
  const geo = new BoxGeometry(w, h, d)
  const uv = geo.attributes.uv
  // Faces in BoxGeometry order: +x, -x, +y, -y, +z, -z (4 vertices each).
  const across = [d, d, 0, 0, w, w]
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k
      if (!across[f]) uv.setXY(i, 0.004, 0.996)
      else uv.setXY(i, (uv.getX(i) * across[f]) / TILE, (uv.getY(i) * h) / TILE)
    }
  }
  return geo
}

function materials() {
  const facade = paintFacade(B.glass)
  const map = toTexture(facade.color, { srgb: true })
  const lit = toTexture(facade.lit, { srgb: true })
  return {
    walls: B.walls.map((c) => std(c, { map, emissiveMap: lit, emissive: B.lit, emissiveIntensity: 0.9, roughness: 0.5, metalness: 0.1 })),
    roof: std(B.roof, { roughness: 0.85 }),
    podium: std(B.podium, { roughness: 0.6 }),
    shop: std('#bfe4ff', { emissive: '#6fbaff', emissiveIntensity: 0.55, roughness: 0.15, metalness: 0.3 }),
    unit: std('#b8bec8', { roughness: 0.5, metalness: 0.3 }),
    dark: std('#2a2d35', { roughness: 0.5 }),
    beacon: neon('#ff2a2a', 2.5),
    rims: B.rims.map((c) => neon(c, 2.2)),
  }
}

const pick = (list, rand) => list[Math.floor(rand() * list.length)]
const lerp = ([lo, hi], t) => lo + (hi - lo) * t

// One tower at (x, z) in its block's frame, w x d, h tall from `y`: facade body, roof slab,
// sometimes a narrower upper part, a neon rim, and (detail) rooftop units and an antenna.
function tower(g, m, rand, x, z, w, d, h, y, detail) {
  const wall = pick(m.walls, rand)
  const setback = h > 34 && rand() < 0.5
  const lower = setback ? h * (0.55 + rand() * 0.15) : h
  put(g, facadeBox(w, lower, d), wall, x, y + lower / 2, z)
  let top = y + lower
  let tw = w
  let td = d
  if (setback) {
    tw = w * (0.6 + rand() * 0.15)
    td = d * (0.6 + rand() * 0.15)
    put(g, new BoxGeometry(w + 0.4, 0.6, d + 0.4), m.roof, x, top + 0.3, z)
    put(g, facadeBox(tw, h - lower, td), wall, x, top + (h - lower) / 2, z)
    top = y + h
  }
  put(g, new BoxGeometry(tw + 0.5, 0.9, td + 0.5), m.roof, x, top + 0.45, z)
  if (rand() < 0.6) {
    const rim = pick(m.rims, rand)
    for (const s of [-1, 1]) {
      put(g, new BoxGeometry(tw + 0.7, 0.18, 0.18), rim, x, top + 0.95, z + s * (td / 2 + 0.3), false)
      put(g, new BoxGeometry(0.18, 0.18, td + 0.7), rim, x + s * (tw / 2 + 0.3), top + 0.95, z, false)
    }
  }
  if (!detail) return
  // Rooftop: air-con units, sometimes a water tank, sometimes an antenna with a red light.
  for (let i = 0; i < 2 + Math.floor(rand() * 3); i++) {
    put(g, new BoxGeometry(1.6 + rand(), 1.1, 1.4 + rand()), m.unit, x + (rand() - 0.5) * (tw - 3), top + 1.4, z + (rand() - 0.5) * (td - 3))
  }
  if (rand() < 0.4) put(g, new CylinderGeometry(1.1, 1.1, 2.2, 14), m.dark, x + (rand() - 0.5) * (tw - 3), top + 2, z + (rand() - 0.5) * (td - 3))
  if (rand() < 0.5) {
    const ah = 5 + rand() * 7
    put(g, new CylinderGeometry(0.12, 0.18, ah, 6), m.dark, x, top + 0.9 + ah / 2, z)
    put(g, new BoxGeometry(0.45, 0.45, 0.45), m.beacon, x, top + 0.9 + ah, z, false)
  }
}

// An office block on a cliff's footprint [x, z, w, d, h, yaw]: a podium with glowing shop
// windows covering the whole collider, then one to three towers along its longer side.
function buildBlock(root, m, [x, z, w, d, h, yaw], seed, baseY = 0, detail = true) {
  const rand = mulberry32(seed)
  const g = new Group()
  g.position.set(x, baseY, z)
  g.rotation.y = yaw
  root.add(g)
  const pw = w + 1.2 // the collider's 0.6 m margin (cliffCollider)
  const pd = d + 1.2
  const podH = 5
  put(g, new BoxGeometry(pw, podH, pd), m.podium, 0, podH / 2, 0)
  put(g, new BoxGeometry(pw + 0.12, 2.6, pd + 0.12), m.shop, 0, 1.9, 0)
  put(g, new BoxGeometry(pw + 0.3, 0.3, pd + 0.3), m.roof, 0, podH + 0.15, 0)
  const alongX = w >= d
  const long = alongX ? w : d
  const short = alongX ? d : w
  const n = Math.max(1, Math.min(3, Math.round(long / 14)))
  const seg = long / n
  for (let i = 0; i < n; i++) {
    const tl = Math.max(5, seg - 1.5 - rand() * 2)
    const ts = Math.max(5, short - 1 - rand() * 3)
    const th = Math.max(h + 6, h * lerp(B.height, rand()))
    const off = -long / 2 + seg * (i + 0.5)
    const [tx, tz, tw, td] = alongX ? [off, 0, tl, ts] : [0, off, ts, tl]
    tower(g, m, rand, tx, tz, tw, td, th - podH, podH + 0.3, detail)
  }
}

// The far horizon: towers on rings round the island, none in the race lane ahead (-Z)
// nor over the islet (the start island slides away down the lane during a race).
function buildSkyline(root, m) {
  const S = CITY.skyline
  const rand = mulberry32(S.seed)
  const g = new Group()
  let placed = 0
  for (let tries = 0; placed < S.count && tries < S.count * 6; tries++) {
    const a = rand() * Math.PI * 2
    const dist = lerp(S.distance, rand())
    const x = Math.cos(a) * dist
    const z = Math.sin(a) * dist
    if (z < 0 && Math.abs(x) < 110) continue // the race lane
    const w = lerp(S.width, rand())
    const d = lerp(S.width, rand())
    const h = lerp(S.height, rand() * rand()) // mostly lower, a few very tall
    const t = new Group()
    t.position.set(x, WATER.level - 1, z)
    t.rotation.y = rand() * Math.PI
    g.add(t)
    tower(t, m, rand, 0, 0, w, d, h, 0, false)
    placed++
  }
  root.add(bake(g))
}

// A street tree in a concrete planter, about as tall as the palm it replaces.
function streetTree(root, x, z, height, seed) {
  const T = CITY.tree
  const rand = mulberry32(seed)
  const g = new Group()
  g.position.set(x, 0, z)
  g.scale.setScalar(height / 12)
  root.add(g)
  put(g, new BoxGeometry(2.4, 0.8, 2.4), std(T.planter, { roughness: 0.8 }), 0, 0.4, 0)
  put(g, new BoxGeometry(2, 0.1, 2), std('#4a3624', { roughness: 1 }), 0, 0.82, 0)
  put(g, new CylinderGeometry(0.22, 0.32, 5, 8), std(T.trunk, { roughness: 0.9 }), 0, 3.2, 0)
  const leaf = std(T.leaf, { flatShading: true, roughness: 0.8 })
  const light = std(T.leafLight, { flatShading: true, roughness: 0.8 })
  const blob = new IcosahedronGeometry(1, 1)
  for (let i = 0; i < 4; i++) {
    const r = 2 + rand() * 0.9
    const a = (i / 4) * Math.PI * 2 + rand()
    const o = i === 0 ? 0 : 1.3
    put(g, blob, i % 2 ? light : leaf, Math.cos(a) * o, 6.8 + (i === 0 ? 0.8 : rand() * 0.8), Math.sin(a) * o).scale.setScalar(r)
  }
}

// A street lamp: a dark pole with two arms and glowing heads, as tall as 0.7 x the palm.
function streetLamp(root, x, z, height) {
  const L = CITY.lamp
  const H = height * 0.7
  const g = new Group()
  g.position.set(x, 0, z)
  g.rotation.y = Math.atan2(-x, -z) // arms across the line to the middle of the beach
  root.add(g)
  const pole = std(L.pole, { metalness: 0.5, roughness: 0.4 })
  put(g, new CylinderGeometry(0.42, 0.5, 0.6, 12), pole, 0, 0.3, 0)
  put(g, new CylinderGeometry(0.12, 0.17, H, 10), pole, 0, H / 2, 0)
  const lightMat = neon(L.light, 2.4)
  for (const s of [-1, 1]) {
    put(g, new BoxGeometry(1.8, 0.14, 0.14), pole, s * 0.9, H - 0.2, 0)
    put(g, new BoxGeometry(0.9, 0.22, 0.5), pole, s * 1.8, H - 0.25, 0)
    put(g, new BoxGeometry(0.7, 0.08, 0.36), lightMat, s * 1.8, H - 0.38, 0, false)
  }
}

export function buildCity(root) {
  const m = materials()

  // Paved ground on the same slab, a concrete edge and a harbour-blue band round it.
  const P = CITY.pavement
  const paving = paintPavement(P)
  const top = new MeshStandardMaterial({
    map: toTexture(paving.color, { repeat: 1 / P.tile, srgb: true }),
    normalMap: toTexture(paving.normal, { repeat: 1 / P.tile }),
    normalScale: new Vector2(0.5, 0.5),
    roughness: 0.9,
  })
  buildSlab(root, top, CITY.slabSide, CITY.shallow)

  // Office blocks on the plaza cliffs' footprints (seeded like the cliffs they replace).
  const blocks = new Group()
  PLAZA.cliffs.forEach((c, i) => buildBlock(blocks, m, c, 20 + i * 7))
  root.add(bake(blocks, true))

  // The islet: a park with a tower where the rock stood.
  const I = isletRock()
  root.add(...makeHill(ISLET.x, ISLET.z, ISLET.hill.rx, ISLET.hill.ry, ISLET.hill.rz, CITY.park, 14))
  const islet = new Group()
  buildBlock(islet, m, I, 5, WATER.level - 1)
  root.add(bake(islet))

  buildSkyline(root, m)

  // Street trees and lamps where the beach has palms (the ones on the cliffs are dropped).
  LOBBY.palms.forEach(([x, z, h], i) => (i % 2 ? streetLamp(root, x, z, h) : streetTree(root, x, z, h, 100 + i)))
  for (const [x, z, y, h] of PLAZA.palms) if (y === 0) streetTree(root, x, z, h, 300 + x)
  buildUmbrella(root, LOBBY.umbrella, CITY.umbrella)
}
