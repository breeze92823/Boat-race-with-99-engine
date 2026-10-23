import { Group } from 'three'
import { LOBBY, PLAZA, WORLDS } from './config.js'
import { buildBeachLand, landColliders } from './world.js'
import { buildCity } from './city.js'
import { buildCliff, buildPalm, buildUmbrella, cliffCollider, palmCollider, solidPole } from './propkit.js'

// The start island's scenery, one look per world (WORLDS): the land, the far horizon,
// the cliffs ringing the plaza, the trees, the umbrella and the islet. Every look stands
// on the same footprints, so the colliders are added once here and the looks themselves
// are visual only. A world's look is built the first time it is shown (the City is
// never built for a player who stays on the beach); show() swaps which one is visible.
// Each look is one Group under the scene, so a race slides it away with the rest of the
// start island (main.js puts it in `home`).

// The beach: cracked sand, green hills, grass-capped cliffs with palms, the striped umbrella.
function buildBeach(root) {
  buildBeachLand(root)
  PLAZA.cliffs.forEach((c, i) => buildCliff(root, c, 20 + i * 7, 0, false))
  PLAZA.palms.forEach(([x, z, y, h, lx, lz], i) => buildPalm(root, x, z, h, lx, lz, 300 + i, y, false))
  LOBBY.palms.forEach(([x, z, h, lx, lz], i) => buildPalm(root, x, z, h, lx, lz, 100 + i, 0, false))
  buildUmbrella(root, LOBBY.umbrella, ['#e3262e', '#ffffff'])
}

const BUILDERS = { beach: buildBeach, city: buildCity }

function addColliders() {
  landColliders()
  PLAZA.cliffs.forEach((c) => cliffCollider(c))
  for (const [x, z, y, h] of PLAZA.palms) if (y === 0) palmCollider(x, z, h)
  for (const [x, z, h] of LOBBY.palms) palmCollider(x, z, h)
  const U = LOBBY.umbrella
  solidPole(0.3 * U.scale, 3, U.x, U.z)
}

export function createEnvironment(scene) {
  addColliders()
  const looks = {}
  for (const id of Object.keys(WORLDS.list)) {
    const root = new Group()
    root.name = `scenery-${id}`
    root.visible = false
    scene.add(root)
    looks[id] = { root, built: false }
  }
  let shown = null
  return {
    // One Group per world (built or not yet), for the race's `home`.
    home: Object.values(looks).map((l) => l.root),
    shown: () => shown,
    show(id) {
      const look = looks[id] ?? looks[WORLDS.start]
      if (!look.built) {
        look.built = true
        BUILDERS[id]?.(look.root)
      }
      for (const l of Object.values(looks)) l.root.visible = l === look
      shown = id
    },
  }
}
