// Worlds: the VIP portal on the plaza takes the player between the beach and the
// City (WORLDS in config). Both are the same start island with the same shops,
// lanes, races and progress; only the scenery, sea and sky change (environment.js,
// city.js, lighting.setMoods). Driving into the portal (a circle in front of its
// dais, so it works the same on touch) goes to the other world when it is open:
// a world with `req` opens once the player has that many rebirths and that much
// Power (lightning) at once, and from then on stays open (saved: `worldsUnlocked`);
// the way back is always open. Locked = a toast with what is missing and a deny
// knock; one try per visit (drive out of the circle to try again). The board over
// the arch shows the destination and each requirement in green (met) or red.
// The current world is saved (`world`) and sent with the loadout, so remote
// players in another world are not drawn (remotePlayers.js, net.js).
// VITE_DEV_WORLDS=true (dev server only) skips the requirement and doesn't save the unlock.
import './worlds.css'
import { DEV_WORLDS, PLAZA, WORLDS } from './config.js'
import { sfx } from './audio/index.js'
import { burst, flash } from './juice.js'

export const worldState = { current: WORLDS.start, unlocked: [] }

const IDS = Object.keys(WORLDS.list)
const OK = '#7dff6a'
const MISSING = '#ff6b6b'

// deps: { hud (root), plaza (setPortal), env (show), world (setSeaColor), lighting (setMoods),
//   stats() -> { rebirths, power }, leave() (end a race / the Trails scene first), respawn() }
export function createWorlds(deps) {
  const { hud, plaza, env, world, lighting } = deps
  const P = WORLDS.portal
  const cx = PLAZA.vip.x
  const cz = PLAZA.vip.z + P.dz
  let armed = true
  let busy = false // between the flash and the swap
  let signIn = 0

  const toast = document.createElement('div')
  toast.className = 'world-toast'
  const banner = document.createElement('div')
  banner.className = 'world-banner'
  banner.innerHTML = '<div class="world-banner-sub ol">Welcome to</div><div class="world-banner-name grad"></div>'
  const bannerName = banner.lastChild
  hud.root.append(toast, banner)
  function say(html) {
    toast.innerHTML = html
    toast.classList.remove('show')
    void toast.offsetWidth
    toast.classList.add('show')
  }

  // The portal leads from the start world to the other one, and from any other back to the start.
  const destination = () => (worldState.current === WORLDS.start ? IDS.find((id) => id !== WORLDS.start) : WORLDS.start)
  const meets = (req, st) => st.rebirths >= req.rebirths && st.power >= req.power
  const isOpen = (id, st = deps.stats()) => {
    const req = WORLDS.list[id].req
    return !req || DEV_WORLDS || worldState.unlocked.includes(id) || meets(req, st)
  }

  function refreshSign() {
    const id = destination()
    const def = WORLDS.list[id]
    const st = deps.stats()
    const lines = [[def.name, '#ffffff']]
    if (!def.req) lines.push(['▶ Enter', '#7fd8ff'])
    else if (DEV_WORLDS || worldState.unlocked.includes(id)) lines.push(['🔓 Unlocked', OK])
    else {
      const row = (icon, name, have, need) => (have >= need ? [`${icon} ${name}: ${need} ✔`, OK] : [`${icon} ${name}: ${Math.floor(have)}/${need}`, MISSING])
      lines.push(row('●', 'Rebirth', st.rebirths, def.req.rebirths), row('⚡', 'Power', st.power, def.req.power))
    }
    plaza.setPortal(lines, isOpen(id, st))
  }

  // Shows world `id` at once: its scenery, sea and sky; the portal now leads back.
  function apply(id) {
    worldState.current = id
    const def = WORLDS.list[id]
    env.show(id)
    world.setSeaColor(def.sea)
    lighting.setMoods(def.sky)
    refreshSign()
  }

  function travel(id) {
    busy = true
    deps.leave()
    flash('white')
    sfx.sceneIn()
    setTimeout(() => {
      apply(id)
      deps.respawn()
      busy = false
      bannerName.textContent = bannerName.dataset.t = WORLDS.list[id].name
      banner.classList.remove('show')
      void banner.offsetWidth
      banner.classList.add('show')
    }, P.swapDelay * 1000)
  }

  function use() {
    const id = destination()
    const req = WORLDS.list[id].req
    if (!isOpen(id)) {
      sfx.deny()
      say(`🔒 ${WORLDS.list[id].name} needs <b>● ${req.rebirths} Rebirths</b> and <b>⚡ ${req.power} Power</b>`)
      return
    }
    if (req && !DEV_WORLDS && !worldState.unlocked.includes(id)) {
      worldState.unlocked.push(id) // open for good from now on
      sfx.unlock()
      burst(window.innerWidth / 2, window.innerHeight / 2, 'big')
    }
    travel(id)
  }

  apply(WORLDS.start)

  return {
    // pos: the player's feet, or null while racing / in the Trails scene (the portal is off).
    update(dt, pos) {
      if ((signIn -= dt) <= 0) {
        signIn = 0.5
        refreshSign()
      }
      if (!pos || busy) return
      const inside = Math.hypot(pos.x - cx, pos.z - cz) < P.radius
      if (inside && armed) use()
      armed = !inside
    },
    // net.js: the current world and the worlds opened so far.
    snapshot: () => ({ world: worldState.current, worldsUnlocked: [...worldState.unlocked] }),
    hydrate(doc) {
      worldState.unlocked = Array.isArray(doc.worldsUnlocked) ? doc.worldsUnlocked.filter((id) => WORLDS.list[id]?.req) : []
      const id = doc.world
      const next = WORLDS.list[id] && (!WORLDS.list[id].req || worldState.unlocked.includes(id)) ? id : WORLDS.start
      if (next === worldState.current) return refreshSign()
      deps.leave()
      apply(next)
      deps.respawn()
    },
    // Dev: __game.worlds.go('city') skips the requirement.
    go: (id) => WORLDS.list[id] && travel(id),
  }
}
