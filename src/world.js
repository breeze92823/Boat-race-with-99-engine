import {
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshLambertMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Vector2,
} from 'three'
import { BEACH, ISLET, WATER } from './config.js'
import { RAPIER, addFixed } from './physics.js'
import { mulberry32, paintCrackedSand, paintWaterNormal, toTexture } from './textures.js'
import { buildCliff, buildPalm } from './propkit.js'

// The lobby ground: a pale cracked-sand beach slab in a bright cartoon sea,
// with green hills on the far left horizon, a rocky islet with palms to the
// east, and puffy clouds in the sky.
// Physically the beach is one convex-hull collider plus an invisible fence on
// every edge (the race itself starts past the gate, which is closed for now).
//
// Texture techniques used here:
//  - sand: tileable Voronoi cells + cracks -> colour + derived normal map,
//    world-space UVs (ExtrudeGeometry caps use shape coordinates = metres)
//  - sea: one ripple normal map used twice (normalMap + clearcoatNormalMap) at
//    different scales, scrolled in different directions each frame, over a
//    lighter shallow-water band hugging the shore

// Beach outline in world (x, z), counter-clockwise seen from above. Convex.
export function beachOutline() {
  const { front, back, halfWidth: W, wingZ, gateEdge } = BEACH
  return [
    [-W, back],
    [W, back],
    [W, wingZ],
    [gateEdge, front],
    [-gateEdge, front],
    [-W, wingZ],
  ]
}

// Shape space is (x, -z): rotating the extrusion -90 deg about X maps shape y to world -z and depth to +y.
function outlineShape(points, scale = 1, cz = 0) {
  const s = new Shape()
  points.forEach(([x, z], i) => {
    const sx = x * scale
    const sz = cz + (z - cz) * scale
    if (i === 0) s.moveTo(sx, -sz)
    else s.lineTo(sx, -sz)
  })
  s.closePath()
  return s
}

export function makeHill(x, z, rx, ry, rz, color, seed) {
  const geo = new SphereGeometry(1, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2)
  const rand = mulberry32(seed)
  const bumps = Array.from({ length: 4 }, () => ({ a: rand() * Math.PI * 2, f: 2 + Math.floor(rand() * 3), k: 0.04 + rand() * 0.05 }))
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i)
    const py = pos.getY(i)
    const pz = pos.getZ(i)
    const ang = Math.atan2(pz, px)
    let k = 1
    for (const b of bumps) k += Math.sin(ang * b.f + b.a) * b.k * py
    pos.setXYZ(i, px * k, py, pz * k)
  }
  geo.computeVertexNormals()
  const hill = new Mesh(geo, new MeshStandardMaterial({ color, roughness: 1 }))
  hill.scale.set(rx, ry, rz)
  hill.position.set(x, WATER.level - 1, z)
  // A sand rim where it meets the water.
  const rim = new Mesh(new SphereGeometry(1, 40, 6, 0, Math.PI * 2, 0, Math.PI / 2), new MeshStandardMaterial({ color: '#f1dca6', roughness: 1 }))
  rim.scale.set(rx * 1.08, 3, rz * 1.12)
  rim.position.set(x, WATER.level - 1.6, z)
  return [hill, rim]
}

function makeClouds() {
  const rand = mulberry32(2024)
  const geo = new IcosahedronGeometry(1, 3)
  const mat = new MeshLambertMaterial({ color: '#ffffff', emissive: '#dcebff', emissiveIntensity: 0.62, fog: false })
  const group = new Group()
  for (let i = 0; i < 22; i++) {
    // Mostly ahead (toward the sea, -Z), a few all around.
    const ang = i < 15 ? -Math.PI / 2 + (rand() - 0.5) * Math.PI * 1.25 : rand() * Math.PI * 2
    const dist = 240 + rand() * 170
    const cloud = new Group()
    const puffs = 5 + Math.floor(rand() * 4)
    const len = 22 + rand() * 26
    for (let p = 0; p < puffs; p++) {
      const t = p / (puffs - 1) - 0.5
      const r = (1 - Math.abs(t) * 1.1) * (9 + rand() * 6)
      const puff = new Mesh(geo, mat)
      puff.scale.set(r, r * 0.82, r)
      puff.position.set(t * len, r * 0.25 + rand() * 3, (rand() - 0.5) * 8)
      cloud.add(puff)
    }
    const flat = new Mesh(geo, mat) // flat underside
    flat.scale.set(len * 0.62, 4, 9)
    cloud.add(flat)
    cloud.position.set(Math.cos(ang) * dist, 30 + rand() * 70, Math.sin(ang) * dist)
    cloud.lookAt(0, cloud.position.y, 0)
    group.add(cloud)
  }
  return group
}

export function createWorld(scene) {
  const outline = beachOutline()
  const bevel = 0.6

  // Sand slab: flat cracked top, rounded edge, darker wet sides.
  const sand = paintCrackedSand()
  const sandColor = toTexture(sand.color, { repeat: 1 / BEACH.tile, srgb: true })
  const sandNormal = toTexture(sand.normal, { repeat: 1 / BEACH.tile })
  const slabGeo = new ExtrudeGeometry(outlineShape(outline), {
    depth: BEACH.depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: 1.2,
    bevelSegments: 3,
    curveSegments: 1,
  })
  slabGeo.rotateX(-Math.PI / 2)
  const slab = new Mesh(slabGeo, [
    new MeshStandardMaterial({ map: sandColor, normalMap: sandNormal, normalScale: new Vector2(0.6, 0.6), roughness: 1, metalness: 0 }),
    new MeshStandardMaterial({ color: '#dcc08a', roughness: 1 }),
  ])
  slab.position.y = -(BEACH.depth + bevel)
  slab.receiveShadow = true

  // Shallow water: a lighter band just around the sand.
  const cz = (BEACH.front + BEACH.back) / 2
  const shallowGeo = new ShapeGeometry(outlineShape(outline, 1.12, cz))
  shallowGeo.rotateX(-Math.PI / 2)
  const shallow = new Mesh(shallowGeo, new MeshStandardMaterial({ color: WATER.shallow, roughness: 0.3, transparent: true, opacity: 0.55, depthWrite: false }))
  shallow.position.y = WATER.level + 0.04
  shallow.renderOrder = 1

  // Sea: physical material, two scrolling ripple layers, slightly see-through.
  const ripples = paintWaterNormal()
  const normalA = toTexture(ripples, { repeat: WATER.size / 14 })
  const normalB = toTexture(ripples, { repeat: WATER.size / 37 })
  const sea = new Mesh(
    new PlaneGeometry(WATER.size, WATER.size),
    new MeshPhysicalMaterial({
      color: WATER.color,
      roughness: 0.3,
      metalness: 0,
      normalMap: normalA,
      normalScale: new Vector2(0.3, 0.3),
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      clearcoatNormalMap: normalB,
      clearcoatNormalScale: new Vector2(0.5, 0.5),
      transparent: true,
      opacity: 0.94,
    }),
  )
  sea.rotation.x = -Math.PI / 2
  sea.position.y = WATER.level
  sea.receiveShadow = true

  // Far scenery: green islands on the left horizon, a hazy mountain behind them.
  const scenery = [
    ...makeHill(-250, -300, 120, 30, 60, '#4dbb3c', 11),
    ...makeHill(-130, -360, 55, 18, 35, '#45ad37', 12),
    ...makeHill(-400, -470, 150, 60, 80, '#6f9fd6', 13),
  ]

  scene.add(slab, shallow, sea, makeClouds(), ...scenery)
  const isletFrom = scene.children.length

  // The islet: a low green hill with a grass-capped rock and two palms on it.
  const I = ISLET
  const islet = new Group()
  islet.position.set(I.x, 0, I.z)
  scene.add(islet, ...makeHill(I.x, I.z, I.hill.rx, I.hill.ry, I.hill.rz, '#4dbb3c', 14))
  const [rx, rz, ...rock] = I.rock // offset from the islet centre; buildCliff wants world x, z (its collider)
  buildCliff(scene, [I.x + rx, I.z + rz, ...rock], 5, WATER.level - 1)
  const top = WATER.level - 1 + I.rock[4]
  buildPalm(islet, -4, -2, 11, -0.3, 0.1, 50, top)
  buildPalm(islet, 6, 3, 9, 0.2, -0.2, 51, top)

  // Collision: the slab as a convex hull, and a fence along every edge.
  const hull = []
  for (const [x, z] of outline) hull.push(x, 0, z, x, -BEACH.depth, z)
  addFixed(RAPIER.ColliderDesc.convexHull(new Float32Array(hull)), { x: 0, y: 0, z: 0 }, null, { friction: 0.9 })
  for (let i = 0; i < outline.length; i++) {
    const [ax, az] = outline[i]
    const [bx, bz] = outline[(i + 1) % outline.length]
    const len = Math.hypot(bx - ax, bz - az)
    const yaw = Math.atan2(-(bz - az), bx - ax)
    addFixed(
      RAPIER.ColliderDesc.cuboid(len / 2 + 0.5, BEACH.fenceHeight / 2, 0.4),
      { x: (ax + bx) / 2, y: BEACH.fenceHeight / 2, z: (az + bz) / 2 },
      { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) },
    )
  }

  let scroll = 0 // m the sea has slid toward +Z (a race past RACE.cruiseZ moves the sea, not the boat)
  return {
    // The land (beach, shallows, hills, islet) a race slides away behind the boat; the sea, clouds and sky stay.
    home: [slab, shallow, ...scenery, ...scene.children.slice(isletFrom)],
    setScroll: (m) => (scroll = m),
    update(dt, elapsed) {
      // One ripple tile is 14 m (A) / 37 m (B); v runs toward -Z.
      // Wrapped to one tile: a 2 h race scrolls ~875 km, too far for a float32 offset.
      normalA.offset.set(elapsed * 0.012, elapsed * 0.02 + ((scroll / 14) % 1))
      normalB.offset.set(-elapsed * 0.008, elapsed * 0.005 + ((scroll / 37) % 1))
    },
  }
}
