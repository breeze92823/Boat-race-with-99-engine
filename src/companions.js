import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  ExtrudeGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Shape,
  SphereGeometry,
  Vector3,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { COMPANIONS, PARTNER, PETS } from './config.js'
import { LOOKS } from './pets.js'

// The 3D pets and partner that go with a boat, for the local player (main.js) and every remote
// player (remotePlayers.js) alike. Each pet / partner is ONE mesh: blocky parts with vertex
// colours, merged and cached per kind, so a full room stays cheap on phones. The looks follow
// the window portraits (pets.js LOOKS, partner.js looks in PARTNER): a pet is a rounded cube
// with googly eyes and its kind's ears / gills / wings / horns; a partner is a blocky figure in
// its shirt, pants, hair or hat (and cape). Golden pets get a gold metal finish, Rainbow pets a
// colour-cycling glow (one shared material, its hue advanced once per frame).
// Pets hover in slots behind and beside the boat (COMPANIONS.slots) and swing after its turns;
// the partner stands on the boat's `seat`, behind the rider.

const INK = '#1d1a22'
const toMatrix = new Matrix4()
const q = new Quaternion()
const euler = new Euler()
const tmpColor = new Color()

// A coloured part: a geometry moved into place (rotation x/y/z in radians), as non-indexed
// triangles carrying a `color` attribute so many parts merge into one mesh.
function part(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name)
  q.setFromEuler(euler.set(rx, ry, rz))
  toMatrix.compose(new Vector3(x, y, z), q, new Vector3(1, 1, 1))
  g.applyMatrix4(toMatrix)
  tmpColor.set(color)
  const n = g.attributes.position.count
  const col = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) tmpColor.toArray(col, i * 3)
  g.setAttribute('color', new (g.attributes.position.constructor)(col, 3))
  return g
}
const box = (w, h, d, color, x, y, z, rx, ry, rz) => part(new BoxGeometry(w, h, d), color, x, y, z, rx, ry, rz)
const mirror = (make) => [make(-1), make(1)]

const merge = (parts) => {
  const g = mergeGeometries(parts.flat())
  for (const p of parts.flat()) p.dispose()
  g.computeBoundingSphere()
  return g
}

// --- Pets ----------------------------------------------------------------------------------
// Body centre at y 0.45 (feet at 0), face toward +Z, about 0.9 m across.
function eyes(l) {
  if (l.glowEyes) return mirror((s) => box(0.22, 0.09, 0.04, '#9dff3a', s * 0.17, 0.52, 0.36, 0, 0, s * -0.3))
  return mirror((s) => [
    box(0.2, 0.22, 0.04, '#ffffff', s * 0.17, 0.52, 0.355),
    box(0.11, 0.13, 0.03, INK, s * 0.17 + 0.01, 0.5, 0.375),
    box(0.04, 0.04, 0.02, '#ffffff', s * 0.17 + 0.04, 0.54, 0.39),
  ])
}

function ears(l) {
  switch (l.ears) {
    case 'floppy':
      return mirror((s) => box(0.13, 0.42, 0.26, l.dark, s * 0.46, 0.5, 0, 0, 0, s * 0.22))
    case 'pointy':
      return mirror((s) => [part(new ConeGeometry(0.15, 0.34, 4), l.body, s * 0.24, 0.92, 0, 0, Math.PI / 4, s * -0.15), part(new ConeGeometry(0.08, 0.2, 4), l.inner ?? l.dark, s * 0.24, 0.9, 0.06, 0, Math.PI / 4, s * -0.15)])
    case 'long':
      return mirror((s) => [box(0.14, 0.52, 0.1, l.body, s * 0.17, 1.06, 0, 0, 0, s * -0.08), box(0.07, 0.38, 0.02, l.inner ?? l.dark, s * 0.17, 1.06, 0.06, 0, 0, s * -0.08)])
    case 'round':
      return mirror((s) => part(new CylinderGeometry(0.13, 0.13, 0.09, 12), l.dark, s * 0.3, 0.86, 0, Math.PI / 2))
    case 'horns':
      return [...mirror((s) => part(new ConeGeometry(0.08, 0.3, 6), '#ffd84a', s * 0.24, 0.94, 0, 0, 0, s * -0.3)), box(0.08, 0.14, 0.4, l.dark, 0, 0.86, -0.12, 0.3)]
  }
  return []
}

function extras(l) {
  const out = []
  if (l.gills) for (const [y, a] of [[0.66, 0.5], [0.52, 0], [0.38, -0.5]]) out.push(...mirror((s) => box(0.3, 0.09, 0.09, l.gills, s * 0.52, y, -0.02, 0, 0, s * a)))
  if (l.wings === 'leaf') out.push(...mirror((s) => box(0.5, 0.36, 0.05, '#3fbf3a', s * 0.55, 0.62, -0.22, 0, s * 0.6, s * 0.3)))
  if (l.wings === 'bat') out.push(...mirror((s) => [box(0.6, 0.4, 0.05, l.dark, s * 0.62, 0.7, -0.24, 0, s * 0.55, s * 0.35), box(0.3, 0.22, 0.06, l.body, s * 0.42, 0.66, -0.2, 0, s * 0.55, s * 0.35)]))
  if (l.tuft) for (const [x, h] of [[-0.2, 0.26], [0, 0.36], [0.2, 0.26]]) out.push(part(new ConeGeometry(0.1, h, 5), '#3fbf3a', x, 0.82 + h / 2, -0.05))
  if (l.flames) for (const [x, y, h, c] of [[0, 1.0, 0.5, '#5cff2a'], [-0.32, 0.9, 0.36, '#5cff2a'], [0.32, 0.9, 0.36, '#5cff2a'], [0, 0.95, 0.3, '#c8ff5a']]) out.push(part(new ConeGeometry(0.16, h, 6), c, x, y, -0.08))
  if (l.belly) out.push(box(0.4, 0.26, 0.04, l.belly, 0, 0.24, 0.355))
  if (l.muzzle) out.push(box(0.36, 0.2, 0.06, l.muzzle, 0, 0.32, 0.36))
  if (l.patches) out.push(...mirror((s) => box(0.26, 0.3, 0.03, l.dark, s * 0.17, 0.51, 0.352)))
  if (l.cheeks) out.push(...mirror((s) => box(0.1, 0.06, 0.02, '#ff8fb0', s * 0.3, 0.38, 0.356)))
  if (l.nose) out.push(box(0.1, 0.06, 0.04, INK, 0, 0.37, 0.4))
  if (l.nostrils) out.push(...mirror((s) => box(0.04, 0.04, 0.02, INK, s * 0.05, 0.36, 0.37)))
  if (l.mouth || l.whiskers) out.push(box(0.12, 0.03, 0.02, INK, 0, 0.33, 0.37))
  return out
}

// The Eternal Star: a faceted pink star on white wings with a little crown.
function starGeometry() {
  const shape = new Shape()
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5
    const r = i % 2 ? 0.2 : 0.46
    const p = [Math.cos(a) * r, Math.sin(a) * r]
    i ? shape.lineTo(...p) : shape.moveTo(...p)
  }
  const star = part(new ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 1 }), '#e46cff', 0, 0.5, -0.11)
  return merge([
    star,
    ...mirror((s) => box(0.5, 0.3, 0.05, '#f6f2ff', s * 0.5, 0.62, -0.12, 0, s * 0.4, s * 0.4)),
    box(0.28, 0.14, 0.2, '#9b4dff', 0, 1.02, 0),
    ...mirror((s) => box(0.07, 0.07, 0.03, INK, s * 0.09, 0.52, 0.17)),
  ])
}

const petGeos = new Map()
function petGeometry(kind) {
  if (petGeos.has(kind)) return petGeos.get(kind)
  let g
  if (kind === 'star') g = starGeometry()
  else {
    const l = LOOKS[kind] ?? LOOKS.dog
    g = merge([
      ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box(0.18, 0.16, 0.18, l.dark, sx * 0.22, 0.08, sz * 0.18))),
      part(new RoundedBoxGeometry(0.8, 0.72, 0.7, 2, 0.12), l.body, 0, 0.5, 0),
      box(0.6, 0.06, 0.02, '#ffffff', 0, 0.78, 0.352), // shine strip, like the portraits
      ...eyes(l),
      ...ears(l),
      ...extras(l),
    ])
  }
  petGeos.set(kind, g)
  return g
}

// --- Partner -------------------------------------------------------------------------------
// About 1.75 m before COMPANIONS.partnerScale, feet at 0, facing +Z.
function shirt(l) {
  const c2 = l.color2
  const out = []
  const band = (y, h = 0.06, c = c2) => out.push(box(0.58, h, 0.32, c, 0, y, 0))
  switch (l.shirt) {
    case 'stripes':
      for (const y of [1.08, 0.94, 0.8]) band(y, 0.05)
      break
    case 'bands':
      band(1.0)
      band(0.82)
      break
    case 'vest':
      out.push(...mirror((s) => box(0.16, 0.6, 0.02, c2, s * 0.2, 0.93, 0.155)))
      break
    case 'jacket':
      out.push(box(0.14, 0.6, 0.02, '#f4f4f4', 0, 0.93, 0.155), box(0.06, 0.34, 0.02, c2, 0, 1.0, 0.165))
      break
    case 'hero':
      out.push(box(0.3, 0.2, 0.02, '#ffd23a', 0, 1.05, 0.155))
      band(0.68, 0.06, '#ffd23a')
      break
    case 'emblem':
      out.push(box(0.26, 0.12, 0.02, c2, 0, 1.03, 0.155))
      band(0.68)
      break
    case 'labcoat':
      out.push(box(0.6, 0.3, 0.3, l.color, 0, 0.5, -0.0), box(0.1, 0.4, 0.02, c2, 0, 1.02, 0.155))
      break
    case 'jumpsuit':
    case 'police':
      out.push(box(0.14, 0.12, 0.02, c2, 0, 1.15, 0.155))
      band(0.68, 0.06, '#1d1d23')
      break
    default:
      band(0.68)
  }
  return out
}

function head(l) {
  const out = [box(0.42, 0.42, 0.42, l.skin, 0, 1.47, 0)]
  const covered = l.hat === 'mask' || l.hat === 'balaclava' || l.hat === 'hood' || l.hat === 'cowl'
  if (covered) {
    out.push(box(0.44, 0.44, 0.44, l.hood ?? l.hatColor, 0, 1.48, 0), box(0.3, 0.07, 0.02, l.skin, 0, 1.5, 0.222))
    if (l.hat === 'cowl') out.push(...mirror((s) => part(new ConeGeometry(0.06, 0.18, 4), l.hatColor, s * 0.14, 1.77, 0)))
  }
  if (!covered || l.hat === 'cowl') {
    if (l.face === 'shades') out.push(box(0.34, 0.08, 0.02, INK, 0, 1.5, 0.215))
    else out.push(...mirror((s) => box(0.06, 0.08, 0.02, INK, s * 0.09, 1.5, 0.215)))
    if (l.face === 'clown') out.push(part(new SphereGeometry(0.05, 8, 6), '#e3263a', 0, 1.43, 0.22))
    else out.push(box(0.12, 0.025, 0.02, '#8a3a2a', 0, 1.38, 0.215))
  }
  switch (l.hat) {
    case 'cap':
    case 'police':
      out.push(box(0.46, l.hat === 'police' ? 0.16 : 0.12, 0.46, l.hatColor, 0, 1.72, 0), box(0.34, 0.03, 0.18, l.hatColor, 0, 1.67, 0.28))
      break
    case 'hardhat':
      out.push(part(new SphereGeometry(0.27, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), l.hatColor, 0, 1.66, 0), box(0.6, 0.03, 0.6, l.hatColor, 0, 1.66, 0))
      break
    case 'fedora':
      out.push(box(0.62, 0.03, 0.62, l.hatColor, 0, 1.69, 0), box(0.4, 0.16, 0.4, l.hatColor, 0, 1.78, 0))
      break
  }
  if (!l.hat) {
    if (l.hair) out.push(box(0.46, 0.12, 0.46, l.hairColor, 0, 1.72, 0), box(0.46, 0.3, 0.1, l.hairColor, 0, 1.58, -0.19))
    if (l.hair === 'pigtails') out.push(box(0.12, 0.3, 0.12, l.tipA ?? l.hairColor, -0.29, 1.52, -0.05), box(0.12, 0.3, 0.12, l.tipB ?? l.hairColor, 0.29, 1.52, -0.05))
  }
  return out
}

const partnerGeos = new Map()
function partnerGeometry(id) {
  if (partnerGeos.has(id)) return partnerGeos.get(id)
  const p = PARTNER.partners.find((x) => x.id === id)
  const l = { skin: '#f1c9a5', color: '#7a8190', color2: '#4a4f5c', pants: '#2b3550', ...p?.look }
  const armColor = l.arms ?? l.color
  const arms = l.armsUp
    ? mirror((s) => [box(0.2, 0.62, 0.24, armColor, s * 0.4, 1.42, 0, 0, 0, s * -0.2), box(0.18, 0.12, 0.2, l.skin, s * 0.46, 1.74, 0, 0, 0, s * -0.2)])
    : mirror((s) => [box(0.2, 0.62, 0.24, armColor, s * 0.39, 0.92, 0), box(0.18, 0.12, 0.22, l.skin, s * 0.39, 0.58, 0)])
  const g = merge([
    box(0.26, 0.64, 0.28, l.pants, -0.14, 0.32, 0),
    box(0.26, 0.64, 0.28, l.pants2 ?? l.pants, 0.14, 0.32, 0),
    box(0.58, 0.62, 0.3, l.color, 0, 0.93, 0),
    ...shirt(l),
    ...arms,
    ...head(l),
    ...(l.cape ? [box(0.62, 1.05, 0.04, l.cape, 0, 0.78, -0.2, -0.12)] : []),
    ...(l.bat ? [part(new CylinderGeometry(0.035, 0.06, 0.8, 8), '#8a5a2c', 0.42, 0.68, 0.18, 0.5)] : []),
    ...(l.clipboard ? [box(0.26, 0.34, 0.03, '#d8c9a2', -0.4, 0.82, 0.2, -0.3)] : []),
  ])
  partnerGeos.set(id, g)
  return g
}

// --- Materials -------------------------------------------------------------------------------
const MATS = {
  plain: new MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }),
  golden: new MeshStandardMaterial({ vertexColors: true, color: '#ffd65a', metalness: 0.65, roughness: 0.28, emissive: '#5a3800', emissiveIntensity: 0.6 }),
  rainbow: new MeshStandardMaterial({ vertexColors: true, roughness: 0.4, emissive: '#ff0000', emissiveIntensity: 0.55 }),
}
const tierMat = (tier) => (tier >= 2 ? MATS.rainbow : tier === 1 ? MATS.golden : MATS.plain)
// Once per frame (main.js): the Rainbow pets' glow walks round the colour wheel.
export function updateCompanionMaterials(t) {
  MATS.rainbow.emissive.setHSL((t * 0.25) % 1, 1, 0.5)
}

// --- A boat's companions --------------------------------------------------------------------
// scene: where the pets fly (they swing after the boat in world space); seat: the boat's
// partner seat (boat.js). shadows: cast shadows (the local player's only).
export function createCompanions(scene, seat, { shadows = false } = {}) {
  const pets = new Group() // follows the owner, yaw eased so the pets swing round after turns
  scene.add(pets)
  let petMeshes = []
  let petKey = ''
  let partner = null
  let partnerId = ''
  let yaw = null

  return {
    get petCount() {
      return pets.visible ? petMeshes.length : 0
    },
    // [{ kind, tier }] equipped, at most COMPANIONS.slots.length drawn.
    setPets(list) {
      const shown = list.filter((p) => PETS.kinds[p.kind]).slice(0, COMPANIONS.slots.length)
      const key = shown.map((p) => `${p.kind}:${p.tier}`).join(',')
      if (key === petKey) return
      petKey = key
      for (const m of petMeshes) pets.remove(m)
      petMeshes = shown.map((p, i) => {
        const m = new Mesh(petGeometry(p.kind), tierMat(p.tier))
        const huge = p.kind.startsWith('huge')
        m.scale.setScalar(COMPANIONS.petScale * (huge ? COMPANIONS.hugeScale : 1))
        m.castShadow = shadows
        m.userData.slot = i
        pets.add(m)
        return m
      })
    },
    // A PARTNER id, or '' / null for none.
    setPartner(id) {
      id = PARTNER.partners.some((p) => p.id === id) ? id : ''
      if (id === partnerId) return
      partnerId = id
      if (partner) seat.remove(partner)
      partner = null
      if (!id) return
      partner = new Mesh(partnerGeometry(id), MATS.plain)
      partner.scale.setScalar(COMPANIONS.partnerScale)
      partner.castShadow = shadows
      seat.add(partner)
    },
    setVisible(on) {
      pets.visible = on
      if (partner) partner.visible = on
    },
    // x, y, z: the owner's feet; heading: its yaw (rad); t: elapsed s. Snaps on big jumps.
    update(dt, t, x, y, z, heading) {
      if (yaw === null || Math.hypot(x - pets.position.x, z - pets.position.z) > 40) yaw = heading
      const d = Math.atan2(Math.sin(heading - yaw), Math.cos(heading - yaw))
      yaw += d * (1 - Math.exp(-COMPANIONS.turnLag * dt))
      pets.position.set(x, y, z)
      pets.rotation.y = yaw
      for (const m of petMeshes) {
        const i = m.userData.slot
        const [sx, sy, sz] = COMPANIONS.slots[i]
        m.position.set(sx + Math.sin(t * 1.3 + i * 2.1) * 0.15, sy + Math.sin(t * 2.4 + i) * COMPANIONS.bob, sz + Math.cos(t * 1.1 + i * 1.7) * 0.15)
        m.rotation.set(0, Math.sin(t * 0.9 + i) * 0.25 - d * 0.6, Math.sin(t * 1.7 + i) * 0.06)
      }
    },
    dispose() {
      scene.remove(pets)
      if (partner) seat.remove(partner)
    },
  }
}
