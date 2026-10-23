// The other players in the room, drawn in the world (after Clean-leaves-for-loot's remotePlayers.js):
// each is their Bloxity avatar standing in their equipped boat (hull, engines in the equipped
// engine's colours x the boat's engine count), their trail behind it, their pets hovering round it,
// their partner on the deck and a name tag, eased toward the pose the server last relayed (net.js
// roster), plus speed x heading for the time since (dead reckoning), so fast racers glide instead
// of stepping. Poses are in TRACK coordinates (z minus the sender's race scroll): drawn at
// z + this player's own scroll, racers line up in the lane and lobby players slide away with the
// start island while this player races. Diffed against the roster every frame, so joins / leaves /
// gear changes need no events. Nearest first, capped (fewer on touch); pets, partner and trail only
// up close; a remote boat is `lite` (boat.js) and its hull baked, without shadows (draw calls).
import { Group } from 'three'
import { BOATS, COARSE_POINTER, NET } from './config.js'
import { roster, net, sameWorld } from './net.js'
import { createBoat } from './boat.js'
import { buildBoat } from './boatModels.js'
import { ENGINES } from './engine.js'
import { trailById } from './trails.js'
import { createTrail } from './trail.js'
import { createCompanions } from './companions.js'
import { label } from './propkit.js'
import { bake } from './bake.js'
import { buildDefaultCharacter, loadBaseCharacter } from './avatar/character.js'
import { applyProportions, attachEquippedAccessories } from './avatar/loader.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'

const angleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from))
const engineById = new Map(ENGINES.map((e) => [e.id, e]))
const boatById = new Map(BOATS.list.map((b) => [b.id, b]))
const MAX = COARSE_POINTER ? NET.maxRemotesTouch : NET.maxRemotes

// "dog:0,cat:2" -> [{ kind, tier }]
function parsePets(s) {
  if (!s) return []
  return s.split(',').map((x) => {
    const [kind, tier] = x.split(':')
    return { kind, tier: Number(tier) || 0 }
  })
}

// A catalog hull merged to a few meshes (one per material), shadows off: cheap to draw many.
function bakedHull(id) {
  const src = buildBoat(id)
  const model = bake(src)
  model.userData = { ...src.userData }
  src.traverse((o) => o.isMesh && o.geometry.dispose()) // the baked copy keeps the materials
  return model
}

class Remote {
  constructor(scene) {
    this.scene = scene
    this.group = new Group()
    this.group.visible = false
    scene.add(this.group)
    this.boat = createBoat({ lite: true })
    this.group.add(this.boat.root)
    this.trail = createTrail(scene, this.boat.root)
    this.companions = createCompanions(scene, this.boat.seat)
    this.avatar = null
    this.animator = null
    this.avatarJson = null // what the current rig was built from
    this.generation = 0
    this.applied = {} // boat / engine / trail / pets / partner / name as last applied
    this.label = null
    this.placed = false
    this.detail = true
    this.base = { x: 0, y: 0, z: 0, yaw: 0, speed: 0, at: 0, key: '' }
    this.lastY = 0
    this.vy = 0
    this.setAvatar(buildDefaultCharacter())
  }

  setAvatar(next) {
    if (this.avatar) this.boat.rider.remove(this.avatar)
    disposeAnimator(this.animator)
    this.avatar = next
    next.traverse((o) => o.isMesh && (o.castShadow = false)) // shadow passes add up in a full room
    this.boat.rider.add(next)
    this.animator = makeAnimator(next)
  }

  // A signed-in player's look arrives as JSON { equipped, proportions, skin }; "" = default.
  async syncAvatar(json) {
    if (json === this.avatarJson) return
    this.avatarJson = json
    const mine = ++this.generation
    if (!json) return this.setAvatar(buildDefaultCharacter())
    let look = null
    try {
      look = JSON.parse(json)
    } catch {
      return
    }
    try {
      const group = await loadBaseCharacter()
      if (mine !== this.generation) return
      await attachEquippedAccessories(group, look?.equipped, { skinTextureUrl: look?.skin || undefined })
      if (mine !== this.generation) return
      applyProportions(group, look?.proportions)
      this.setAvatar(group)
    } catch (err) {
      console.warn('[remote] avatar failed to load', err)
    }
  }

  // Gear and name: rebuilt only when they change.
  syncGear(p) {
    const a = this.applied
    if (p.boat !== a.boat) {
      a.boat = p.boat
      const model = bakedHull(boatById.has(p.boat) ? p.boat : BOATS.start.equipped) // none sent yet: the starter
      const old = this.boat.setHull(model)
      model.traverse((o) => o.isMesh && (o.castShadow = false))
      old.traverse((o) => o.isMesh && o.geometry.dispose())
      a.engine = undefined // the engine count comes with the boat
    }
    if (p.engine !== a.engine) {
      a.engine = p.engine
      const count = boatById.get(boatById.has(p.boat) ? p.boat : BOATS.start.equipped)?.engines ?? 1
      this.boat.setEngines(engineById.get(p.engine)?.look ?? null, count)
    }
    if (p.trail !== a.trail) {
      a.trail = p.trail
      a.trailShown = undefined
    }
    if (p.pets !== a.pets) {
      a.pets = p.pets
      this.companions.setPets(parsePets(p.pets))
    }
    if (p.partner !== a.partner) {
      a.partner = p.partner
      this.companions.setPartner(p.partner)
    }
    const name = p.username || 'Player'
    if (name !== a.name) {
      a.name = name
      if (this.label) {
        this.group.remove(this.label)
        this.label.material.map?.dispose()
        this.label.material.dispose()
      }
      this.label = label(name, 0.5, { color: '#ffffff', outline: '#1a0a14', font: '700 64px Fredoka, sans-serif', outlineWidth: 10 })
      this.label.position.y = 3.6
      this.group.add(this.label)
    }
  }

  // Pets, partner and trail only up close.
  setDetail(on) {
    if (on === this.detail) return
    this.detail = on
    this.companions.setVisible(on)
    this.applied.trailShown = undefined
  }

  update(p, dt, t, now, scroll, scrollSpeed, camera, near) {
    this.syncGear(p)
    this.syncAvatar(p.avatar)
    this.setDetail(near)
    const trail = near ? p.trail : ''
    if (trail !== this.applied.trailShown) {
      this.applied.trailShown = trail
      this.trail.set(trail ? trailById(trail) : null)
    }

    // A new pose resets the dead-reckoning base.
    const b = this.base
    const key = `${p.x}|${p.y}|${p.z}|${p.yaw}|${p.speed}`
    if (key !== b.key) Object.assign(b, { key, x: p.x, y: p.y, z: p.z, yaw: p.yaw, speed: p.speed, at: now })
    const ahead = Math.min((now - b.at) / 1000, NET.predictMax) * b.speed
    const tx = b.x + Math.sin(b.yaw) * ahead
    const tz = b.z + Math.cos(b.yaw) * ahead + scroll
    const g = this.group
    const far = Math.hypot(tx - g.position.x, tz - g.position.z) > 30
    const k = this.placed && !far ? 1 - Math.exp(-NET.remoteLerp * dt) : 1
    g.position.x += (tx - g.position.x) * k
    g.position.y += (b.y - g.position.y) * k
    g.position.z += (tz - g.position.z) * k
    g.rotation.y += angleDelta(g.rotation.y, b.yaw) * k
    this.vy = this.placed && dt > 0 ? this.vy + ((g.position.y - this.lastY) / dt - this.vy) * Math.min(1, dt * 10) : 0
    this.lastY = g.position.y
    this.placed = true

    this.boat.update(dt, b.speed, 0, t)
    this.animator?.update(dt, { grounded: Math.abs(this.vy) < 0.5, speed: 0, verticalVelocity: this.vy, turn: 0 })
    if (near) {
      this.companions.update(dt, t, g.position.x, g.position.y, g.position.z, g.rotation.y)
      if (this.applied.trailShown) this.trail.update(dt, camera, scrollSpeed)
    }
  }

  hide() {
    this.group.visible = false
    this.companions.setVisible(false)
    if (this.applied.trailShown) this.trail.set(null)
    this.applied.trailShown = ''
    this.detail = false
    this.placed = false // snap into place when it comes back
  }

  dispose() {
    this.generation++ // an avatar still loading is dropped
    this.scene.remove(this.group)
    disposeAnimator(this.animator)
    this.trail.dispose()
    this.companions.dispose() // takes the partner (shared, cached geometry) off the seat first
    this.boat.rider.remove(this.avatar) // rig geometry is shared with every other character
    if (this.label) {
      this.label.material.map?.dispose()
      this.label.material.dispose()
    }
    this.boat.root.traverse((o) => o.isMesh && o.geometry.dispose()) // hull + engines: this boat's own
  }
}

export function createRemotePlayers(scene) {
  const remotes = new Map() // sessionId -> Remote
  const list = [] // reused each frame: [{ id, p, d }]

  function clear() {
    for (const r of remotes.values()) r.dispose()
    remotes.clear()
  }

  return {
    get count() {
      return remotes.size
    },
    // Dev: what each drawn remote costs (meshes = draw calls; shadow casters draw again).
    stats() {
      return [...remotes.values()].filter((r) => r.group.visible).map((r) => {
        const st = { meshes: 0, shadow: 0 }
        r.group.traverseVisible((o) => {
          if (!o.isMesh && !o.isSprite) return
          st.meshes++
          if (o.castShadow) st.shadow++
        })
        st.pets = r.companions.petCount
        st.meshes += st.pets + (r.applied.trailShown ? 1 : 0)
        return { boat: r.applied.boat, engine: r.applied.engine, ...st }
      })
    },
    // viewer: this player's drawn position; scroll: this player's race scroll (m, race.trackScroll)
    // and its speed (m/s, for the trails); camera for the trails.
    update(dt, t, viewer, scroll, scrollSpeed, camera) {
      const players = roster()
      if (!players) return remotes.size && clear()
      const mine = net.sessionId
      list.length = 0
      players.forEach((p, id) => {
        if (id === mine || !sameWorld(p)) return // a player in the other world isn't here
        list.push({ id, p, d: Math.hypot(p.x - viewer.x, p.z + scroll - viewer.z) })
      })
      list.sort((a, b) => a.d - b.d)
      const now = performance.now()
      const keep = new Set()
      for (let i = 0; i < Math.min(MAX, list.length); i++) {
        const { id, p, d } = list[i]
        keep.add(id)
        let r = remotes.get(id)
        if (!r) remotes.set(id, (r = new Remote(scene)))
        const range = p.racing ? NET.raceFade : NET.remoteFade
        if (d > range) {
          if (r.group.visible || r.placed) r.hide()
          continue
        }
        r.group.visible = true
        r.update(p, dt, t, now, scroll, scrollSpeed, camera, d < NET.detailRange)
      }
      for (const [id, r] of remotes) {
        if (keep.has(id)) continue
        r.dispose()
        remotes.delete(id)
      }
    },
  }
}
