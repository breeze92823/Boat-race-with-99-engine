import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, DynamicDrawUsage, Mesh, MeshBasicMaterial, NormalBlending, Vector3 } from 'three'
import { TRAILS } from './config.js'
import { trailTexture } from './trailTextures.js'

// The equipped trail behind the player's boat: a textured band fed from the
// stern. Point 0 is pinned to the stern; a new point is dropped every
// `spacing` metres, and each point narrows a little and fades at the end of
// its `life`. The band turns about its path to face the camera, so it stands
// upright seen from the side (the Trails scene) and lies flat on the water
// seen from behind (the chase cam); its lower edge stays on the water. The
// points are world space, and the texture is pinned to the distance travelled
// when each point dropped, so patterns stay where they were laid. `scroll`
// (m/s) slides every point backwards along the boat's heading, which makes a
// parked boat look like it is speeding (the scene's showcase). A jump of more
// than TELEPORT metres in one frame starts the band over.
const TELEPORT = 8

export function createTrail(scene, boatRoot) {
  const R = TRAILS.ribbon
  const n = R.points
  const px = new Float32Array(n)
  const py = new Float32Array(n)
  const pz = new Float32Array(n)
  const age = new Float32Array(n)
  const laid = new Float32Array(n) // distance travelled when the point dropped (texture u)
  let count = 0
  let travel = 0

  const positions = new BufferAttribute(new Float32Array(n * 6), 3).setUsage(DynamicDrawUsage)
  const colors = new BufferAttribute(new Float32Array(n * 8).fill(1), 4).setUsage(DynamicDrawUsage)
  const uvs = new BufferAttribute(new Float32Array(n * 4), 2).setUsage(DynamicDrawUsage)
  const index = []
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', positions)
  geo.setAttribute('color', colors) // rgb stays white; alpha does the fade
  geo.setAttribute('uv', uvs)
  geo.setIndex(index)
  geo.setDrawRange(0, 0)
  const mesh = new Mesh(geo)
  mesh.frustumCulled = false // the points move every frame
  mesh.renderOrder = 3 // over the sea, the shallows and the engine glow
  mesh.visible = false
  scene.add(mesh)

  // One material per trail, made on first use. Not tone mapped: the colours
  // stay as saturated on the water as on the cards.
  const materials = new Map()
  function material(trail) {
    if (!materials.has(trail.id)) {
      const look = trail.look
      materials.set(
        trail.id,
        new MeshBasicMaterial({
          map: trailTexture(look.texture ?? 'soft'),
          color: look.color ?? '#ffffff',
          vertexColors: true,
          transparent: true,
          depthWrite: false,
          side: DoubleSide,
          toneMapped: false,
          blending: look.add ? AdditiveBlending : NormalBlending,
        }),
      )
    }
    return materials.get(trail.id)
  }

  let width = R.width
  let tile = R.tile
  const stern = new Vector3()
  const fwd = new Vector3()
  const side = new Vector3()
  const along = new Vector3()
  const toCam = new Vector3()

  function reset() {
    count = 1
    travel = 0
    px[0] = stern.x
    py[0] = stern.y
    pz[0] = stern.z
    age[0] = 0
    laid[0] = 0
  }

  return {
    // Off the scene for good (a remote player's trail when they leave); the materials are kept.
    dispose() {
      scene.remove(mesh)
      geo.dispose()
    },
    // trail: a TRAILS.list entry, or null for none.
    set(trail) {
      mesh.visible = !!trail
      if (!trail) return
      mesh.material = material(trail)
      width = trail.look.width ?? R.width
      tile = trail.look.tile ?? R.tile
    },
    update(dt, camera, scroll = 0) {
      boatRoot.updateWorldMatrix(true, false)
      stern.set(0, R.height, -R.stern).applyMatrix4(boatRoot.matrixWorld)
      fwd.set(0, 0, 1).transformDirection(boatRoot.matrixWorld)
      if (count === 0 || Math.hypot(stern.x - px[0], stern.z - pz[0]) > TELEPORT) reset()
      travel += Math.hypot(stern.x - px[0], stern.z - pz[0]) + scroll * dt
      if (travel > 20000) {
        // Keep u small enough for float precision: shift by whole texture repeats (invisible).
        const shift = Math.floor(travel / tile) * tile
        travel -= shift
        for (let i = 0; i < count; i++) laid[i] -= shift
      }

      // Age, slide back, drop the expired tail.
      const slide = scroll * dt
      for (let i = 1; i < count; i++) {
        age[i] += dt
        px[i] -= fwd.x * slide
        pz[i] -= fwd.z * slide
      }
      while (count > 1 && age[count - 1] > R.life) count--

      // A new point once the stern has moved `spacing` past the last one.
      if (count === 1 || Math.hypot(stern.x - px[1], stern.z - pz[1]) >= R.spacing) {
        const last = Math.min(count, n - 1)
        for (let i = last; i > 1; i--) {
          px[i] = px[i - 1]
          py[i] = py[i - 1]
          pz[i] = pz[i - 1]
          age[i] = age[i - 1]
          laid[i] = laid[i - 1]
        }
        px[1] = stern.x
        py[1] = stern.y
        pz[1] = stern.z
        age[1] = 0
        laid[1] = travel
        count = last + 1
      }
      px[0] = stern.x
      py[0] = stern.y
      pz[0] = stern.z
      laid[0] = travel

      // Two vertices per point (lower edge v=0, upper v=1), across the path and toward the camera.
      const pos = positions.array
      const col = colors.array
      const uv = uvs.array
      for (let i = 0; i < count; i++) {
        const a = Math.max(0, i - 1)
        const b = Math.min(count - 1, i + 1)
        along.set(px[a] - px[b], 0, pz[a] - pz[b])
        if (along.lengthSq() < 1e-8) along.copy(fwd)
        along.normalize()
        toCam.set(camera.position.x - px[i], camera.position.y - py[i], camera.position.z - pz[i]).normalize()
        side.crossVectors(along, toCam)
        if (side.lengthSq() < 1e-6) side.set(-along.z, 0, along.x)
        side.normalize()
        if (side.y < 0) side.negate()
        const t = Math.min(1, age[i] / R.life)
        const half = (width * (1 - 0.3 * t)) / 2
        const cy = py[i] + side.y * half // keeps the lower edge on the water
        pos.set([px[i] - side.x * half, cy - side.y * half, pz[i] - side.z * half, px[i] + side.x * half, cy + side.y * half, pz[i] + side.z * half], i * 6)
        const u = laid[i] / tile
        uv.set([u, 0, u, 1], i * 4)
        const fade = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4
        const alpha = i === count - 1 ? 0 : R.opacity * fade * fade
        col[i * 8 + 3] = col[i * 8 + 7] = alpha
      }
      positions.needsUpdate = true
      colors.needsUpdate = true
      uvs.needsUpdate = true
      geo.setDrawRange(0, Math.max(0, count - 1) * 6)
    },
  }
}
