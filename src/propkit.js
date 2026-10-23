import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  ConeGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { NEON, PALM, PLAZA } from './config.js'
import { RAPIER, addFixed } from './physics.js'
import { mulberry32, paintText } from './textures.js'

// Shared building blocks for the hand-built props (lobby.js, plaza.js):
// material shorthands, a mesh placer, fixed-collider helpers, outlined text
// sprites, the palm tree and grass-capped rock cliffs.

export const std = (color, extra) => new MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...extra })
export const glow = (color, opacity = 0.85) => new MeshBasicMaterial({ color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, side: DoubleSide })

export function put(parent, geo, mat, x = 0, y = 0, z = 0, shadows = true) {
  const m = new Mesh(geo, mat)
  m.position.set(x, y, z)
  if (shadows) {
    m.castShadow = true
    m.receiveShadow = true
  }
  parent.add(m)
  return m
}

export const yawQuat = (yaw) => ({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) })
export function solidBox(hx, hy, hz, x, y, z, yaw = 0) {
  addFixed(RAPIER.ColliderDesc.cuboid(hx, hy, hz), { x, y, z }, yawQuat(yaw))
}
export function solidPole(radius, height, x, z) {
  addFixed(RAPIER.ColliderDesc.cylinder(height / 2, radius), { x, y: height / 2, z })
}

// --- Neon: unlit materials that glow ----------------------------------------------
// With bloom on, a neon material's colour is pushed to `k` times its base so
// it clears the bloom threshold (bloom measures luminance, so blues need a
// bigger k than greens to glow). With bloom off the same k would just tone-map
// to a washed-out white, so it is capped at NEON.plainMax. main.js flips this
// with the graphics preset via setNeonBloom.
const neonMats = new Set() // dropped again when a material is disposed
let neonBloom = false
function applyNeon(m) {
  const { base, k } = m.userData
  m.color.copy(base).multiplyScalar(neonBloom ? k : Math.min(k, NEON.plainMax))
}
// `extra` takes MeshBasicMaterial options (e.g. additive, transparent flames).
export function neon(color, k = NEON.k, extra = {}) {
  const m = new MeshBasicMaterial(extra)
  m.userData.base = new Color(color)
  m.userData.k = k
  applyNeon(m)
  neonMats.add(m)
  m.addEventListener('dispose', () => neonMats.delete(m))
  return m
}
export function setNeonBloom(on) {
  neonBloom = on
  for (const m of neonMats) applyNeon(m)
}

// --- Labels: outlined text sprites, repainted once Fredoka has loaded --------
export const fontReady = document.fonts?.load ? document.fonts.load('700 96px Fredoka').catch(() => null) : Promise.resolve()
export function label(text, height, opts) {
  const t = paintText(text, opts)
  const tex = new CanvasTexture(t.canvas)
  tex.colorSpace = SRGBColorSpace
  const sprite = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }))
  const fit = () => sprite.scale.set((height * t.canvas.width) / t.canvas.height, height, 1)
  fit()
  fontReady.then(() => {
    t.draw()
    tex.dispose() // the canvas may have changed size
    tex.needsUpdate = true
    fit()
  })
  return sprite
}

// --- Palm trees -----------------------------------------------------------------------
let frondGeo = null
// One frond along +Z: a folded, drooping leaf with a jagged (alternating-width) edge.
function frondGeometry() {
  if (frondGeo) return frondGeo
  const rows = 16
  const L = 4.6
  const pos = []
  const col = []
  const idx = []
  const dark = new Color('#2c8a22')
  const light = new Color(PALM.leaf).lerp(new Color('#8fe04a'), 0.35)
  for (let i = 0; i <= rows; i++) {
    const t = i / rows
    const z = t * L
    const y = -1.5 * t * t + 0.5 * t
    const w = 0.95 * Math.sin(Math.PI * Math.pow(t, 0.75)) * (i % 2 ? 1 : 0.62) + 0.04
    const c = dark.clone().lerp(light, t)
    pos.push(-w, y - w * 0.35, z, 0, y, z, w, y - w * 0.35, z)
    for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b)
  }
  for (let i = 0; i < rows; i++) {
    const a = i * 3
    const b = a + 3
    idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2)
  }
  frondGeo = new BufferGeometry()
  frondGeo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  frondGeo.setAttribute('color', new Float32BufferAttribute(col, 3))
  frondGeo.setIndex(idx)
  frondGeo.computeVertexNormals()
  return frondGeo
}

const UP = new Vector3(0, 1, 0)
// Built 10 m tall, then scaled to `height` so trunk girth and crown grow with it.
// solid: false for scenery whose collider is added elsewhere (environment.js).
export function buildPalm(root, x, z, treeHeight, leanX, leanZ, seed, y = 0, solid = true) {
  const rand = mulberry32(seed)
  const s = treeHeight / 10
  const height = 10
  const g = new Group()
  g.position.set(x, y, z)
  g.scale.setScalar(s)
  root.add(g)
  const segs = 9
  const ringA = std(PALM.trunk, { roughness: 0.9 })
  const ringB = std('#8c5d30', { roughness: 0.9 })
  const point = (t) => new Vector3(leanX * height * t * t, height * t, leanZ * height * t * t)
  const q = new Quaternion()
  for (let i = 0; i < segs; i++) {
    const a = point(i / segs)
    const b = point((i + 1) / segs)
    const dir = b.clone().sub(a)
    const len = dir.length()
    const r = 0.42 - (i / segs) * 0.17
    const seg = put(g, new CylinderGeometry(r * 0.86, r, len * 1.04, 12), i % 2 ? ringA : ringB, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
    seg.quaternion.copy(q.setFromUnitVectors(UP, dir.normalize()))
  }
  const top = point(1)
  const crown = new Group()
  crown.position.copy(top)
  g.add(crown)
  const leafMat = std('#ffffff', { vertexColors: true, side: DoubleSide, roughness: 0.7 })
  const fronds = 9
  for (let i = 0; i < fronds; i++) {
    const f = new Mesh(frondGeometry(), leafMat)
    f.castShadow = true
    f.rotation.order = 'YXZ'
    f.rotation.y = (i / fronds) * Math.PI * 2 + rand() * 0.4
    f.rotation.x = -0.35 + rand() * 0.35
    f.scale.setScalar(0.9 + rand() * 0.3)
    crown.add(f)
  }
  const nut = new SphereGeometry(0.24, 12, 10)
  const nutMat = std('#6b4a22', { roughness: 0.8 })
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2
    put(crown, nut, nutMat, Math.cos(a) * 0.3, -0.3, Math.sin(a) * 0.3)
  }
  if (solid && y === 0) palmCollider(x, z, treeHeight) // palms up on the cliffs are out of reach
}
// A palm's trunk collider (also the City's street tree or lamp in its place).
export const palmCollider = (x, z, treeHeight) => solidPole((0.5 * treeHeight) / 10, (4 * treeHeight) / 10, x, z)

// --- Grass-capped rock cliffs ---------------------------------------------------------------------------
// A subdivided box pushed in and out by a smooth function of position (so the
// faces' shared corners move together and nothing cracks), flat shaded, darker
// toward its foot. The grass cap is the same trick with a ragged lower edge.
const wobble = (x, y, z, seed) => Math.sin(x * 0.37 + seed) * Math.cos(z * 0.41 - seed * 0.7) + Math.sin(y * 0.53 + x * 0.21 + seed * 1.3) * 0.6

function lumpyBox(w, h, d, seed, amount, colorAt) {
  const geo = new BoxGeometry(w, h, d, Math.max(2, Math.round(w / 4)), Math.max(2, Math.round(h / 4)), Math.max(2, Math.round(d / 4)))
  const pos = geo.attributes.position
  const colors = []
  const c = new Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    pos.setXYZ(i, x + wobble(x, y, z, seed) * amount, y, z + wobble(z, y, x, seed + 3) * amount)
    colorAt(y / h + 0.5, c)
    colors.push(c.r, c.g, c.b)
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  return geo
}

// A cliff's collider (also the footprint of the City building standing in its place).
export function cliffCollider([x, z, w, d, h, yaw], baseY = 0) {
  solidBox(w / 2 + 0.6, h / 2, d / 2 + 0.6, x, baseY + h / 2, z, yaw)
}

// solid: false for decoration that never meets the player (race scenery, the
// start island's scenery: environment.js adds its colliders once), which gets no collider.
export function buildCliff(root, [x, z, w, d, h, yaw], seed, baseY = 0, solid = true) {
  const g = new Group()
  g.position.set(x, baseY, z)
  g.rotation.y = yaw
  root.add(g)
  const dark = new Color(PLAZA.rockDark)
  const rock = new Color(PLAZA.rock)
  const rockGeo = lumpyBox(w, h, d, seed, 1.3, (t, out) => out.copy(dark).lerp(rock, Math.min(1, t * 1.6)))
  put(g, rockGeo, std('#ffffff', { vertexColors: true, flatShading: true, roughness: 0.95 }), 0, h / 2, 0)

  // Grass cap: a slab over the top whose lower edge hangs down unevenly.
  const grass = new Color(PLAZA.grass)
  const light = new Color(PLAZA.grassLight)
  const capH = 2.4
  const capGeo = lumpyBox(w + 2.2, capH, d + 2.2, seed + 9, 0.6, (t, out) => out.copy(grass).lerp(light, t))
  const pos = capGeo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    if (y < 0) pos.setY(i, y - 0.4 - Math.abs(wobble(pos.getX(i) * 2, y, pos.getZ(i) * 2, seed)) * 1.6)
  }
  capGeo.computeVertexNormals()
  put(g, capGeo, std('#ffffff', { vertexColors: true, flatShading: true, roughness: 0.9 }), 0, h - capH / 2 + 0.6, 0)
  if (solid) cliffCollider([x, z, w, d, h, yaw], baseY)
}

// --- Beach umbrella -------------------------------------------------------------------
// Tilted like it was pushed into the sand at an angle; `colors` = its two panel colours.
// Visual only: environment.js adds its pole's collider.
export function buildUmbrella(root, { x, z, scale }, [colorA, colorB]) {
  const g = new Group()
  g.position.set(x, 0, z)
  g.scale.setScalar(scale)
  g.rotation.set(0.25, 0.4, 0.3)
  root.add(g)
  put(g, new CylinderGeometry(0.07, 0.07, 5.4, 10), std('#d8dce4', { metalness: 0.5, roughness: 0.35 }), 0, 2.7, 0)
  // Canopy: an open cone with alternating panels (per-face vertex colours).
  const cone = new ConeGeometry(4.4, 1.5, 16, 1, true).toNonIndexed()
  const pos = cone.attributes.position
  const colors = []
  const a = new Color(colorA)
  const b = new Color(colorB)
  for (let i = 0; i < pos.count; i += 3) {
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3
    const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3
    const panel = Math.floor(((Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2)) * 16)
    const c = panel % 2 ? a : b
    for (let k = 0; k < 3; k++) colors.push(c.r, c.g, c.b)
  }
  cone.setAttribute('color', new Float32BufferAttribute(colors, 3))
  cone.computeVertexNormals()
  put(g, cone, std('#ffffff', { vertexColors: true, side: DoubleSide, roughness: 0.7 }), 0, 5.3, 0)
  put(g, new SphereGeometry(0.16, 10, 8), std(colorA), 0, 6.1, 0)
}
