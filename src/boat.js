import {
  AdditiveBlending,
  Box3,
  BoxGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three'
import { BOAT } from './config.js'
import { createEmitter, removeEmitter } from './particles.js'
import { neon } from './propkit.js'
import { bake } from './bake.js'

// The player's boat (and every remote player's, remotePlayers.js): a yellow kayak
// hull until a catalog boat is equipped, and its engines on a cross bar (the
// equipped engine's colours x the boat's engine count), each with a flickering
// flame. Built facing +Z (the character's forward). The avatar rides on
// `boat.rider`, inside the part that bobs and tilts, so it leans with the hull.
const HULL_DEPTH = 0.42

const std = (color, extra) => new MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...extra })

function shadowed(mesh) {
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

// Half-width of the hull at z (-1..1 along its length): narrower, pointed ends.
const pinch = (z) => 1 - 0.45 * z * z

// One engine (shared with the lobby's parked raft). Nose +Z, flame out of -Z.
export function makeEngine({ body = BOAT.engine, band = BOAT.engineBand, flame = BOAT.flame } = {}) {
  const group = new Group()
  const bodyMat = std(body, { roughness: 0.4 })
  const bandMat = std(band, { emissive: band, emissiveIntensity: 0.25 })
  const metal = std('#2b2f36', { metalness: 0.6, roughness: 0.35 })

  const tube = new CylinderGeometry(0.2, 0.2, 0.85, 18)
  tube.rotateX(Math.PI / 2)
  group.add(shadowed(new Mesh(tube, bodyMat)))
  const ring = new CylinderGeometry(0.215, 0.215, 0.08, 18)
  ring.rotateX(Math.PI / 2)
  for (const z of [0.24, 0.02, -0.2]) {
    const m = shadowed(new Mesh(ring, bandMat))
    m.position.z = z
    group.add(m)
  }
  const nose = new SphereGeometry(0.2, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2)
  nose.rotateX(Math.PI / 2)
  const noseMesh = shadowed(new Mesh(nose, bandMat))
  noseMesh.position.z = 0.425
  group.add(noseMesh)
  const nozzle = new CylinderGeometry(0.16, 0.23, 0.22, 18, 1, true)
  nozzle.rotateX(Math.PI / 2)
  const nozzleMesh = shadowed(new Mesh(nozzle, metal))
  nozzleMesh.material.side = DoubleSide
  nozzleMesh.position.z = -0.53
  group.add(nozzleMesh)

  // Flame: an outer coloured cone and a white-hot core, additive, tip pointing back.
  const flameGroup = new Group()
  flameGroup.position.z = -0.6
  const outer = new ConeGeometry(0.19, 0.6, 16, 1, true)
  outer.translate(0, 0.3, 0)
  outer.rotateX(-Math.PI / 2)
  const core = new ConeGeometry(0.1, 0.32, 12, 1, true)
  core.translate(0, 0.16, 0)
  core.rotateX(-Math.PI / 2)
  // Bloom-aware (neon): HDR-bright with bloom on so the jets glow, plain colour without.
  const additive = { transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }
  const flameMat = neon(flame, BOAT.flameGlow, { ...additive, opacity: 0.75 })
  const coreMat = neon('#d8f8ff', BOAT.flameGlow, { ...additive, opacity: 0.6 })
  flameGroup.add(new Mesh(outer, flameMat), new Mesh(core, coreMat))
  group.add(flameGroup)
  return { group, flame: flameGroup }
}

// The yellow kayak hull: shown until main.js equips the saved catalog boat (boats.js).
export function makeHull() {
  const half = BOAT.length / 2
  const beam = BOAT.beam / 2
  const group = new Group()

  // Lower half of a sphere, pinched toward the ends; keel painted brown by vertex colour.
  const hull = new SphereGeometry(1, 32, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)
  const pos = hull.attributes.position
  const colors = []
  const yellow = new Color(BOAT.hull)
  const brown = new Color(BOAT.hullDark)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    pos.setXYZ(i, x * beam * pinch(z), y * HULL_DEPTH, z * half)
    const c = y < -0.72 ? brown : yellow
    colors.push(c.r, c.g, c.b)
  }
  hull.setAttribute('color', new Float32BufferAttribute(colors, 3))
  hull.computeVertexNormals()
  group.add(shadowed(new Mesh(hull, std('#ffffff', { vertexColors: true, side: DoubleSide, roughness: 0.45 }))))

  // Rounded rim along the top edge.
  const rimPoints = []
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2
    const z = Math.cos(a)
    rimPoints.push(new Vector3(Math.sin(a) * beam * pinch(z), 0, z * half))
  }
  const rim = new TubeGeometry(new CatmullRomCurve3(rimPoints, true), 96, 0.07, 8, true)
  group.add(shadowed(new Mesh(rim, std('#ffd84a', { roughness: 0.4 }))))

  // Cockpit deck just below the rim.
  const deckShape = new Shape()
  rimPoints.forEach((p, i) => (i === 0 ? deckShape.moveTo(p.x * 0.96, -p.z * 0.96) : deckShape.lineTo(p.x * 0.96, -p.z * 0.96)))
  const deck = new ShapeGeometry(deckShape)
  deck.rotateX(-Math.PI / 2)
  const deckMesh = new Mesh(deck, std(BOAT.cockpit, { roughness: 0.8 }))
  deckMesh.position.y = -0.04
  deckMesh.receiveShadow = true
  group.add(deckMesh)

  // Brown stern fin.
  const fin = shadowed(new Mesh(new BoxGeometry(0.08, 0.32, 0.5), std(BOAT.hullDark)))
  fin.position.set(0, -0.3, -half + 0.3)
  group.add(fin)
  return group
}

// Frees a group's own geometries and materials (engines swapped out, a remote boat leaving).
export function disposeGroup(group) {
  group.traverse((o) => {
    if (o.isPoints) return removeEmitter(o)
    o.geometry?.dispose()
    if (o.material) for (const m of [o.material].flat()) m.dispose()
  })
}

// lite (remote players' boats, remotePlayers.js): no exhaust sparks, no shadows, and the engines'
// static parts baked to one mesh per material (only the flames stay apart: they flicker), so a
// boat with 8 engines costs a handful of draw calls instead of ~60.
export function createBoat({ lite = false } = {}) {
  const root = new Group() // follows the player; the hull bobs and tilts inside it
  const tilt = new Group()
  tilt.position.y = BOAT.deck + 0.04
  root.add(tilt)
  let hull = makeHull()
  tilt.add(hull)

  // The engines sit on a cross bar: up to two high per side, further pairs behind, an odd one
  // at the stern. They take the equipped engine's colours and the boat's engine count (setEngines).
  const bar = shadowed(new Mesh(new BoxGeometry(BOAT.beam + 0.9, 0.12, 0.22), std('#3a3f48', { metalness: 0.5, roughness: 0.4 })))
  bar.position.set(0, 0.1, -0.4)
  bar.castShadow = !lite
  tilt.add(bar)
  let flames = []
  let engines = []
  let baked = null // lite: the engines' merged static parts
  let lastLook = null
  let halfWidth = BOAT.beam / 2
  function layoutEngines() {
    const paired = engines.length - (engines.length % 2)
    engines.forEach((e, i) => {
      if (i >= paired) return e.group.position.set(0, 0.05, -BOAT.length / 2 - 0.15) // the odd one: centre stern
      const side = i % 2 ? 1 : -1
      const j = Math.floor(i / 2) // per side: bottom, top, then the next pair behind
      e.group.position.set(side * (halfWidth + 0.24), j % 2 ? 0.36 : -0.08, -0.4 - Math.floor(j / 2) * 0.9)
    })
    bar.visible = paired > 0
    if (lite) bakeEngines()
  }
  // Lite: merge every engine's body, bands and nozzle into a few meshes, and draw all the flames as
  // two instanced meshes (outer + core), one instance per engine, posed from a marker each frame.
  let jets = null
  function bakeEngines() {
    if (baked) {
      tilt.remove(baked)
      baked.traverse((o) => o.isMesh && o.geometry.dispose())
    }
    if (jets)
      for (const m of jets) {
        tilt.remove(m)
        m.geometry.dispose()
        m.material.dispose()
        m.dispose()
      }
    jets = engines[0].flame.children.map((m) => {
      const im = new InstancedMesh(m.geometry, m.material, engines.length)
      im.frustumCulled = false // the instances move with the flicker; the base bounds would be wrong
      tilt.add(im)
      return im
    })
    const holder = new Group()
    tilt.add(holder)
    const markers = engines.map((e, i) => {
      const marker = new Object3D()
      marker.position.copy(e.group.position).add(e.flame.position)
      e.group.remove(e.flame)
      if (i > 0) disposeGroup(e.flame) // the instances use engine 0's flame geometry + materials
      tilt.remove(e.group)
      holder.add(e.group)
      return marker
    })
    baked = bake(holder)
    tilt.remove(holder)
    tilt.add(baked)
    for (const e of engines) e.group.traverse((o) => o.isMesh && o.geometry.dispose()) // materials live on in `baked`
    engines = markers.map((m) => ({ flame: m, group: m })) // what's left of each engine: its flame marker
  }
  // look: an ENGINE catalog look ({ body, band, flame }) or null for the default; count: the boat's
  // engines, drawn as at least a pair (one per side) so every boat looks like the start raft did.
  function setEngines(look, count = 4) {
    lastLook = look
    for (const e of engines) {
      tilt.remove(e.group)
      disposeGroup(e.group)
    }
    const colors = { body: look?.body ?? BOAT.engine, band: look?.band ?? BOAT.engineBand, flame: look?.flame ?? BOAT.flame }
    engines = Array.from({ length: Math.max(2, Math.min(8, count)) }, (_, i) => {
      const engine = makeEngine(colors)
      tilt.add(engine.group)
      // Exhaust sparks out of the nozzle (in the engine's frame, so they follow it).
      if (!lite)
        createEmitter(engine.group, {
          boxes: [{ x: 0, y: 0, z: -0.75, sx: 0.06, sy: 0.06, sz: 0.06 }],
          count: 18, life: 0.4, velocity: [0, 0, -4.5], spread: [0.5, 0.5, 1.2],
          size: 0.2, color: colors.flame, intensity: 3, seed: 41 + i,
        })
      return engine
    })
    layoutEngines() // (lite: bakes, leaving a flame marker per engine)
    flames = engines.map((e) => e.flame)
  }
  setEngines(null, 4)

  // The avatar stands on the deck; the equipped partner (companions.js) stands behind it.
  const rider = new Group()
  rider.position.y = -0.04
  tilt.add(rider)
  const seat = new Group()
  seat.position.set(0, -0.04, -BOAT.length * 0.3)
  tilt.add(seat)

  // Swaps in an equipped catalog boat (boatModels.js): scaled to BOAT.length,
  // the engines moved out to its sides and the rider onto its deck.
  const box = new Box3()
  // Returns the hull it replaced (for the caller to dispose).
  function setHull(model) {
    const old = hull
    tilt.remove(old)
    hull = model
    box.setFromObject(model)
    const k = BOAT.length / Math.max(0.01, box.max.z - box.min.z)
    model.scale.multiplyScalar(k)
    model.position.z = -((box.max.z + box.min.z) / 2) * k
    model.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true
    })
    tilt.add(model)
    halfWidth = Math.max(BOAT.beam / 2, Math.max(-box.min.x, box.max.x) * k)
    if (lite) setEngines(lastLook, engines.length) // baked in place: rebuild at the new width
    else layoutEngines()
    bar.scale.x = (2 * halfWidth + 0.9) / (BOAT.beam + 0.9)
    rider.position.y = seat.position.y = (model.userData.deck ?? 0) * k - 0.04
    return old
  }

  let pitch = 0
  let roll = 0
  let lastSpeed = 0
  return {
    root,
    rider,
    seat,
    setHull,
    setEngines,
    // speed m/s, turn -1..1 (steering input), elapsed s, boost 0..~0.3 (race tap boost: longer, fatter flames)
    update(dt, speed, turn, elapsed, boost = 0) {
      if (!(dt > 0)) return
      const accel = (speed - lastSpeed) / dt
      lastSpeed = speed
      const k = 1 - Math.exp(-BOAT.ease * dt)
      pitch += (Math.max(-0.12, Math.min(0.12, -accel * BOAT.pitchPerAccel)) - pitch) * k
      roll += (turn * BOAT.rollPerTurn * Math.min(1, speed / 6) - roll) * k
      tilt.rotation.set(pitch, 0, roll)
      tilt.position.y = BOAT.deck + 0.04 + Math.sin(elapsed * Math.PI * 2 * BOAT.bobFrequency) * BOAT.bobAmount
      const thrust = (0.75 + Math.min(1, speed / 14) * 0.9) * (1 + boost * 4)
      for (let i = 0; i < flames.length; i++) {
        const f = flames[i]
        f.scale.z = thrust * (0.85 + 0.3 * Math.abs(Math.sin(elapsed * 31 + i * 1.7)))
        const w = (0.9 + 0.12 * Math.sin(elapsed * 23 + i)) * (1 + boost * 1.5)
        f.scale.x = f.scale.y = w
        if (jets) {
          f.updateMatrix()
          for (const m of jets) m.setMatrixAt(i, f.matrix)
        }
      }
      if (jets) for (const m of jets) m.instanceMatrix.needsUpdate = true
    },
  }
}
