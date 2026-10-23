import {
  BackSide,
  BoxGeometry,
  CapsuleGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  FrontSide,
  Group,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three'
import { BOATS } from './config.js'
import { makeEngine } from './boat.js'
import { put, std } from './propkit.js'

// Every boat in the Boats catalog (BOATS.list in config.js), also used by the
// Boats stall (shops.js). Each builder returns a Group with the bow toward +Z
// and the deck/rim at y = 0 (the hull hangs below), roughly 8-9 m long; boat.js
// scales an equipped one to the player's boat length. `userData.deck` is the
// height the rider stands at, in the model's own units.

const pinch = (z) => 1 - 0.45 * z * z

// Half a sphere, pinched toward the ends: a hull along +Z (bow at +Z). The
// lower half by default; `top` gives the upper half (a closed, domed deck).
export function hullGeometry(beam, depth, half, top = false) {
  const geo = new SphereGeometry(1, 32, 10, 0, Math.PI * 2, top ? 0 : Math.PI / 2, Math.PI / 2)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i)
    pos.setXYZ(i, pos.getX(i) * beam * pinch(z), pos.getY(i) * depth, z * half)
  }
  geo.computeVertexNormals()
  return geo
}

// A closed ring around a hullGeometry hull, `t` of the way down (0 = rim, 1 = keel):
// rims, painted stripes, neon chines, inflatable tubes.
function hullRing(beam, depth, half, t = 0, n = 48) {
  const r = Math.sqrt(1 - t * t)
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const z = Math.cos(a) * r
    pts.push(new Vector3(Math.sin(a) * r * beam * pinch(z), -t * depth, z * half))
  }
  return new CatmullRomCurve3(pts, true)
}
const ring = (beam, depth, half, t, radius) => new TubeGeometry(hullRing(beam, depth, half, t), 96, radius, 8, true)

// An open hull: outside in `color`, the inside (its back faces) in `inner`, a rim on top.
function openHull(boat, beam, depth, half, color, inner, rim = color) {
  const geo = hullGeometry(beam, depth, half)
  put(boat, geo, std(color, { roughness: 0.45, side: FrontSide }))
  put(boat, geo, std(inner, { roughness: 0.7, side: BackSide }), 0, 0, 0, false).receiveShadow = true
  put(boat, ring(beam, depth, half, 0, 0.1), std(rim, { roughness: 0.4 }))
}

// Seat planks across an open hull at the given z positions.
function thwarts(boat, beam, half, zs, y, color) {
  for (const z of zs) {
    const w = 2 * beam * pinch(z / half) * 0.92
    put(boat, new BoxGeometry(w, 0.12, 0.5), std(color, { roughness: 0.7 }), 0, y, z)
  }
}

// ROYAL WAVE: glossy speedboat with a domed deck, black cockpit, windshield,
// a waterline stripe and two big engines. `neon` lights the stripe, a chine
// line and the bow bar in that colour (the catalog's black-and-lime Royal Wave).
export function makeSpeedboat({ color, deck = color, engine = '#1f8a3a', band = '#8dff6a', stripe = '#f2fff4', neon = null }) {
  const boat = new Group()
  const paint = std(color, { roughness: 0.3, emissive: color, emissiveIntensity: 0.18, side: DoubleSide })
  const glow = neon && std(neon, { emissive: neon, emissiveIntensity: 1.1, roughness: 0.4 })
  put(boat, hullGeometry(1.5, 1.6, 4.4), paint)
  put(boat, hullGeometry(1.5, 0.5, 4.4, true), deck === color ? paint : std(deck, { roughness: 0.35, side: DoubleSide }))
  put(boat, ring(1.5, 1.6, 4.4, 0, 0.07), glow ?? std(stripe))
  if (glow) put(boat, ring(1.5, 1.6, 4.4, 0.45, 0.06), glow)
  put(boat, new BoxGeometry(1.6, 0.3, 2.6), std('#111318'), 0, 0.3, -0.4)
  put(boat, new BoxGeometry(2.6, 0.14, 0.4), glow ?? std('#d9ffe0', { emissive: color, emissiveIntensity: 0.6 }), 0, 0.05, 3.0)
  const shield = put(boat, new BoxGeometry(2, 0.7, 0.08), std('#bfe8ff', { transparent: true, opacity: 0.55, roughness: 0.05 }), 0, 0.35, 1.2)
  shield.rotation.x = -0.5
  for (const s of [-1, 1]) {
    const e = makeEngine({ body: engine, band, flame: band })
    e.group.scale.setScalar(1.8)
    e.group.position.set(s * 1.25, 0.25, -2.6)
    boat.add(e.group)
  }
  boat.userData.deck = 0.45
  return boat
}

// VIKING SHIP: a longship with round shields along both sides, a
// dragon-necked prow with a maned head, and a curled tail at the stern.
// `stripes` paints bands round the hull (the catalog's red-and-yellow one).
export function makeViking({ color, deck = '#8a4b1c', head = color, mane = ['#e8262b', '#ff8a1a'], shields = ['#ff8a1a', '#e8262b'], stripes = null }) {
  const boat = new Group()
  const lit = (c) => std(c, { roughness: 0.35, metalness: 0.3, emissive: '#7a3a00', emissiveIntensity: 0.25, side: DoubleSide })
  const hullMat = lit(color)
  const headMat = head === color ? hullMat : lit(head)
  const flat = (c) => std(c, { roughness: 0.45, emissive: c, emissiveIntensity: 0.15 })
  const maneMats = mane.map(flat)
  const shieldMats = shields.map(flat)
  put(boat, hullGeometry(1.5, 1.4, 4.2), hullMat)
  if (stripes) {
    const stripeMat = flat(stripes)
    for (const t of [0.02, 0.38, 0.68]) put(boat, ring(1.5, 1.4, 4.2, t, 0.09), stripeMat)
  }
  put(boat, new BoxGeometry(2.0, 0.1, 5.4), std(deck, { roughness: 0.8 }), 0, -0.08, 0)
  // Shields along each side.
  const shield = new CylinderGeometry(0.36, 0.36, 0.1, 18)
  shield.rotateZ(Math.PI / 2)
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const z = -2.2 + i * 1.1
      const half = 1.5 * pinch(z / 4.2)
      put(boat, shield, shieldMats[i % shieldMats.length], s * (half + 0.02), 0.05, z)
    }
  }
  // Dragon neck and head at the bow, a curl at the stern.
  const neck = new CatmullRomCurve3([new Vector3(0, 0, 3.9), new Vector3(0, 1.0, 4.6), new Vector3(0, 2.2, 4.7), new Vector3(0, 3.0, 4.2)])
  put(boat, new TubeGeometry(neck, 24, 0.3, 10), headMat)
  const headBox = put(boat, new BoxGeometry(0.7, 0.6, 1.1), headMat, 0, 3.1, 4.5)
  headBox.rotation.x = -0.25
  put(boat, new ConeGeometry(0.28, 0.6, 8), headMat, 0, 2.95, 5.15).rotation.x = Math.PI / 2 // snout
  for (const s of [-1, 1]) put(boat, new ConeGeometry(0.1, 0.5, 6), headMat, s * 0.22, 3.55, 4.3).rotation.z = -s * 0.3 // ears
  for (let i = 0; i < 5; i++) {
    const m = put(boat, new ConeGeometry(0.16, 0.7, 6), maneMats[i % maneMats.length], 0, 3.3 - i * 0.45, 4.0 - i * 0.12) // mane down the neck
    m.rotation.x = -1.9
  }
  const tail = new CatmullRomCurve3([new Vector3(0, 0, -3.9), new Vector3(0, 1.2, -4.5), new Vector3(0, 2.0, -4.1), new Vector3(0, 1.8, -3.6)])
  put(boat, new TubeGeometry(tail, 20, 0.24, 10), hullMat)
  return boat
}

// Wooden raft: six logs side by side, light cut ends, two cross planks lashed on top.
function makeRaft({ color, ends = '#e8b878', plank = '#c08a52', rope = '#5a3a1e' }) {
  const boat = new Group()
  const log = new CylinderGeometry(0.42, 0.42, 7.6, 12)
  log.rotateX(Math.PI / 2)
  const mats = [std(color, { roughness: 0.85 }), std(ends, { roughness: 0.9 }), std(ends, { roughness: 0.9 })]
  for (let i = 0; i < 6; i++) {
    const m = put(boat, log, mats, (i - 2.5) * 0.82, -0.42, i % 2 ? 0.25 : -0.2)
    m.rotation.z = i * 0.7 // vary the cylinder seams
  }
  for (const z of [-2.6, 2.6]) {
    put(boat, new BoxGeometry(5.3, 0.22, 0.7), std(plank, { roughness: 0.85 }), 0, 0.08, z)
    for (const x of [-1.6, 0, 1.6]) put(boat, new BoxGeometry(0.12, 0.3, 0.8), std(rope, { roughness: 0.9 }), x, 0.08, z)
  }
  boat.userData.deck = 0.15
  return boat
}

// Canadian canoe: a long open yellow hull, darker inside, three seats.
function makeCanoe({ color, inner, rim = color, seat = inner }) {
  const boat = new Group()
  openHull(boat, 1.25, 1.05, 4.2, color, inner, rim)
  thwarts(boat, 1.25, 4.2, [-1.9, 0, 1.9], -0.28, seat)
  boat.userData.deck = -0.55
  return boat
}

// Rowboat: an open dinghy with a lighter inside and two seats.
function makeRowboat({ color, inner }) {
  const boat = new Group()
  openHull(boat, 1.55, 1.1, 3.7, color, inner, '#3a3d42')
  thwarts(boat, 1.55, 3.7, [-1.4, 1.0], -0.35, inner)
  boat.userData.deck = -0.45
  return boat
}

// Jet ski: a slim domed body, a long seat and handlebars.
function makeJetski({ color, seat }) {
  const boat = new Group()
  const paint = std(color, { roughness: 0.3 })
  put(boat, hullGeometry(1.1, 0.7, 3.4), paint)
  put(boat, hullGeometry(1.1, 0.55, 3.4, true), paint)
  const seatGeo = new CapsuleGeometry(0.42, 2.2, 6, 12)
  seatGeo.rotateX(Math.PI / 2)
  const s = put(boat, seatGeo, std(seat, { roughness: 0.5 }), 0, 0.55, -0.9)
  s.scale.set(1, 0.7, 1)
  put(boat, new CylinderGeometry(0.1, 0.12, 0.8, 8), std('#1b1d22'), 0, 0.85, 1.1).rotation.x = -0.4
  const bar = put(boat, new CylinderGeometry(0.07, 0.07, 1.6, 8), std('#1b1d22'), 0, 1.25, 1.25)
  bar.rotation.z = Math.PI / 2
  put(boat, new BoxGeometry(1.3, 0.12, 0.9), std(seat, { roughness: 0.4 }), 0, 0.3, 2.2) // nose stripe
  boat.userData.deck = 0.7
  return boat
}

// Inflatable dinghy: a fat tube all round, a shallow floor and an outboard motor.
function makeDinghy({ tube, floor }) {
  const boat = new Group()
  const beam = 1.7
  const half = 3.5
  put(boat, new TubeGeometry(hullRing(beam, 1, half, 0, 40), 80, 0.55, 14, true), std(tube, { roughness: 0.55 }))
  put(boat, hullGeometry(beam * 0.92, 0.6, half * 0.95), std(floor, { roughness: 0.7, side: DoubleSide }), 0, -0.25, 0)
  const shape = new Shape()
  hullRing(beam * 0.9, 1, half * 0.92, 0, 32)
    .getPoints(32)
    .forEach((p, i) => (i ? shape.lineTo(p.x, -p.z) : shape.moveTo(p.x, -p.z)))
  const deck = new ShapeGeometry(shape)
  deck.rotateX(-Math.PI / 2)
  put(boat, deck, std(floor, { roughness: 0.8 }), 0, -0.3, 0, false).receiveShadow = true
  // Outboard motor on the stern.
  const black = std('#16171b', { roughness: 0.4 })
  put(boat, new BoxGeometry(0.75, 0.9, 0.9), black, 0, 0.65, -half - 0.35)
  put(boat, new BoxGeometry(0.75, 0.2, 0.95), std('#3a3c44'), 0, 1.15, -half - 0.35)
  put(boat, new CylinderGeometry(0.12, 0.12, 1.2, 8), black, 0, -0.3, -half - 0.45)
  put(boat, new CylinderGeometry(0.06, 0.06, 1.0, 6), black, 0, 0.8, -half + 0.4).rotation.x = Math.PI / 2 // tiller
  boat.userData.deck = -0.25
  return boat
}

// Centre-console boat: an open deck, a console with a windscreen and a T-top
// roof on four posts (the teal 2.6M boat).
function makeConsole({ color, deck, frame = '#1c1e24' }) {
  const boat = new Group()
  put(boat, hullGeometry(1.6, 1.5, 4.3), std(color, { roughness: 0.35, side: DoubleSide }))
  put(boat, hullGeometry(1.6, 0.22, 4.3, true), std(deck, { roughness: 0.6 }))
  put(boat, ring(1.6, 1.5, 4.3, 0, 0.09), std(color, { roughness: 0.35 }))
  const dark = std(frame, { roughness: 0.4 })
  put(boat, new BoxGeometry(1.2, 1.0, 1.1), std(color, { roughness: 0.35 }), 0, 0.6, 0.2)
  put(boat, new BoxGeometry(1.2, 0.5, 0.08), std('#9fd8ff', { transparent: true, opacity: 0.6, roughness: 0.05 }), 0, 1.3, 0.75).rotation.x = -0.4
  for (const x of [-0.8, 0.8]) for (const z of [-0.9, 1.0]) put(boat, new CylinderGeometry(0.07, 0.07, 2.6, 8), dark, x, 1.3, z)
  put(boat, new BoxGeometry(2.0, 0.14, 2.4), dark, 0, 2.6, 0.05)
  const e = makeEngine({ body: frame, band: '#6a6f78', flame: '#38d7ff' })
  e.group.scale.setScalar(1.6)
  e.group.position.set(0, 0.1, -4.3)
  boat.add(e.group)
  boat.userData.deck = 0.22
  return boat
}

// Triangular sail (+ boom) on a mast standing at z, `h` m tall, `w` m deep.
function sail(boat, z, h, w, sailMat, dark) {
  put(boat, new CylinderGeometry(0.12, 0.14, h + 0.4, 10), dark, 0, (h + 0.4) / 2, z)
  const boom = put(boat, new CylinderGeometry(0.09, 0.09, w + 0.1, 8), dark, 0, 1.1, z - w / 2)
  boom.rotation.x = Math.PI / 2
  const tri = new Shape()
  tri.moveTo(0, 1.2)
  tri.lineTo(0, h)
  tri.lineTo(w, 1.2)
  tri.closePath()
  const geo = new ShapeGeometry(tri)
  geo.rotateY(Math.PI / 2) // shape +x -> -z (toward the stern)
  put(boat, geo, sailMat, 0.02, 0, z - 0.05)
}

// Sailboat: a sleek hull with a deck, one or two masts with dark sails and an optional cabin.
function makeSailboat({ color, sail: sailColor, deck = '#f2f2f2', masts = 1, cabin = null }) {
  const boat = new Group()
  put(boat, hullGeometry(1.5, 1.4, 4.2), std(color, { roughness: 0.35, side: DoubleSide }))
  put(boat, hullGeometry(1.5, 0.25, 4.2, true), std(deck, { roughness: 0.5 }))
  const dark = std('#222329', { roughness: 0.4 })
  const sailMat = std(sailColor, { roughness: 0.8, side: DoubleSide })
  if (masts === 1) sail(boat, 0.8, 6.2, 2.7, sailMat, dark)
  else {
    sail(boat, 1.9, 6.4, 2.4, sailMat, dark)
    sail(boat, -0.9, 5.0, 2.2, sailMat, dark)
  }
  if (cabin) put(boat, new BoxGeometry(1.5, 0.7, 2.0), std(cabin, { roughness: 0.4 }), 0, 0.45, -2.1)
  boat.userData.deck = 0.25
  return boat
}

// Cruiser / yacht: speedboat hull with a long cabin, a dark window band, a
// sloped windshield and optional deck rails.
function makeCruiser({ color, cabin, glass = '#1c2433', rail = null }) {
  const boat = new Group()
  const paint = std(color, { roughness: 0.3, side: DoubleSide })
  put(boat, hullGeometry(1.6, 1.5, 4.4), paint)
  put(boat, hullGeometry(1.6, 0.4, 4.4, true), paint)
  const cab = std(cabin, { roughness: 0.4 })
  put(boat, new BoxGeometry(2.1, 1.1, 3.4), cab, 0, 0.8, -0.7)
  put(boat, new BoxGeometry(2.16, 0.42, 3.0), std(glass, { roughness: 0.1, metalness: 0.4 }), 0, 0.95, -0.6)
  const shield = put(boat, new BoxGeometry(2.0, 0.9, 0.12), std(glass, { roughness: 0.1, metalness: 0.4 }), 0, 0.75, 1.2)
  shield.rotation.x = -0.75
  put(boat, new BoxGeometry(2.3, 0.14, 2.4), cab, 0, 1.42, -1.0) // roof
  if (rail) {
    const railMat = std(rail, { roughness: 0.3, metalness: 0.5 })
    const r = put(boat, ring(1.45, 1, 4.1, 0, 0.05), railMat)
    r.position.y = 0.75
    for (let i = 0; i < 10; i++) {
      const z = -3.4 + i * 0.8
      for (const s of [-1, 1]) put(boat, new CylinderGeometry(0.04, 0.04, 0.6, 6), railMat, s * 1.45 * pinch(z / 4.1), 0.45, z)
    }
  }
  boat.userData.deck = 0.4
  return boat
}

// Tugboat: a deep hull with a black bumper, a wheelhouse with blue windows and
// a funnel; `decks: 2` stacks a second cabin, `tires` hangs fenders on the sides.
function makeTug({ color, cabin, roof = color, decks = 1, tires = false }) {
  const boat = new Group()
  put(boat, hullGeometry(1.8, 1.6, 4.0), std(color, { roughness: 0.4, side: DoubleSide }))
  put(boat, hullGeometry(1.8, 0.18, 4.0, true), std('#6a4428', { roughness: 0.8 }))
  const rubber = std('#1e1f24', { roughness: 0.7 })
  put(boat, ring(1.82, 1, 4.02, 0, 0.22), rubber).position.y = -0.05
  const cab = std(cabin, { roughness: 0.45 })
  const glass = std('#2f9bff', { roughness: 0.1, metalness: 0.3, emissive: '#1a5aa8', emissiveIntensity: 0.3 })
  const roofMat = std(roof, { roughness: 0.4 })
  let y = 0.1
  for (let d = 0; d < decks; d++) {
    const w = 2.3 - d * 0.5
    const len = (decks > 1 ? 3.4 : 2.2) - d * 1.1
    put(boat, new BoxGeometry(w, 1.5, len), cab, 0, y + 0.75, 0.2)
    put(boat, new BoxGeometry(w + 0.06, 0.45, len + 0.06), glass, 0, y + 1.0, 0.2)
    put(boat, new BoxGeometry(w + 0.3, 0.2, len + 0.3), roofMat, 0, y + 1.6, 0.2)
    y += 1.7
  }
  put(boat, new CylinderGeometry(0.38, 0.42, 1.6, 14), rubber, 0, 1.0, -1.9)
  put(boat, new CylinderGeometry(0.44, 0.44, 0.35, 14), roofMat, 0, 1.65, -1.9)
  if (tires) {
    const tire = new TorusGeometry(0.34, 0.14, 8, 16)
    tire.rotateY(Math.PI / 2)
    for (const s of [-1, 1]) for (const z of [-2.2, -0.8, 0.6, 2.0]) put(boat, tire, rubber, s * (1.8 * pinch(z / 4) + 0.12), -0.45, z)
  }
  boat.userData.deck = 0.15
  return boat
}

// Square sail across the ship (billowing forward) hung from a yard.
function squareSail(boat, z, y, w, h, sailMat, dark) {
  const geo = new PlaneGeometry(w, h, 8, 4)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / w
    const v = pos.getY(i) / h
    pos.setZ(i, 0.45 * Math.cos(u * Math.PI) * Math.cos(v * Math.PI))
  }
  geo.computeVertexNormals()
  put(boat, geo, sailMat, 0, y, z + 0.12)
  put(boat, new CylinderGeometry(0.07, 0.07, w + 0.3, 6), dark, 0, y + h / 2, z).rotation.z = Math.PI / 2
}

// Galleon: a tall wooden hull with a raised stern castle, a bowsprit and two
// or three masts of square sails; `skull` paints a skull and crossbones on the
// main sail (the pirate ship).
function makeGalleon({ color, deck = '#a8743f', sail: sailColor, trim = '#c9832e', masts = 3, skull = false }) {
  const boat = new Group()
  const hullMat = std(color, { roughness: 0.6, side: DoubleSide })
  const wood = std('#4a2c14', { roughness: 0.7 })
  const trimMat = std(trim, { roughness: 0.45, metalness: 0.3 })
  put(boat, hullGeometry(1.7, 1.8, 4.4), hullMat)
  put(boat, hullGeometry(1.7, 0.15, 4.4, true), std(deck, { roughness: 0.8 }))
  put(boat, ring(1.7, 1.8, 4.4, 0, 0.1), trimMat)
  put(boat, ring(1.7, 1.8, 4.4, 0.42, 0.07), trimMat)
  put(boat, new BoxGeometry(2.7, 1.3, 1.8), hullMat, 0, 0.6, -3.2) // stern castle
  put(boat, new BoxGeometry(2.8, 0.14, 1.9), trimMat, 0, 1.3, -3.2)
  put(boat, new BoxGeometry(2.0, 0.6, 1.3), hullMat, 0, 0.3, 3.3) // forecastle
  const sprit = put(boat, new CylinderGeometry(0.08, 0.12, 3.0, 8), wood, 0, 1.0, 5.0)
  sprit.rotation.x = 1.15
  const sailMat = std(sailColor, { roughness: 0.75, side: DoubleSide })
  const spots = masts === 3 ? [[2.1, 6.4], [0, 8.0], [-2.0, 6.6]] : [[1.4, 7.4], [-1.4, 6.4]]
  for (const [z, h] of spots) {
    put(boat, new CylinderGeometry(0.11, 0.15, h, 10), wood, 0, h / 2, z)
    const rows = h > 7 ? 3 : 2
    for (let r = 0; r < rows; r++) squareSail(boat, z, 2.0 + r * 1.9, 3.3 - r * 0.6, 1.7, sailMat, wood)
  }
  put(boat, new PlaneGeometry(0.9, 0.5), std('#e8262b', { side: DoubleSide }), 0.45, spots[masts === 3 ? 1 : 0][1] - 0.2, spots[masts === 3 ? 1 : 0][0]).rotation.y = Math.PI / 2
  if (skull) {
    const [z] = spots[0]
    const bone = std('#f4f1ea', { roughness: 0.6, side: DoubleSide })
    put(boat, new CircleGeometry(0.42, 18), bone, 0, 2.15, z + 0.6)
    for (const s of [-1, 1]) {
      put(boat, new CircleGeometry(0.1, 10), std('#111111', { side: DoubleSide }), s * 0.15, 2.2, z + 0.62)
      const b = put(boat, new BoxGeometry(1.1, 0.12, 0.04), bone, 0, 1.6, z + 0.58)
      b.rotation.z = s * 0.6
    }
  }
  boat.userData.deck = 0.1
  return boat
}

const BUILDERS = {
  speedboat: makeSpeedboat,
  viking: makeViking,
  raft: makeRaft,
  canoe: makeCanoe,
  rowboat: makeRowboat,
  jetski: makeJetski,
  dinghy: makeDinghy,
  console: makeConsole,
  sailboat: makeSailboat,
  cruiser: makeCruiser,
  tug: makeTug,
  galleon: makeGalleon,
}

export const boatById = (id) => BOATS.list.find((b) => b.id === id)

// A fresh model of catalog boat `id` (or of a { kind, ...colours } spec).
export function buildBoat(spec) {
  const b = typeof spec === 'string' ? boatById(spec) : spec
  const group = BUILDERS[b.kind](b.model ?? {})
  group.userData.deck ??= 0
  return group
}

export function disposeBoat(group) {
  group.traverse((o) => {
    if (!o.isMesh) return
    o.geometry.dispose()
    for (const m of [].concat(o.material)) m.dispose()
  })
}
